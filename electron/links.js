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

function isReturnToService({ serviceUrl, fromUrl, toUrl }) {
	const service = originOf(serviceUrl);
	const from = originOf(fromUrl);
	const isOpaqueOrUnparsable = origin => !origin || origin === 'null';
	if ( isOpaqueOrUnparsable(service) || isOpaqueOrUnparsable(from) ) return false;
	return originOf(toUrl) === service && from !== service;
}

module.exports = { classifyWindowOpen, isReturnToService };
