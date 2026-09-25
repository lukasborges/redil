import type { Server } from 'node:http';
import { test, expect } from '@playwright/test';
import type { ServiceState } from '../../src/shared/service.ts';
import { launchShep, closeShep, inService, serviceRecord, type Shep } from './helpers/launch.ts';
import { serveFixtures } from './helpers/server.ts';

let shep: Shep;
let server: Server;
let at: Awaited<ReturnType<typeof serveFixtures>>['at'];

const serviceUrl = () => at('127.0.0.1', '/service.html');
const list = () => shep.window.evaluate(() => window.shep.invoke('services:list')) as Promise<ServiceState[]>;
const inFixture = <T>(expression: string) => inService<T>(shep, serviceUrl(), expression);

test.beforeAll(async () => {
	({ server, at } = await serveFixtures());
	shep = await launchShep({
		store: {
			services: [
				serviceRecord('1', serviceUrl()),
				serviceRecord('2', at('127.0.0.1', '/away.html'), { media: true })
			],
			activeServiceId: '1'
		}
	});
	await expect.poll(async () => (await list()).find(service => service.id === '1')?.pageTitle).toBe('Fixture service');
});

test.afterAll(async () => {
	await closeShep(shep);
	server.close();
});

test('runs each service in the session its record names, so a saved sign-in survives', async () => {
	const storage = await shep.app.evaluate(({ webContents }, url) =>
		webContents.getAllWebContents().find(contents => contents.getURL() === url)?.session.storagePath, serviceUrl());
	expect(storage).toMatch(/Partitions\/service-1$/);
});

test('runs the service page isolated, sandboxed and without node', async () => {
	expect(await inFixture('({ require: typeof require, process: typeof process })')).toEqual({ require: 'undefined', process: 'undefined' });
});

test('tells the page it is Chromium, with nothing of Shep or Electron in the agent', async () => {
	const agent = await inFixture<string>('navigator.userAgent');
	expect(agent).toContain('Chrome/');
	expect(agent).not.toMatch(/Shep|Electron/);
});

test('counts unread from the page title and shows the active service instead of the welcome page', async () => {
	await inFixture('document.title = "(3) Fixture service"');
	await expect.poll(async () => (await list()).find(service => service.id === '1')?.unread).toBe(3);
	await expect(shep.window.locator('.welcome')).toHaveCount(0);
	await inFixture('document.title = "Fixture service"');
});

test('wears the sharpest small favicon the page lists, fetched through its session', async () => {
	await expect.poll(async () => (await list()).find(service => service.id === '1')?.favicon ?? '').toMatch(/^data:image\/png;base64,/);
	const width = await shep.window.evaluate(async () => {
		const state = (await window.shep.invoke('services:list') as { id: string; favicon: string }[]).find(service => service.id === '1');
		const image = new Image();
		image.src = state?.favicon ?? '';
		await image.decode();
		return image.naturalWidth;
	});
	expect(width).toBe(64);
});

test('tells the service page the app\'s theme, which embedded content is not told on its own', async () => {
	const isDark = () => inFixture<boolean>('matchMedia("(prefers-color-scheme: dark)").matches');
	await shep.app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'dark'; });
	await expect.poll(isDark).toBe(true);
	await shep.app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'light'; });
	await expect.poll(isDark).toBe(false);
});

test('tells a page the camera is refused only once the user refused it, since a page told so before never asks', async () => {
	const camera = (url: string) => inService<string>(shep, url, 'navigator.permissions.query({ name: "camera" }).then(status => status.state)');
	const remember = (permissions: Record<string, boolean>) => shep.app.evaluate(({ app: electronApp }, permissions) => {
		const fs = process.getBuiltinModule('node:fs');
		const file = electronApp.getPath('userData') + '/shep.json';
		fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, 'utf8')), permissions }));
	}, permissions);
	expect(await camera(serviceUrl())).toBe('granted');
	try {
		await remember({ 'persist:service-1|media': false, 'persist:service-2|media': false });
		expect(await camera(serviceUrl())).toBe('denied');
		expect(await camera(at('127.0.0.1', '/away.html'))).toBe('granted');
	} finally {
		await remember({});
	}
});

test('opens a link to another site in a window of the app that shares the service\'s session', async () => {
	await inFixture('document.getElementById("elsewhere").click()');
	const sessions = () => shep.app.evaluate(({ BrowserWindow, webContents }, url) => {
		const auxiliary = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/away.html'));
		const service = webContents.getAllWebContents().find(contents => contents.getURL() === url);
		return { auxiliary: auxiliary?.webContents.session.storagePath, service: service?.session.storagePath };
	}, serviceUrl());
	await expect.poll(async () => (await sessions()).auxiliary).toBeTruthy();
	const { auxiliary, service } = await sessions();
	expect(auxiliary).toBe(service);
	await shep.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/away.html'))?.close());
});

