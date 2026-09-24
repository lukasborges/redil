import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortcutFor, type KeyInput } from '../../src/main/shortcuts.ts';

const press = (key: string, modifiers: Partial<KeyInput> = {}) =>
	shortcutFor({ type: 'keyDown', key, control: false, shift: false, alt: false, meta: false, ...modifiers });

test('picks a service with Ctrl and its number, and a workspace with Ctrl, Alt and its number', () => {
	assert.deepEqual(press('3', { control: true }), { action: 'service', index: 2 });
	assert.deepEqual(press('2', { control: true, alt: true }), { action: 'workspace', index: 1 });
});

test('cycles services with Ctrl+Tab and Ctrl+Page Down, backwards with Shift or Page Up', () => {
	assert.deepEqual(press('Tab', { control: true }), { action: 'cycle', step: 1 });
	assert.deepEqual(press('Tab', { control: true, shift: true }), { action: 'cycle', step: -1 });
	assert.deepEqual(press('PageUp', { control: true }), { action: 'cycle', step: -1 });
});

test('keeps the browser\'s own keys for the page: find, reload, zoom, history, full screen', () => {
	assert.deepEqual(press('f', { control: true }), { action: 'find' });
	assert.deepEqual(press('r', { control: true }), { action: 'reload', ignoringCache: false });
	assert.deepEqual(press('R', { control: true, shift: true }), { action: 'reload', ignoringCache: true });
	assert.deepEqual(press('F5'), { action: 'reload', ignoringCache: false });
	assert.deepEqual(press('=', { control: true }), { action: 'zoom', step: 1 });
	assert.deepEqual(press('+', { control: true, shift: true }), { action: 'zoom', step: 1 });
	assert.deepEqual(press('-', { control: true }), { action: 'zoom', step: -1 });
	assert.deepEqual(press('0', { control: true }), { action: 'zoom', step: 0 });
	assert.deepEqual(press('ArrowLeft', { alt: true }), { action: 'history', direction: 'back' });
	assert.deepEqual(press('F11'), { action: 'fullscreen' });
	assert.deepEqual(press('I', { control: true, shift: true }), { action: 'developerTools' });
});

test('has keys for the app itself: preferences, a new service, don\'t disturb, lock and quit', () => {
	assert.deepEqual(press(',', { control: true }), { action: 'preferences' });
	assert.deepEqual(press('n', { control: true }), { action: 'addService' });
	assert.deepEqual(press('D', { alt: true, shift: true }), { action: 'dontDisturb' });
	assert.deepEqual(press('L', { alt: true, shift: true }), { action: 'lock' });
	assert.deepEqual(press('q', { control: true }), { action: 'quit' });
});

test('lets every other key through to the page, and ignores key releases', () => {
	assert.equal(press('a', { control: true }), null);
	assert.equal(press('c', { control: true }), null);
	assert.equal(press('Tab'), null);
	assert.equal(shortcutFor({ type: 'keyUp', key: 'f', control: true, shift: false, alt: false, meta: false }), null);
});
