import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import stringAssets from './strings.json';

const requiredEnvVars = ['PORT', 'JWKS_URI'];

function checkRequiredEnvVars(requiredEnvVars: string[]) {
	const missingVars = requiredEnvVars.filter((varName) => !(varName in process.env));
	if (missingVars.length > 0) {
		const messageLines = [stringAssets['REQUIRED_ENVIRONMENT_VARIABLES_MISSING']].concat(missingVars);
		const message = messageLines.join('\n');
		console.log(message);
		process.exit(0);
	}
}

checkRequiredEnvVars(requiredEnvVars);
