import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyWindowOpen, isPopupRequested, isReturnToService } from '../../src/main/links.ts';

test('a link to any site opens in an auxiliary window, not the browser', () => {
	assert.equal(classifyWindowOpen('https://example.com/article', ''), 'window');
	assert.equal(classifyWindowOpen('https://mail.google.com/mail/u/0/#inbox/1', ''), 'window');
});

test('a sized window.open stays a popup, which an OAuth opener waits on', () => {
	assert.equal(classifyWindowOpen('https://accounts.google.com/o/oauth2/auth', 'width=500,height=600'), 'popup');
	assert.equal(classifyWindowOpen('https://login.example.org/realms/acme/protocol/openid-connect/auth', 'popup'), 'popup');
});

test('about:blank is left for the page to fill', () => {
	assert.equal(classifyWindowOpen('about:blank', ''), 'blank');
	assert.equal(classifyWindowOpen('about:blank#blocked', 'width=800'), 'blank');
});

test('mail and phone links go to the system, and deep links into native apps are dropped', () => {
	assert.equal(classifyWindowOpen('mailto:someone@example.com', ''), 'external');
	assert.equal(classifyWindowOpen('tel:+5511999999999', ''), 'external');
	assert.equal(classifyWindowOpen('slack://channel?team=T1', ''), 'drop');
	assert.equal(classifyWindowOpen('not a url', ''), 'drop');
});

test('a bare window.open is not a popup, and a sized one is', () => {
	assert.equal(isPopupRequested(''), false);
	assert.equal(isPopupRequested(undefined), false);
	assert.equal(isPopupRequested('width=800,height=600'), true);
	assert.equal(isPopupRequested('left=0, top=0'), true);
});

test('noopener says nothing about the window, and the popup feature decides on its own', () => {
	assert.equal(isPopupRequested('noopener'), false);
	assert.equal(isPopupRequested('noopener,width=800'), true);
	assert.equal(isPopupRequested('popup'), true);
	assert.equal(isPopupRequested('popup=0,width=800'), false);
});

test('asking for browser chrome asks for a tab', () => {
	assert.equal(isPopupRequested('location,toolbar'), false);
	assert.equal(isPopupRequested('menubar=yes'), false);
	assert.equal(isPopupRequested('resizable=no,menubar=yes'), false);
});

test('a sign-in that left the service and comes back returns to the service', () => {
	assert.equal(isReturnToService('https://acme.slack.com/', 'https://acme.okta.com/login', 'https://acme.slack.com/sso/saml?code=1'), true);
	assert.equal(isReturnToService('https://mail.google.com/mail/u/0/', 'https://accounts.google.com/v3/signin/identifier', 'https://mail.google.com/mail/u/0/'), true);
});

test('a window that never left the service, or goes elsewhere, is not a return', () => {
	assert.equal(isReturnToService('https://mail.google.com/mail/u/0/', 'https://mail.google.com/mail/u/0/?view=pt', 'https://mail.google.com/mail/u/0/?view=pt&search=1'), false);
	assert.equal(isReturnToService('https://mail.google.com/mail/u/0/', 'https://docs.google.com/document/d/1', 'https://docs.google.com/document/d/1/edit'), false);
});

test('a blank window the page fills has not left the service', () => {
	assert.equal(isReturnToService('https://mail.google.com/mail/u/0/', 'about:blank', 'https://mail.google.com/mail/u/0/?view=print'), false);
});
