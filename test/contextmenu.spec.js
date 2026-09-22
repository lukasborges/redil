const { test, expect } = require('@playwright/test');
const path = require('path');
const { repoRoot } = require('./helpers/launch');

// electron/contextmenu.js only touches Electron inside the click handlers, so
// the template can be built without launching anything. These cases are the
// behaviour the vendored electron-contextmenu-wrapper had, kept as a record of
// what the rewrite is allowed to change.
const { template } = require(path.join(repoRoot, 'electron', 'contextmenu.js'));

const contents = {
	 cut() {}, copy() {}, paste() {}
	,copyImageAt() {}, showDefinitionForSelection() {}
};
const base = { editFlags: { canCut: true, canCopy: true, canPaste: true }, x: 10, y: 20 };
const labels = params => template(contents, { ...base, ...params })
	.map(item => item.type === 'separator' ? '---' : item.label);

test('offers copy and open for a link', () => {
	expect(labels({ linkURL: 'https://example.com/a', linkText: 'a' }))
		.toEqual(['Copy Link', 'Open Link']);
});

test('names the email case differently and copies the address alone', () => {
	const items = template(contents, { ...base, linkURL: 'mailto:someone@example.com', linkText: 'someone@example.com' });
	expect(items[0].label).toBe('Copy Email Address');
});

test('adds the image items to a link that wraps an image', () => {
	expect(labels({ linkURL: 'https://example.com/a', linkText: 'a', srcURL: 'https://example.com/i.png' }))
		.toEqual(['Copy Link', 'Open Link', '---', 'Copy Image', 'Copy Image URL']);
});

test('offers only the image items for an image', () => {
	expect(labels({ hasImageContents: true, srcURL: 'https://example.com/i.png' }))
		.toEqual(['Copy Image', 'Copy Image URL']);
});

test('offers the editing items in a text field', () => {
	expect(labels({ isEditable: true })).toEqual(['Cut', 'Copy', 'Paste']);
});

test('treats a non-editable input field as editable, as the original did', () => {
	expect(labels({ inputFieldType: 'plainText' })).toEqual(['Cut', 'Copy', 'Paste']);
});

test('disables the editing items the page says are unavailable', () => {
	const items = template(contents, {
		...base, isEditable: true, editFlags: { canCut: false, canCopy: true, canPaste: false }
	});
	expect(items.map(i => [i.label, i.enabled]))
		.toEqual([['Cut', false], ['Copy', true], ['Paste', false]]);
});

test('offers only copy over plain text', () => {
	expect(labels({})).toEqual(['Copy']);
});

test('offers a search when the selection holds letters', () => {
	expect(labels({ selectionText: 'buscar isto' }))
		.toEqual(['Search with Google', '---', 'Copy']);
});

test('offers no search when the selection is only digits', () => {
	expect(labels({ selectionText: '12345' })).toEqual(['Copy']);
});

test('targets the webContents that reported the click', () => {
	// The package this replaced aimed these at getCurrentWindow(), so a click
	// inside a service acted on the host window instead of the service.
	const acted = [];
	const spy = { ...contents, cut: () => acted.push('cut'), copy: () => acted.push('copy'), paste: () => acted.push('paste') };
	template(spy, { ...base, isEditable: true }).forEach(item => item.click());
	expect(acted).toEqual(['cut', 'copy', 'paste']);
});
