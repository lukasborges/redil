import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortcutFor, type KeyInput } from '../../src/main/shortcuts.ts';

const press = (key: string, modifiers: Partial<KeyInput> = {}, platform: NodeJS.Platform = 'linux') =>
	shortcutFor({ type: 'keyDown', key, control: false, shift: false, alt: false, meta: false, ...modifiers }, platform);
const onMac = (key: string, modifiers: Partial<KeyInput> = {}) => press(key, modifiers, 'darwin');

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
	assert.equal(shortcutFor({ type: 'keyUp', key: 'f', control: true, shift: false, alt: false, meta: false }, 'linux'), null);
});

test('on a Mac, takes Command where Control is taken elsewhere', () => {
	assert.deepEqual(onMac('3', { meta: true }), { action: 'service', index: 2 });
	assert.deepEqual(onMac('f', { meta: true }), { action: 'find' });
	assert.deepEqual(onMac('R', { meta: true, shift: true }), { action: 'reload', ignoringCache: true });
	assert.deepEqual(onMac('=', { meta: true }), { action: 'zoom', step: 1 });
	assert.deepEqual(onMac(',', { meta: true }), { action: 'preferences' });
	assert.deepEqual(onMac('q', { meta: true }), { action: 'quit' });
	assert.equal(onMac('3', { control: true }), null);
	assert.equal(onMac('c', { meta: true }), null);
});

test('on a Mac, reads a key pressed with Option from where it sits, since Option turns it into another character', () => {
	assert.deepEqual(onMac('¡', { meta: true, alt: true, code: 'Digit1' }), { action: 'workspace', index: 0 });
	assert.deepEqual(onMac('ˆ', { meta: true, alt: true, code: 'KeyI' }), { action: 'developerTools' });
	assert.deepEqual(onMac('Î', { alt: true, shift: true, code: 'KeyD' }), { action: 'dontDisturb' });
	assert.deepEqual(onMac('Ò', { alt: true, shift: true, code: 'KeyL' }), { action: 'lock' });
});

test('on a Mac, leaves the arrows to the caret: history is on the brackets, and full screen is Control+Command+F', () => {
	assert.equal(onMac('ArrowLeft', { alt: true }), null);
	assert.equal(onMac('ArrowLeft', { meta: true }), null);
	assert.deepEqual(onMac('[', { meta: true }), { action: 'history', direction: 'back' });
	assert.deepEqual(onMac(']', { meta: true }), { action: 'history', direction: 'forward' });
	assert.deepEqual(onMac('{', { meta: true, shift: true }), { action: 'cycle', step: -1 });
	assert.deepEqual(onMac('}', { meta: true, shift: true }), { action: 'cycle', step: 1 });
	assert.deepEqual(onMac('Tab', { control: true }), { action: 'cycle', step: 1 });
	assert.deepEqual(onMac('f', { control: true, meta: true }), { action: 'fullscreen' });
	assert.equal(onMac('F11'), null);
});
