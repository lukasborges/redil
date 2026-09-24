// The address as typed, with https:// in front when it has no scheme, or null when it is not a web address.
export function normalizeUrl(value: string): string | null {
	let typed = value.trim();
	if ( !typed ) return null;
	if ( !/^[a-z][a-z0-9+.-]*:\/\//i.test(typed) ) typed = 'https://' + typed;
	try {
		const url = new URL(typed);
		if ( url.protocol !== 'http:' && url.protocol !== 'https:' ) return null;
		if ( url.hostname !== 'localhost' && !url.hostname.includes('.') ) return null;
		return url.href;
	} catch {
		return null;
	}
}

const MEANINGLESS_SUBDOMAINS = ['www', 'web', 'app', 'm'];

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

// The site, then what the subdomain says when it says something: chat.google.com is not just "Google".
export function nameFromUrl(value: string): string {
	const { hostname } = new URL(value);
	const isIpAddress = /^[\d.]+$/.test(hostname) || hostname.startsWith('[');
	if ( isIpAddress ) return hostname;
	const labels = hostname.split('.');
	const isCountryUnderShortSecondLevel = labels.length > 2 && (labels.at(-1) ?? '').length === 2 && (labels.at(-2) ?? '').length <= 3;
	const siteAt = isCountryUnderShortSecondLevel ? labels.length - 3 : labels.length - 2;
	if ( siteAt < 0 ) return capitalize(labels[0] ?? '');
	const site = capitalize(labels[siteAt] ?? '');
	const meaningful = labels.slice(0, siteAt).filter(label => !MEANINGLESS_SUBDOMAINS.includes(label));
	const last = meaningful.at(-1);
	return last ? site + ' ' + capitalize(last) : site;
}
