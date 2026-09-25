import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spellingLanguages } from '../../src/main/spelling.ts';
import { whatClosingDoes } from '../../src/main/closing.ts';

const available = ['en-US', 'en-GB', 'pt-BR', 'es', 'de-DE'];

test('uses the spelling languages picked in Preferences that have a dictionary', () => {
	assert.deepEqual(spellingLanguages(['pt-BR', 'xx-YY'], available, ['de_DE.UTF-8']), ['pt-BR']);
});

test('works them out from the app\'s language, the desktop\'s and LANG, then English, three at most', () => {
	assert.deepEqual(spellingLanguages([], available, ['pt-BR', 'es_ES', 'de_DE.UTF-8']), ['pt-BR', 'es', 'de-DE']);
	assert.deepEqual(spellingLanguages([], available, ['pt', 'C']), ['pt-BR', 'en-US']);
	assert.deepEqual(spellingLanguages([], available, []), ['en-US']);
});

test('hides the window on close only when there is a tray icon to bring it back', () => {
	assert.equal(whatClosingDoes('tray', true, false), 'hide');
	assert.equal(whatClosingDoes('tray', false, false), 'quit');
	assert.equal(whatClosingDoes('quit', true, false), 'quit');
	assert.equal(whatClosingDoes('tray', true, true), 'quit');
});
