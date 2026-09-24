import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptPreference } from '../../src/shared/preferences.ts';

test('accepts a choice only from its list', () => {
	assert.equal(acceptPreference('theme', 'dark'), 'dark');
	assert.equal(acceptPreference('theme', 'sepia'), null);
	assert.equal(acceptPreference('language', 'pt-BR'), 'pt-BR');
	assert.equal(acceptPreference('closeBehaviour', 'minimize'), null);
});

test('accepts a switch only as true or false, and a text trimmed', () => {
	assert.equal(acceptPreference('alwaysOnTop', true), true);
	assert.equal(acceptPreference('alwaysOnTop', 'yes'), null);
	assert.equal(acceptPreference('proxyHost', '  proxy.local '), 'proxy.local');
	assert.equal(acceptPreference('proxyHost', 3), null);
});

test('accepts a proxy port only in the range a port can be', () => {
	assert.equal(acceptPreference('proxyPort', '3128'), 3128);
	assert.equal(acceptPreference('proxyPort', 0), null);
	assert.equal(acceptPreference('proxyPort', 70000), null);
	assert.equal(acceptPreference('proxyPort', 'eighty'), null);
});

test('accepts the spelling languages as a list of names', () => {
	assert.deepEqual(acceptPreference('spellcheckLanguages', ['en-US', 'pt-BR']), ['en-US', 'pt-BR']);
	assert.equal(acceptPreference('spellcheckLanguages', 'en-US'), null);
});
