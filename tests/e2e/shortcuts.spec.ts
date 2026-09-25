import type { Server } from 'node:http';
import { test, expect } from '@playwright/test';
import type { ServiceState } from '../../src/shared/service.ts';
import { launchShep, closeShep, inService, serviceRecord, type Shep } from './helpers/launch.ts';
import { serveFixtures } from './helpers/server.ts';

let shep: Shep;
let server: Server;
let at: Awaited<ReturnType<typeof serveFixtures>>['at'];

const first = () => at('127.0.0.1', '/service.html');
const second = () => at('127.0.0.1', '/long.html');
const list = () => shep.window.evaluate(() => window.shep.invoke('services:list')) as Promise<ServiceState[]>;
const activeName = async () => (await list()).find(service => service.active)?.name;
const press = (urlPrefix: string, keyCode: string, modifiers: string[]) => shep.app.evaluate(({ webContents }, { urlPrefix, keyCode, modifiers }) => {
	const contents = webContents.getAllWebContents().find(candidate => candidate.getURL().startsWith(urlPrefix));
	contents?.sendInputEvent({ type: 'keyDown', keyCode, modifiers: modifiers as Electron.InputEvent['modifiers'] });
	contents?.sendInputEvent({ type: 'keyUp', keyCode, modifiers: modifiers as Electron.InputEvent['modifiers'] });
}, { urlPrefix, keyCode, modifiers });
const loaded = (url: string) => shep.app.evaluate(({ webContents }, url) => webContents.getAllWebContents().some(contents => contents.getURL() === url && !contents.isLoading()), url);

test.beforeAll(async () => {
	({ server, at } = await serveFixtures());
	shep = await launchShep({
		store: {
			services: [serviceRecord('1', first(), { name: 'First', notifications: true, muted: false }), serviceRecord('2', second(), { name: 'Second', notifications: true, muted: false })],
			activeServiceId: '1'
		}
	});
	await expect.poll(() => loaded(first())).toBe(true);
	await expect.poll(() => loaded(second())).toBe(true);
});

test.afterAll(async () => {
	await closeShep(shep);
	server.close();
});

test('picks a service with Ctrl and its number, typed while another service has the keyboard', async () => {
	await press(first(), '2', ['control']);
	await expect.poll(activeName).toBe('Second');
	await press(second(), '1', ['control']);
	await expect.poll(activeName).toBe('First');
});

test('cycles through the services with Ctrl+Tab and back with Ctrl+Shift+Tab', async () => {
	await press(first(), 'Tab', ['control']);
	await expect.poll(activeName).toBe('Second');
	await press(second(), 'Tab', ['control', 'shift']);
	await expect.poll(activeName).toBe('First');
});

test('opens find in page with Ctrl+F from inside the service', async () => {
	await press(first(), 'F', ['control']);
	await expect(shep.window.locator('.titlebar input[type="search"]')).toBeVisible();
	await shep.window.locator('.titlebar input[type="search"]').press('Escape');
});

test('zooms the active service with Ctrl+= and resets it with Ctrl+0, keeping the level', async () => {
	const zoom = () => shep.app.evaluate(({ webContents }, url) => webContents.getAllWebContents().find(contents => contents.getURL() === url)?.getZoomLevel(), first());
	await press(first(), '=', ['control']);
	await expect.poll(zoom).toBe(0.25);
	await press(first(), '0', ['control']);
	await expect.poll(zoom).toBe(0);
});

test('shows a zoom other than 100% in the title bar, and a click there resets it', async () => {
	const indicator = shep.window.locator('.titlebar button[aria-label="Actual Size"]');
	await expect(indicator).toBeHidden();
	await press(first(), '=', ['control']);
	await expect(indicator).toHaveText('105%');
	await indicator.click();
	await expect(indicator).toBeHidden();
});

test('lets a service notify, and a click on its notification brings it forward', async () => {
	expect(await inService<boolean>(shep, second(), '!!window.__shepNotifications && window.shepService.mayNotify()')).toBe(true);
	await inService(shep, second(), 'window.shepService.notificationClicked()');
	await expect.poll(activeName).toBe('Second');
});

test('mutes every service and holds back notifications while Don\'t Disturb is on', async () => {
	const muted = () => shep.app.evaluate(({ webContents }, urls) =>
		webContents.getAllWebContents().filter(contents => urls.includes(contents.getURL())).map(contents => contents.isAudioMuted()), [first(), second()]);
	const bell = shep.window.locator('.rail .tool[aria-label="Don\'t Disturb"]');

	await bell.click();
	await expect(bell).toHaveAttribute('aria-pressed', 'true');
	await expect.poll(muted).toEqual([true, true]);
	expect(await inService<boolean>(shep, first(), 'window.shepService.mayNotify()')).toBe(false);

	await press(first(), 'D', ['alt', 'shift']);
	await expect(bell).toHaveAttribute('aria-pressed', 'false');
	await expect.poll(muted).toEqual([false, false]);
	expect(await inService<boolean>(shep, first(), 'window.shepService.mayNotify()')).toBe(true);
});
