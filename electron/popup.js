'use strict';

// The HTML spec's "check if a popup window is requested", applied to the
// features string window.open was called with. A page that asks for a sized
// window with no browser chrome wants a window of its own, the way Meet's
// "Open in new window" does; a bare window.open() wants a tab.
// https://html.spec.whatwg.org/multipage/nav-history-apis.html#popup-window-is-requested
function parseBoolean(value) {
	if (value === '' || value === 'yes' || value === 'true') return true;
	const number = parseInt(value, 10);
	return !Number.isNaN(number) && number !== 0;
}

function isPopupRequested(features) {
	if (!features) return false;
	const tokens = new Map();
	for (const pair of features.split(/[\s,]+/)) {
		if (!pair) continue;
		const [key, value = ''] = pair.split('=');
		const name = key.trim().toLowerCase();
		// These shape the opener relationship, not the window.
		if (name === 'noopener' || name === 'noreferrer') continue;
		tokens.set(name, value.trim().toLowerCase());
	}
	if (tokens.size === 0) return false;

	const feature = (name, fallback) => tokens.has(name) ? parseBoolean(tokens.get(name)) : fallback;
	if (tokens.has('popup')) return feature('popup');
	if (feature('location', false) && feature('toolbar', false)) return false;
	if (feature('menubar', false)) return false;
	if (!feature('resizable', true)) return true;
	if (feature('scrollbars', false)) return false;
	if (feature('status', false)) return false;
	return true;
}

module.exports = { isPopupRequested };
