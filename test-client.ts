import axios from 'axios';
import {io} from 'socket.io-client';

import {checkRequiredEnvVars} from './util';

const requiredEnvVars = ['SERVER_URL', 'CLIENT_ID', 'CLIENT_SECRET', 'AUDIENCE', 'TOKEN_API_URL'];

checkRequiredEnvVars(requiredEnvVars);

const clientId = process.env['CLIENT_ID'];
const clientSecret = process.env['CLIENT_SECRET'];
const audience = process.env['AUDIENCE'];
const tokenApiUrl = process.env['TOKEN_API_URL'];
const serverUrl: string = process.env['SERVER_URL']!;

const tokenRequestBodyObj = {
	'client_id': clientId,
	'client_secret': clientSecret,
	audience,
	'grant_type': 'client_credentials'
};

interface AuthZeroTokenResponse {
	'access_token': string,
	'token_type': string
};

axios({
	method: 'POST',
	url: tokenApiUrl,
	headers: {
		'content-type': 'application/json'
	},
	data: tokenRequestBodyObj
})
	.then(
		(response) => {
			const responseData = response.data;
			function validateResponseType(responseData: any) {
				return !!responseData && typeof(responseData['access_token'] === 'string' &&
					typeof(responseData['token_type']) === 'string');
			}
			if (!validateResponseType(responseData)) {
				console.error('Response from auth token API is not of the expected type:', responseData);
				process.exit(1);
			}
			testSocketAuth((responseData as AuthZeroTokenResponse)['access_token']);
		}
	)
	.catch(
		(err) => {
			console.error(`Error getting auth token: "${err.message}".`);
			process.exit(1);
		}
	);

function testSocketAuth(accessToken: string) {
	const socket = io(serverUrl, {
		transports: ['websocket'],
		withCredentials: true,
		auth: {
			token: accessToken
		}
	});
	socket.on('connect', () => console.log(`Connected with ID: ${socket.id}`));
	socket.on('authenticated', (data) => {
		console.log(`Authenticated successfully:`, data);
		socket.disconnect();
		process.exit(0);
	});
	socket.on('authFailure', (data) => {
		console.error(`Authentication failed:`, data);
		socket.disconnect();
		process.exit(1);
	});
}

setInterval(() => {}, 1 << 30);
