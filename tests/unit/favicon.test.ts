import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asBase64DataUrl, dataUrlParts, imageWidth, pickFavicon } from '../../src/main/favicon.ts';
import { withoutAppTokens } from '../../src/main/useragent.ts';

const png = (width: number) => {
	const bytes = new Uint8Array(24);
	bytes.set([0x89, 0x50, 0x4e, 0x47]);
	new DataView(bytes.buffer).setUint32(16, width);
	return bytes;
};

const ico = (...widths: number[]) => {
	const bytes = new Uint8Array(6 + widths.length * 16);
	const view = new DataView(bytes.buffer);
	view.setUint16(2, 1, true);
	view.setUint16(4, widths.length, true);
	widths.forEach((width, entry) => { bytes[6 + entry * 16] = width === 256 ? 0 : width; });
	return bytes;
};

test('reads the width of the formats favicons come in', () => {
	assert.equal(imageWidth(png(128), 'image/png'), 128);
	assert.equal(imageWidth(ico(16, 32, 256), 'image/x-icon'), 256);
	assert.equal(imageWidth(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 64, 0, 64, 0]), 'image/gif'), 64);
	assert.equal(imageWidth(new Uint8Array(0), 'image/svg+xml'), Infinity);
	assert.equal(imageWidth(new Uint8Array([1, 2, 3]), 'image/webp'), 0);
});

test('picks the smallest favicon sharp at 24px on a 2x screen, or else the largest', () => {
	const at = (width: number) => ({ dataUrl: 'w' + width, width });
	assert.equal(pickFavicon([at(128), at(16), at(48), at(32)]), 'w48');
	assert.equal(pickFavicon([at(16), at(32)]), 'w32');
	assert.equal(pickFavicon([]), null);
});

test('re-encodes an inline SVG favicon in base64, so its quotes survive a CSS url()', () => {
	const inline = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
	const encoded = asBase64DataUrl(inline);
	assert.match(encoded ?? '', /^data:image\/svg\+xml;base64,/);
	assert.equal(dataUrlParts(encoded ?? '')?.bytes.toString(), "<svg xmlns='http://www.w3.org/2000/svg'/>");
});

test('strips the Shep and Electron tokens from the user agent and keeps Chrome', () => {
	const electron = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Shep/1.0.0 Chrome/152.0.7977.130 Electron/44.4.3 Safari/537.36';
	assert.equal(withoutAppTokens(electron), 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.130 Safari/537.36');
});
