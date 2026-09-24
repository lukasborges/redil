import type { Server } from 'node:http';
import { test, expect } from '@playwright/test';
import type { ServiceState } from '../../src/shared/service.ts';
import { launchShep, closeShep, inService, serviceRecord, type Shep } from './helpers/launch.ts';
import { serveFixtures } from './helpers/server.ts';

let shep: Shep;
let server: Server;
let at: Awaited<ReturnType<typeof serveFixtures>>['at'];

const list = () => shep.window.evaluate(() => window.shep.invoke('services:list')) as Promise<ServiceState[]>;
const byId = async (id: string) => (await list()).find(service => service.id === id);
const inOverlay = <T>(expression: string) => shep.app.evaluate(async ({ webContents }, expression) => {
	const overlay = webContents.getAllWebContents().find(contents => contents.getURL().endsWith('#overlay'));
	if ( !overlay ) throw new Error('No overlay');
	return overlay.executeJavaScript(expression);
}, expression) as Promise<T>;
const overlayShown = () => shep.app.evaluate(({ BrowserWindow }) =>
	BrowserWindow.getAllWindows()[0]?.contentView.children.some(view => (view as unknown as { webContents: Electron.WebContents }).webContents.getURL().endsWith('#overlay') && view.getVisible()) ?? false);
const typeInto = (selector: string, value: string) => inOverlay(`(() => {
	const field = document.querySelector(${JSON.stringify(selector)});
	field.value = ${JSON.stringify(value)};
	field.dispatchEvent(new Event('input', { bubbles: true }));
})()`);

test.beforeAll(async () => {
	({ server, at } = await serveFixtures());
	shep = await launchShep({
		store: {
			services: [serviceRecord('1', at('127.0.0.1', '/service.html'), { name: 'First' }), serviceRecord('2', at('127.0.0.1', '/long.html'), { name: 'Second' })],
			activeServiceId: '1'
		}
	});
	await expect.poll(async () => (await byId('2'))?.pageTitle).toBe('(120) Long page');
});

test.afterAll(async () => {
	await closeShep(shep);
	server.close();
});

test('draws the unread count as a badge on the icon, capped at 99+, and a dot for something uncounted', async () => {
	const badge = (name: string) => shep.window.locator(`.rail .service[aria-label="${name}"] .badge`);
	await expect(badge('Second')).toHaveText('99+');
	await inService(shep, at('127.0.0.1', '/service.html'), 'document.title = "(•) Fixture service"');
	await expect(badge('First')).toHaveClass(/dot/);
	await inService(shep, at('127.0.0.1', '/service.html'), 'document.title = "(3) Fixture service"');
	await expect(badge('First')).toHaveText('3');
	await inService(shep, at('127.0.0.1', '/service.html'), 'document.title = "Fixture service"');
	await expect(badge('First')).toHaveCount(0, { timeout: 5000 });
});

test('shows the active service\'s name and page title in the title bar, and its history in the buttons', async () => {
	await expect(shep.window.locator('.titlebar .identity b')).toHaveText('First');
	await expect(shep.window.locator('.titlebar button[aria-label="Back"]')).toBeDisabled();
	await inService(shep, at('127.0.0.1', '/service.html'), `location.href = ${JSON.stringify(at('127.0.0.1', '/away.html?from=title-bar'))}`, { userGesture: true });
	await expect(shep.window.locator('.titlebar .identity .detail')).toHaveText('Somewhere else');
	await expect(shep.window.locator('.titlebar button[aria-label="Back"]')).toBeEnabled();
	await shep.window.locator('.titlebar button[aria-label="Back"]').click();
	await expect(shep.window.locator('.titlebar .identity .detail')).toHaveText('Fixture service');
});

test('finds text in the active page and counts the matches', async () => {
	await shep.window.locator('.rail .service[aria-label="Second"]').click();
	await expect(shep.window.locator('.titlebar .identity b')).toHaveText('Second');
	await shep.window.locator('.titlebar button[aria-label="Find in page"]').click();
	await shep.window.locator('.titlebar input[type="search"]').fill('sheepdog');
	await expect(shep.window.locator('.titlebar .matches')).toHaveText('1/3');
	await shep.window.locator('.titlebar input[type="search"]').press('Escape');
	await expect(shep.window.locator('.titlebar input[type="search"]')).toHaveCount(0);
});

test('adds a service from the address typed behind the +, naming it after the site', async () => {
	await shep.window.locator('.rail .add').click();
	await expect.poll(overlayShown).toBe(true);
	await typeInto('input[name="address"]', at('localhost', '/away.html').replace('http://', ''));
	await inOverlay('document.querySelector("form").requestSubmit()');
	await expect.poll(overlayShown).toBe(false);
	const added = (await list()).at(-1);
	expect(added).toMatchObject({ name: 'Localhost', active: true });
	await expect(shep.window.locator('.rail .service[aria-label="Localhost"]')).toHaveAttribute('aria-current', 'page');
});

test('refuses an address that is not a web address, and keeps the dialog open', async () => {
	await shep.window.locator('.rail .add').click();
	await expect.poll(overlayShown).toBe(true);
	await typeInto('input[name="address"]', 'intranet');
	await inOverlay('document.querySelector("form").requestSubmit()');
	await expect.poll(() => inOverlay<string>('document.querySelector("[role=alert]")?.textContent ?? ""')).toContain('Type the address');
	await shep.app.evaluate(({ webContents }) => {
		const overlay = webContents.getAllWebContents().find(contents => contents.getURL().endsWith('#overlay'));
		overlay?.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
	});
	await expect.poll(overlayShown).toBe(false);
});

test('edits a service\'s name in the dialog its menu opens, with the address already filled in', async () => {
	await shep.window.evaluate(() => window.shep.invoke('overlay:open', { dialog: 'edit', serviceId: '1' }));
	await expect.poll(() => inOverlay<string>('document.querySelector("input[name=address]").value')).toBe(at('127.0.0.1', '/service.html'));
	await typeInto('input[name="name"]', 'Renamed');
	await inOverlay('document.querySelector("form").requestSubmit()');
	await expect.poll(async () => (await byId('1'))?.name).toBe('Renamed');
});

test('keeps the order the rail was dragged into', async () => {
	const ids = (await list()).map(service => service.id);
	await shep.window.evaluate(order => window.shep.invoke('services:reorder', order), [...ids].reverse());
	await expect.poll(async () => (await list()).map(service => service.id)).toEqual([...ids].reverse());
	const saved = await shep.app.evaluate(({ app }) => {
		const fs = process.getBuiltinModule('node:fs');
		return fs.readFileSync(app.getPath('userData') + '/shep.json', 'utf8');
	});
	expect((JSON.parse(saved) as { services: { id: string }[] }).services.map(service => service.id)).toEqual([...ids].reverse());
});

test('reorders the rail by dragging an icon onto another', async () => {
	const before = (await list()).map(service => service.name);
	const [first = '', second = ''] = before;
	await shep.window.locator(`.rail .service[aria-label="${first}"]`).dragTo(shep.window.locator(`.rail .service[aria-label="${second}"]`));
	await expect.poll(async () => (await list()).map(service => service.name).slice(0, 2)).toEqual([second, first]);
});
