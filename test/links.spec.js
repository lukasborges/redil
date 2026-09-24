const { test, expect } = require('@playwright/test');
const path = require('path');
const { repoRoot } = require('./helpers/launch');

const { classifyWindowOpen, isReturnToService } = require(path.join(repoRoot, 'electron', 'links.js'));

test('a link to any site opens in an auxiliary window, not the browser', () => {
	expect(classifyWindowOpen({ url: 'https://example.com/article', features: '' })).toBe('window');
	expect(classifyWindowOpen({ url: 'https://mail.google.com/mail/u/0/#inbox/1', features: '' })).toBe('window');
});

test('a sized window.open stays a popup, which an OAuth opener waits on', () => {
	expect(classifyWindowOpen({ url: 'https://accounts.google.com/o/oauth2/auth', features: 'width=500,height=600' })).toBe('popup');
	expect(classifyWindowOpen({ url: 'https://login.example.org/realms/acme/protocol/openid-connect/auth', features: 'popup' })).toBe('popup');
});

test('about:blank is left for the page to fill', () => {
	expect(classifyWindowOpen({ url: 'about:blank', features: '' })).toBe('blank');
	expect(classifyWindowOpen({ url: 'about:blank#blocked', features: 'width=800' })).toBe('blank');
});

test('mail and phone links go to the system, and deep links into native apps are dropped', () => {
	expect(classifyWindowOpen({ url: 'mailto:someone@example.com', features: '' })).toBe('external');
	expect(classifyWindowOpen({ url: 'tel:+5511999999999', features: '' })).toBe('external');
	expect(classifyWindowOpen({ url: 'slack://channel?team=T1', features: '' })).toBe('drop');
	expect(classifyWindowOpen({ url: 'not a url', features: '' })).toBe('drop');
});

test('a sign-in that left the service and comes back returns to the service', () => {
	expect(isReturnToService({
		 serviceUrl: 'https://acme.slack.com/'
		,fromUrl: 'https://acme.okta.com/login'
		,toUrl: 'https://acme.slack.com/sso/saml?code=1'
	})).toBe(true);
	expect(isReturnToService({
		 serviceUrl: 'https://mail.google.com/mail/u/0/'
		,fromUrl: 'https://accounts.google.com/v3/signin/identifier'
		,toUrl: 'https://mail.google.com/mail/u/0/'
	})).toBe(true);
});

test('a window that never left the service, or goes elsewhere, is not a return', () => {
	expect(isReturnToService({
		 serviceUrl: 'https://mail.google.com/mail/u/0/'
		,fromUrl: 'https://mail.google.com/mail/u/0/?view=pt'
		,toUrl: 'https://mail.google.com/mail/u/0/?view=pt&search=1'
	})).toBe(false);
	expect(isReturnToService({
		 serviceUrl: 'https://mail.google.com/mail/u/0/'
		,fromUrl: 'https://docs.google.com/document/d/1'
		,toUrl: 'https://docs.google.com/document/d/1/edit'
	})).toBe(false);
});

test('a blank window the page fills has not left the service', () => {
	expect(isReturnToService({
		 serviceUrl: 'https://mail.google.com/mail/u/0/'
		,fromUrl: 'about:blank'
		,toUrl: 'https://mail.google.com/mail/u/0/?view=print'
	})).toBe(false);
});
