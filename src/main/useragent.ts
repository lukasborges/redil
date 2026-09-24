export function withoutAppTokens(userAgent: string): string {
	return userAgent.replace(/\s(Shep|Electron)\/\S+/g, '');
}
