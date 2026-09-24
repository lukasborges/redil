import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameFromUrl, normalizeUrl } from '../../src/shared/address.ts';

test('puts https:// in front of an address typed without a scheme, and refuses what is not a web address', () => {
	const typed = ['web.whatsapp.com', 'https://claude.ai/new', 'http://localhost:8065', 'ftp://example.com', 'intranet', ''];
	assert.deepEqual(typed.map(normalizeUrl), ['https://web.whatsapp.com/', 'https://claude.ai/new', 'http://localhost:8065/', null, null, null]);
});

test('names a service after its site and a subdomain that says something', () => {
	const addresses = ['https://web.whatsapp.com/', 'https://chat.google.com/', 'https://mail.google.com/', 'https://claude.ai/', 'https://www.bbc.co.uk/', 'https://acme.slack.com/', 'http://localhost:9/', 'http://192.168.0.10:8065/'];
	assert.deepEqual(addresses.map(nameFromUrl), ['Whatsapp', 'Google Chat', 'Google Mail', 'Claude', 'Bbc', 'Slack Acme', 'Localhost', '192.168.0.10']);
});
