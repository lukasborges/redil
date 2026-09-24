import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messagesFor } from '../../src/shared/i18n.ts';

test('falls back from a regional locale to its language, then to English', () => {
	assert.equal(messagesFor('en-GB')['welcome.title'], 'Welcome to Shep');
	assert.equal(messagesFor('xx')['welcome.title'], 'Welcome to Shep');
});
