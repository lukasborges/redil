import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGUES, fill, messagesFor } from '../../src/shared/i18n/index.ts';
import { en } from '../../src/shared/i18n/en.ts';
import { LANGUAGES } from '../../src/shared/preferences.ts';

const placeholders = (message: string) => [...message.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('has a catalogue for every language Preferences offers', () => {
	for ( const language of LANGUAGES.filter(language => language !== 'auto') ) assert.ok(CATALOGUES[language], 'no catalogue for ' + language);
});

test('translates every English string, keeping its placeholders', () => {
	for ( const [language, messages] of Object.entries(CATALOGUES) ) {
		assert.deepEqual(Object.keys(messages).sort(), Object.keys(en).sort(), language + ' keys');
		for ( const [key, english] of Object.entries(en) ) {
			const translated = messages[key as keyof typeof en];
			assert.ok(translated.trim(), `${language} ${key} is empty`);
			assert.deepEqual(placeholders(translated), placeholders(english), `${language} ${key} placeholders`);
		}
	}
});

test('falls back from a regional locale to its language, then to English', () => {
	assert.equal(messagesFor('pt-BR'), CATALOGUES['pt-BR']);
	assert.equal(messagesFor('de-AT'), CATALOGUES.de);
	assert.equal(messagesFor('zh-CN'), CATALOGUES['zh-CN']);
	assert.equal(messagesFor('en-GB'), en);
	assert.equal(messagesFor('pt-PT'), CATALOGUES['pt-BR']);
	assert.equal(messagesFor('xx'), en);
});

test('fills placeholders and leaves an unknown one as written', () => {
	assert.equal(fill('Remove {name}?', { name: 'Gmail' }), 'Remove Gmail?');
	assert.equal(fill('Version {version}', {}), 'Version {version}');
});
