import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageMenu, type PageActions, type PageClick } from '../../src/main/pagemenu.ts';

const done: string[] = [];
const actions: PageActions = {
	openInBrowser: url => done.push('open ' + url),
	copyText: text => done.push('copy ' + text),
	copyImage: () => done.push('copy image'),
	cut: () => done.push('cut'),
	copy: () => done.push('copy'),
	paste: () => done.push('paste'),
	replaceMisspelling: word => done.push('replace ' + word),
	addToDictionary: word => done.push('learn ' + word)
};
const base: PageClick = {
	linkURL: '', linkText: '', srcURL: '', hasImageContents: false, selectionText: '', isEditable: false,
	misspelledWord: '', dictionarySuggestions: [], editFlags: { canCut: true, canCopy: true, canPaste: true }
};
const menu = (click: Partial<PageClick>) => pageMenu({ ...base, ...click }, actions);
const labels = (click: Partial<PageClick>) => menu(click).map(item => item.type === 'separator' ? '---' : item.label);

test('offers copy and open in the browser for a link, the way out of the app', () => {
	assert.deepEqual(labels({ linkURL: 'https://example.com/a', linkText: 'a' }), ['Copy Link', 'Open Link in Browser']);
	menu({ linkURL: 'https://example.com/a' })[1]?.click?.();
	assert.equal(done.at(-1), 'open https://example.com/a');
});

test('copies an email link as the address alone', () => {
	const items = menu({ linkURL: 'mailto:someone@example.com', linkText: 'someone@example.com' });
	assert.equal(items[0]?.label, 'Copy Email Address');
	items[0]?.click?.();
	assert.equal(done.at(-1), 'copy someone@example.com');
});

test('adds the image items to a link that wraps an image, and offers only them for an image', () => {
	assert.deepEqual(labels({ linkURL: 'https://example.com/a', srcURL: 'https://example.com/i.png' }), ['Copy Link', 'Open Link in Browser', '---', 'Copy Image', 'Copy Image URL']);
	assert.deepEqual(labels({ hasImageContents: true, srcURL: 'https://example.com/i.png' }), ['Copy Image', 'Copy Image URL']);
});

test('offers the editing items in a text field, a non-editable input included, disabled where the page says so', () => {
	assert.deepEqual(labels({ isEditable: true }), ['Cut', 'Copy', 'Paste']);
	assert.deepEqual(labels({ inputFieldType: 'plainText' }), ['Cut', 'Copy', 'Paste']);
	assert.deepEqual(menu({ isEditable: true, editFlags: { canCut: false, canCopy: true, canPaste: false } }).map(item => item.enabled), [false, true, false]);
});

test('offers only copy over plain text, and a search when the selection holds letters', () => {
	assert.deepEqual(labels({}), ['Copy']);
	assert.deepEqual(labels({ selectionText: 'sheepdog' }), ['Search with Google', '---', 'Copy']);
	assert.deepEqual(labels({ selectionText: '12345' }), ['Copy']);
});

test('puts at most five spelling suggestions above the editing items, and says when there are none', () => {
	const suggestions = ['a', 'b', 'c', 'd', 'e', 'f'];
	assert.deepEqual(labels({ isEditable: true, misspelledWord: 'shepp', dictionarySuggestions: suggestions }), ['a', 'b', 'c', 'd', 'e', '---', 'Add to Dictionary', '---', 'Cut', 'Copy', 'Paste']);
	assert.equal(labels({ isEditable: true, misspelledWord: 'qqq' })[0], 'No Spelling Suggestions');
});
