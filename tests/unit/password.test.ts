import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, matchesPassword } from '../../src/main/password.ts';

test('keeps a salted hash rather than the password, and matches only the right password', () => {
	const stored = hashPassword('sheepdog');
	assert.equal(stored.includes('sheepdog'), false);
	assert.notEqual(hashPassword('sheepdog'), stored);
	assert.equal(matchesPassword('sheepdog', stored), true);
	assert.equal(matchesPassword('wolf', stored), false);
	assert.equal(matchesPassword('sheepdog', 'not a hash'), false);
});
