import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Session } from 'electron';
import { stripChromeVersionFromGoogleSignInHeader, withoutChromeVersion } from '../../src/main/googlesignin.ts';

const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.130 Safari/537.36';

type Listener = (details: { requestHeaders: Record<string, string> }, callback: (response: { requestHeaders: Record<string, string> }) => void) => void;

function listenerFor(): { filter: { urls: string[] }; listener: Listener } {
	let installed: { filter: { urls: string[] }; listener: Listener } | undefined;
	const session = { webRequest: { onBeforeSendHeaders: (filter: { urls: string[] }, listener: Listener) => { installed = { filter, listener }; } } };
	stripChromeVersionFromGoogleSignInHeader(session as unknown as Session);
	assert.ok(installed);
	return installed;
}

test('drops the version from the Chrome token and keeps the rest of the agent', () => {
	assert.equal(withoutChromeVersion(CHROME), 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36');
});

test('leaves an agent with no Chrome version as it is', () => {
	assert.equal(withoutChromeVersion('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'), 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0');
});

test('rewrites only the User-Agent header of requests to Google\'s sign-in, whatever its case', () => {
	const { filter, listener } = listenerFor();
	assert.deepEqual(filter.urls, ['https://accounts.google.com/*']);
	let sent: Record<string, string> = {};
	listener({ requestHeaders: { 'user-agent': CHROME, Accept: '*/*' } }, response => { sent = response.requestHeaders; });
	assert.deepEqual(sent, { 'user-agent': withoutChromeVersion(CHROME), Accept: '*/*' });
});
