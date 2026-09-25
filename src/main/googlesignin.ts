import type { Session } from 'electron';

const GOOGLE_SIGN_IN_REQUESTS = 'https://accounts.google.com/*';

export const withoutChromeVersion = (userAgent: string) => userAgent.replace(/Chrome\/[\d.]+/, 'Chrome');

export function stripChromeVersionFromGoogleSignInHeader(session: Session): void {
	session.webRequest.onBeforeSendHeaders({ urls: [GOOGLE_SIGN_IN_REQUESTS] }, (details, callback) => {
		const { requestHeaders } = details;
		const header = Object.keys(requestHeaders).find(name => name.toLowerCase() === 'user-agent');
		if ( header ) requestHeaders[header] = withoutChromeVersion(requestHeaders[header] ?? '');
		callback({ requestHeaders });
	});
}
