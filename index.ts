import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwksRsa from 'jwks-rsa';
import jwt from 'jsonwebtoken';

import { checkRequiredEnvVars } from './util';

const requiredEnvVars = ['PORT', 'JWKS_URI'];

checkRequiredEnvVars(requiredEnvVars);

const port = process.env['PORT']!;
const jwksUri = process.env['JWKS_URI']!;

const jwksClient = jwksRsa({jwksUri});

const httpServer = createServer();
const io = new Server(httpServer, {
	serveClient: false,
	/*
	* Restricting to websocket only for the sake of scalability.
	* Otherwise, sticky sessions are required when using more than one node.
	*/
	transports: ['websocket']
});

type UserType = 'Machine' | 'User';

type UserInfo = {
	username: string,
	uniqueId: string,
	type: UserType
};

const userInfoCache = new Map<string, UserInfo>();

interface PayloadWithExpectedClaims {
	gty: string,
	sub: string
};

interface PayloadWithExpectedUserClaims {
	name: string
};

function verifyTokenPayload(payload: object | undefined) {
	if (payload === undefined) {
		return false;
	}
	const expectedClaims = ['sub', 'gty'];
	for (let claim of expectedClaims) {
		if (!(claim in payload) || typeof((payload as { [p: string]: string | null | undefined })[claim])
			!== 'string') {
			return false;
		}
	}
	const grantType = (payload as PayloadWithExpectedClaims).gty;
	if (grantType === 'client_credentials'){
		const expectedUserClaims = ['name'];
		for (let claim of expectedUserClaims) {
			if (!(claim in payload) ||
				typeof((payload as { [p: string]: string | null | undefined })[claim]) !== 'string') {
				return false;
			}
		}
	}

	return true;
}

function handleAuthError(socket: Socket, context: string) {
	socket.emit('authFailure', context);
	socket.disconnect(true);
}

io.on('connection', async (socket: Socket) => {
	const socketAuth = socket.handshake.auth;

	if (!('token' in socketAuth && typeof socketAuth['token'] === 'string')) {
		handleAuthError(socket, 'Token not found in auth headers.');
		return;
	}

	interface DecodedTokenWithExpectedFields {
		header: { kid: string } | null | undefined;
	};

	const token = socketAuth['token'];
	const decodedToken = jwt.decode(token, { complete: true });

	if (decodedToken === null) {
		handleAuthError(socket, 'Failed to decode token.');
		return;
	}

	if (typeof((decodedToken as DecodedTokenWithExpectedFields).header?.kid) !== 'string') {
		handleAuthError(socket, 'KID not found in token header.');
		return;
	}

	const kid: string = (decodedToken as DecodedTokenWithExpectedFields).header!.kid;
	const signingKey = await jwksClient.getSigningKeyAsync(kid);
	let payload: object | undefined = undefined;
	try {
		payload = await new Promise((resolve, reject) => {
			jwt.verify(token, signingKey.getPublicKey(), { algorithms: ['RS256'] },
				(err, payload) => {
					if (err) {
						reject(err);
					}
					resolve(payload);
				}
			);
		});
	}
	catch (err) {
		handleAuthError(socket, 'Failed to verify the token against the signing key.');
		return;
	}

	if (!verifyTokenPayload(payload)) {
		handleAuthError(socket, 'Token payload does not contain all expected claims.');
		return;
	}

	const grantType = (payload as PayloadWithExpectedClaims).gty;
	const userType: UserType = grantType === 'client-credentials' ? 'Machine' : 'User';
	const sub = (payload as PayloadWithExpectedClaims).sub;

	const userInfo: UserInfo = {
		username: userType === 'User' ? (payload as PayloadWithExpectedUserClaims).name : sub,
		uniqueId: sub,
		type: userType
	};
	userInfoCache.set(socket.id, userInfo);
	socket.emit('authenticated', userInfo);
});

io.on('disconnect', (socket) => {
	userInfoCache.delete(socket.id);
});

httpServer.listen(port);
