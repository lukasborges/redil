'use strict';

const { isPopupRequested } = require('./popup');

const BLANK = ['about:blank', 'about:blank#blocked'];
const HANDED_TO_THE_SYSTEM = ['mailto:', 'tel:'];

const originOf = url => {
	try {
		return new URL(url).origin;
	} catch {
		return null;
	}
};

/*
 * Where a window.open or a target="_blank" from a service goes. Nothing here
 * names a host: every link stays inside the app, in a window that shares the
 * service's session, and the context menu's Open Link in Browser is the way out.
 *
 *   'blank'    about:blank, which the page fills or navigates itself
 *   'popup'    a sized window the page keeps a handle on, as OAuth popups are
 *   'window'   anything else on the web, in an auxiliary window
 *   'external' mailto: and tel:, for the system's own handler
 *   'drop'     any other scheme, such as slack://, which would hand the
 *              session to a native app
 */
function classifyWindowOpen({ url, features }) {
	if ( BLANK.includes(url) ) return 'blank';

	let target;
	try {
		target = new URL(url);
	} catch {
		return 'drop';
	}
	if ( HANDED_TO_THE_SYSTEM.includes(target.protocol) ) return 'external';
	if ( !['http:', 'https:'].includes(target.protocol) ) return 'drop';

	return isPopupRequested(features) ? 'popup' : 'window';
}

/*
 * A sign-in that left the service for another origin ends by coming back to
 * it. That navigation belongs in the service's own tab, where the page that
 * started the sign-in keeps its state and its PKCE verifier, and the window
 * that carried the sign-in has nothing left to do.
 */
function isReturnToService({ serviceUrl, fromUrl, toUrl }) {
	const service = originOf(serviceUrl);
	const from = originOf(fromUrl);
	// about:blank has the origin "null": a blank window the page is about to
	// fill has not left anywhere.
	const isOrigin = origin => !!origin && origin !== 'null';
	if ( !isOrigin(service) || !isOrigin(from) ) return false;
	return originOf(toUrl) === service && from !== service;
}

module.exports = { classifyWindowOpen, isReturnToService };
