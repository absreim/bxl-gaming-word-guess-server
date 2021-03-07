import { createServer } from 'http';
import { Server } from 'socket.io';
import jwksRsa from 'jwks-rsa';

import stringAssets from './strings.json';

const requiredEnvVars = ['PORT', 'JWKS_URI'];

function checkRequiredEnvVars(requiredEnvVars: string[]) {
	const missingVars = requiredEnvVars.filter((varName) => !(varName in process.env));
	if (missingVars.length === 0) {
		return;
	}
	const messageLines = [stringAssets['REQUIRED_ENVIRONMENT_VARIABLES_MISSING']].concat(missingVars);
	const message = messageLines.join('\n');
	console.log(message);
	process.exit(0);
}

checkRequiredEnvVars(requiredEnvVars);

const port = process.env['PORT']!;
const jwksUri = process.env['JWKS_URI']!;

const jwksClient = jwksRsa({ jwksUri });

const httpServer = createServer();
const io = new Server(httpServer);

httpServer.listen(port);
