export function withoutAppTokens(userAgent: string): string {
	return userAgent.replace(/\s(Shep|Redil|Electron)\/\S+/g, '');
}
