const { test, expect } = require('@playwright/test');
const path = require('path');
const { repoRoot } = require('./helpers/launch');

const { isPopupRequested } = require(path.join(repoRoot, 'electron', 'popup.js'));

test('a bare window.open is not a popup', () => {
	expect(isPopupRequested('')).toBe(false);
	expect(isPopupRequested(undefined)).toBe(false);
});

test('a sized window is a popup', () => {
	expect(isPopupRequested('width=800,height=600')).toBe(true);
	expect(isPopupRequested('left=0, top=0')).toBe(true);
});

test('noopener says nothing about the window', () => {
	expect(isPopupRequested('noopener')).toBe(false);
	expect(isPopupRequested('noopener,width=800')).toBe(true);
});

test('the popup feature decides on its own', () => {
	expect(isPopupRequested('popup')).toBe(true);
	expect(isPopupRequested('popup=0,width=800')).toBe(false);
});

test('asking for browser chrome asks for a tab', () => {
	expect(isPopupRequested('location,toolbar')).toBe(false);
	expect(isPopupRequested('menubar=yes')).toBe(false);
	expect(isPopupRequested('resizable=no,menubar=yes')).toBe(false);
});
