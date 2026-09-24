import type { Server } from 'node:http';
import { test, expect } from '@playwright/test';
import type { ServiceState } from '../../src/shared/service.ts';
import type { AppState } from '../../src/shared/channels.ts';
import { launchShep, closeShep, inService, serviceRecord, type Shep } from './helpers/launch.ts';
import { serveFixtures } from './helpers/server.ts';

let shep: Shep;
let server: Server;
let at: Awaited<ReturnType<typeof serveFixtures>>['at'];

const list = () => shep.window.evaluate(() => window.shep.invoke('services:list')) as Promise<ServiceState[]>;
const state = () => shep.window.evaluate(() => window.shep.invoke('app:state')) as Promise<AppState>;
const rail = () => shep.window.locator('.rail .service').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')));
const press = (keyCode: string, modifiers: string[]) => shep.app.evaluate(({ BrowserWindow }, { keyCode, modifiers }) => {
	const contents = BrowserWindow.getAllWindows()[0]?.webContents;
	contents?.sendInputEvent({ type: 'keyDown', keyCode, modifiers: modifiers as Electron.InputEvent['modifiers'] });
	contents?.sendInputEvent({ type: 'keyUp', keyCode, modifiers: modifiers as Electron.InputEvent['modifiers'] });
}, { keyCode, modifiers });
const inOverlay = <T>(expression: string) => shep.app.evaluate(async ({ webContents }, expression) =>
	webContents.getAllWebContents().find(contents => contents.getURL().endsWith('#overlay'))?.executeJavaScript(expression), expression) as Promise<T>;

test.beforeAll(async () => {
	({ server, at } = await serveFixtures());
	shep = await launchShep({
		store: {
			services: [
				serviceRecord('1', at('127.0.0.1', '/service.html'), { name: 'Mail', workspace: 'w1' }),
				serviceRecord('2', at('127.0.0.1', '/away.html'), { name: 'Family', workspace: 'w2' }),
				serviceRecord('3', at('127.0.0.1', '/long.html'), { name: 'Chat', workspace: '' })
			],
			workspaces: [{ id: 'w1', name: 'Work', hue: 'blue' }, { id: 'w2', name: 'Personal', hue: 'green' }],
			activeWorkspace: null,
			activeServiceId: '2'
		}
	});
	await expect.poll(async () => (await list()).find(service => service.id === '2')?.pageTitle).toBe('Somewhere else');
});

test.afterAll(async () => {
	await closeShep(shep);
	server.close();
});

test('shows every service under All Services', async () => {
	await expect.poll(rail).toEqual(['Mail', 'Family', 'Chat']);
	await expect(shep.window.locator('.switcher')).toHaveAttribute('aria-label', 'Workspaces: All Services');
});

test('shows a workspace\'s services and the ones in no workspace, and moves off a service it hides', async () => {
	await press('1', ['control', 'alt']);
	await expect.poll(rail).toEqual(['Mail', 'Chat']);
	await expect(shep.window.locator('.switcher')).toHaveAttribute('aria-label', 'Workspaces: Work');
	expect((await list()).find(service => service.active)?.name).toBe('Mail');
});

test('keeps a hidden service counting, and marks the switcher when it has something unread', async () => {
	await inService(shep, at('127.0.0.1', '/away.html'), 'document.title = "(2) Somewhere else"');
	await expect(shep.window.locator('.switcher .dot')).toBeVisible();
	await inService(shep, at('127.0.0.1', '/away.html'), 'document.title = "Somewhere else"');
	await expect(shep.window.locator('.switcher .dot')).toHaveCount(0, { timeout: 5000 });
});

test('gives All Services the number after the last workspace', async () => {
	await press('3', ['control', 'alt']);
	await expect.poll(async () => (await state()).activeWorkspace).toBe(null);
	await expect.poll(rail).toEqual(['Mail', 'Family', 'Chat']);
});

test('creates a workspace from its dialog and puts it on screen', async () => {
	await shep.window.evaluate(() => window.shep.invoke('overlay:open', { dialog: 'workspace', workspaceId: null }));
	await expect.poll(() => inOverlay<boolean>('!!document.querySelector("form input[name=name]")')).toBe(true);
	await inOverlay(`(() => { const field = document.querySelector('input[name=name]'); field.value = 'Side project'; field.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('form').requestSubmit(); })()`);
	await expect.poll(async () => (await state()).workspaces.map(workspace => workspace.name)).toEqual(['Work', 'Personal', 'Side project']);
	await expect(shep.window.locator('.switcher')).toHaveAttribute('aria-label', 'Workspaces: Side project');
	await expect.poll(rail).toEqual(['Chat']);
});

test('adds a new service to the workspace on screen', async () => {
	await shep.window.evaluate(() => window.shep.invoke('overlay:open', { dialog: 'add' }));
	await expect.poll(() => inOverlay<string>('document.querySelector("select[name=workspace]")?.selectedOptions[0]?.textContent ?? ""')).toBe('Side project');
	await inOverlay(`(() => { const field = document.querySelector('input[name=address]'); field.value = ${JSON.stringify(at('localhost', '/long.html'))}; field.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('form').requestSubmit(); })()`);
	await expect.poll(rail).toEqual(['Chat', 'Localhost']);
});

test('moves a service to another workspace from its Edit window', async () => {
	await shep.window.evaluate(() => window.shep.invoke('overlay:open', { dialog: 'edit', serviceId: '3' }));
	await expect.poll(() => inOverlay<string>('document.querySelector("input[name=address]").value')).toContain('long.html');
	await inOverlay(`(() => { const select = document.querySelector('select[name=workspace]'); select.value = 'w1'; select.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('form').requestSubmit(); })()`);
	await expect.poll(rail).toEqual(['Localhost']);
});
