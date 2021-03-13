import stringAssets from './strings.json';

export function checkRequiredEnvVars(requiredEnvVars: string[]) {
	const missingVars = requiredEnvVars.filter((varName) => !(varName in process.env));
	if (missingVars.length === 0) {
		return;
	}
	const messageLines = [stringAssets['REQUIRED_ENVIRONMENT_VARIABLES_MISSING']].concat(missingVars);
	const message = messageLines.join('\n');
	console.log(message);
	process.exit(0);
}
