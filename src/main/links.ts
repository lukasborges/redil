export type WindowOpenKind = 'blank' | 'popup' | 'window' | 'external' | 'drop';

const BLANK = ['about:blank', 'about:blank#blocked'];
const HANDED_TO_THE_SYSTEM = ['mailto:', 'tel:'];

export function isBlank(url: string): boolean {
	return BLANK.includes(url);
}

function parseFeatureBoolean(value: string): boolean {
	if ( value === '' || value === 'yes' || value === 'true' ) return true;
	const number = parseInt(value, 10);
	return !Number.isNaN(number) && number !== 0;
}

// https://html.spec.whatwg.org/multipage/nav-history-apis.html#popup-window-is-requested
export function isPopupRequested(features: string | undefined): boolean {
	if ( !features ) return false;
	const tokens = new Map<string, string>();
	for ( const pair of features.split(/[\s,]+/) ) {
		if ( !pair ) continue;
		const [key = '', value = ''] = pair.split('=');
		const name = key.trim().toLowerCase();
		if ( name === 'noopener' || name === 'noreferrer' ) continue;
		tokens.set(name, value.trim().toLowerCase());
	}
	if ( tokens.size === 0 ) return false;

	const feature = (name: string, fallback: boolean) => tokens.has(name) ? parseFeatureBoolean(tokens.get(name) ?? '') : fallback;
	if ( tokens.has('popup') ) return feature('popup', false);
	if ( feature('location', false) && feature('toolbar', false) ) return false;
	if ( feature('menubar', false) ) return false;
	if ( !feature('resizable', true) ) return true;
	if ( feature('scrollbars', false) ) return false;
	if ( feature('status', false) ) return false;
	return true;
}

export function classifyWindowOpen(url: string, features: string | undefined): WindowOpenKind {
	if ( isBlank(url) ) return 'blank';

	let target: URL;
	try {
		target = new URL(url);
	} catch {
		return 'drop';
	}
	if ( HANDED_TO_THE_SYSTEM.includes(target.protocol) ) return 'external';
	if ( target.protocol !== 'http:' && target.protocol !== 'https:' ) return 'drop';

	return isPopupRequested(features) ? 'popup' : 'window';
}

function originOf(url: string): string | null {
	try {
		return new URL(url).origin;
	} catch {
		return null;
	}
}

export function isReturnToService(serviceUrl: string, fromUrl: string, toUrl: string): boolean {
	const service = originOf(serviceUrl);
	const from = originOf(fromUrl);
	const isOpaqueOrUnparsable = (origin: string | null) => !origin || origin === 'null';
	if ( isOpaqueOrUnparsable(service) || isOpaqueOrUnparsable(from) ) return false;
	return originOf(toUrl) === service && from !== service;
}