test('hands a sign-in that left the service back to the service\'s own page, and closes its window', async () => {
	await inFixture(`window.open(${JSON.stringify(at('localhost', '/away.html'))}), null`);
	await expect.poll(() => shep.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(window => window.webContents.getURL().includes('localhost')))).toBe(true);
	const back = serviceUrl() + '?signed-in=1';
	await shep.app.evaluate(({ BrowserWindow }, back) => {
		const auxiliary = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('localhost'));
		auxiliary?.webContents.executeJavaScript(`location.href = ${JSON.stringify(back)}`);
	}, back);
	await expect.poll(() => shep.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
	await expect.poll(() => shep.app.evaluate(({ webContents }) => webContents.getAllWebContents().some(contents => contents.getURL().endsWith('?signed-in=1')))).toBe(true);
});

test('goes back and forward in the service with Alt and the arrows', async () => {
	// the second service already sits on away.html, so this one goes to an address of its own
	const away = at('127.0.0.1', '/away.html?from=first-service');
	await inFixture(`location.href = ${JSON.stringify(away)}`);
	const loadedAway = () => shep.app.evaluate(({ webContents }, away) => webContents.getAllWebContents().some(contents => contents.getURL() === away && !contents.isLoading()), away);
	await expect.poll(loadedAway).toBe(true);
	await shep.app.evaluate(({ webContents }, away) => {
		const contents = webContents.getAllWebContents().find(candidate => candidate.getURL() === away);
		contents?.sendInputEvent({ type: 'keyDown', keyCode: 'Left', modifiers: ['alt'] });
		contents?.sendInputEvent({ type: 'keyUp', keyCode: 'Left', modifiers: ['alt'] });
	}, away);
	await expect.poll(() => shep.app.evaluate(({ webContents }, url) => webContents.getAllWebContents().some(contents => contents.getURL().startsWith(url)), serviceUrl())).toBe(true);
});

test('hands a sign-in back to the address the service was added with, though its page sits on another site', async () => {
	let other: Shep | undefined;
	try {
		// signed out, the service's address sends it elsewhere, as chat.google.com does to workspace.google.com
		const address = at('localhost', '/go?to=' + encodeURIComponent(at('127.0.0.1', '/away.html?product-page')));
		other = await launchShep({ store: { services: [serviceRecord('1', address)], activeServiceId: '1' } });
		const app = other;
		const onPage = (prefix: string) => app.app.evaluate(({ webContents }, prefix) => webContents.getAllWebContents().some(contents => contents.getURL().startsWith(prefix)), prefix);
		await expect.poll(() => onPage(at('127.0.0.1', '/away.html?product-page'))).toBe(true);

		await inService(app, at('127.0.0.1', '/away.html?product-page'), `window.open(${JSON.stringify(at('[::1]', '/away.html?sign-in'))}), null`);
		await expect.poll(() => onPage(at('[::1]', '/away.html?sign-in'))).toBe(true);
		await app.app.evaluate(({ BrowserWindow }, back) => {
			const signIn = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('sign-in'));
			signIn?.webContents.executeJavaScript(`location.href = ${JSON.stringify(back)}`);
		}, at('localhost', '/service.html?signed-in'));

		await expect.poll(() => app.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
		await expect.poll(() => onPage(at('localhost', '/service.html?signed-in'))).toBe(true);
	} finally {
		await closeShep(other);
	}
});

test('keeps running when a removed service\'s page asks for something after it is gone', async () => {
	let other: Shep | undefined;
	try {
		other = await launchShep({ store: { services: [serviceRecord('3', at('127.0.0.1', '/service.html'))], activeServiceId: '3' } });
		const app = other;
		await expect.poll(() => app.app.evaluate(({ webContents }, url) => webContents.getAllWebContents().some(contents => contents.getURL() === url), at('127.0.0.1', '/service.html'))).toBe(true);
		// the store reads its file on every get, so this is the service gone while its page lives on
		await app.app.evaluate(({ app: electronApp }) => {
			const fs = process.getBuiltinModule('node:fs');
			const file = electronApp.getPath('userData') + '/shep.json';
			const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
			fs.writeFileSync(file, JSON.stringify({ ...saved, services: [] }));
		});
		expect(await inService<string>(app, at('127.0.0.1', '/service.html'), 'navigator.permissions.query({ name: "camera" }).then(status => status.state)')).toBe('denied');
		expect(await inService<boolean>(app, at('127.0.0.1', '/service.html'), 'window.shepService.mayNotify()')).toBe(false);
		expect(await app.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
	} finally {
		await closeShep(other);
	}
});
