import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGUE, CATALOGUE_GROUPS, matchCatalogue, type CatalogueEntry } from '../../src/shared/catalogue.ts';
import { normalizeUrl } from '../../src/shared/address.ts';
import { iconLinksFrom } from '../../src/main/favicon.ts';

test('gives every catalogue entry a name, a web address as the dialog would take it, and a known group', () => {
	for ( const entry of CATALOGUE ) {
		assert.ok(entry.name.trim(), JSON.stringify(entry));
		assert.equal(normalizeUrl(entry.url), entry.url, entry.name);
		assert.ok(CATALOGUE_GROUPS.includes(entry.group), entry.name);
		if ( entry.icon ) assert.match(entry.icon, /^https:\/\//, entry.name);
	}
});

test('lists each address and each name once', () => {
	assert.equal(new Set(CATALOGUE.map(entry => entry.url)).size, CATALOGUE.length);
	assert.equal(new Set(CATALOGUE.map(entry => entry.name)).size, CATALOGUE.length);
});

const sample: CatalogueEntry[] = [
	{ name: 'Mensagens Rápidas', url: 'https://chat.example.com/', group: 'messaging' },
	{ name: 'Mail', url: 'https://mail.example.org/inbox', group: 'mail' }
];

test('finds an entry by its name, ignoring case and accents', () => {
	assert.deepEqual(matchCatalogue('RAPIDAS', sample).map(entry => entry.name), ['Mensagens Rápidas']);
});

test('finds an entry by its address, with or without the scheme', () => {
	assert.deepEqual(matchCatalogue('example.org', sample).map(entry => entry.name), ['Mail']);
	assert.deepEqual(matchCatalogue('https://chat.ex', sample).map(entry => entry.name), ['Mensagens Rápidas']);
});

test('lists everything for an empty search, and nothing for an address it does not have', () => {
	assert.equal(matchCatalogue('  ', sample).length, 2);
	assert.deepEqual(matchCatalogue('intranet.local', sample), []);
});

test('reads the icons a page links to as absolute addresses, then /favicon.ico', () => {
	const html = `<head>
		<link rel="stylesheet" href="/style.css">
		<link rel="shortcut icon" href="/static/icon.png">
		<link href='https://cdn.example.net/icon-192.png' rel='icon' sizes='192x192'>
		<link rel=apple-touch-icon href=touch.png>
	</head>`;
	assert.deepEqual(iconLinksFrom(html, 'https://app.example.com/client/'), [
		'https://app.example.com/static/icon.png',
		'https://cdn.example.net/icon-192.png',
		'https://app.example.com/client/touch.png',
		'https://app.example.com/favicon.ico'
	]);
});

test('falls back to /favicon.ico on a page that links to no icon', () => {
	assert.deepEqual(iconLinksFrom('<html></html>', 'https://example.com/a/b'), ['https://example.com/favicon.ico']);
});
