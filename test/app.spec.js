const { test, expect } = require('@playwright/test');
const path = require('path');
const { launchRedil, closeRedil, repoRoot } = require('./helpers/launch');

// One launch for the whole file. Starting Electron costs a few seconds and none
// of these assertions change the application's state.
let redil;

test.beforeAll(async () => { redil = await launchRedil(); });
test.afterAll(async () => { await closeRedil(redil); });

test('opens a window named after the product', async () => {
	expect(await redil.window.title()).toContain('Redil');
});

test('reports the version from package.json, not Electron\'s', async () => {
	const version = await redil.window.evaluate(
		() => require('electron').ipcRenderer.sendSync('app:getVersion'));

	expect(version).toBe(require(path.join(repoRoot, 'package.json')).version);
});

test('serves the preference defaults over getConfig', async () => {
	const config = await redil.window.evaluate(
		() => require('electron').ipcRenderer.sendSync('getConfig'));

	// main.js calls this block the authoritative list of every preference key,
	// so a rename there should fail here rather than at runtime.
	expect(config).toMatchObject({
		 always_on_top: false
		,hide_menu_bar: false
		,tabbar_location: 'top'
		,window_display_behavior: 'taskbar_tray'
		,locale: expect.any(String)
	});
});

test('mounts the Ext viewport with only the home tab configured', async () => {
	const tabs = await redil.window.evaluate(() => {
		const panel = Ext.cq1('app-main');
		return panel.items.items.map(item => item.id);
	});

	// A fresh userData directory means no configured services, so the tab panel
	// holds the home tab and the filler that splits the left and right groups.
	expect(tabs).toContain('redilTab');
	expect(tabs.filter(id => id.startsWith('tab_'))).toHaveLength(0);
});

test('loads the service catalogue and appends the synthetic custom entry', async () => {
	const catalogue = await redil.window.evaluate(() => {
		const store = Ext.getStore('ServicesList');
		return { total: store.getCount(), hasCustom: !!store.getById('custom') };
	});

	expect(catalogue.total).toBeGreaterThan(50);
	expect(catalogue.hasCustom).toBe(true);
});

test('rewrites a pinned user agent to the running Chromium', async () => {
	const agent = await redil.window.evaluate(() => ({
		 pinned: Ext.getStore('ServicesList').getById('whatsapp').get('userAgent')
		// Calls the real method with only the piece of a panel it reads, so the
		// assertion covers getUserAgent rather than a copy of it.
		,served: Redil.ux.WebView.prototype.getUserAgent.call({ record: { get: () => 'whatsapp' } })
		,chrome: process.versions.chrome
	}));

	// The catalogue still names Chrome 70, from 2018, and WhatsApp turns away
	// anything below 100, which is why the token is moved at all.
	expect(agent.pinned).toContain('Chrome/70');
	expect(agent.served).toContain('Chrome/' + agent.chrome);
	expect(Number(agent.served.match(/Chrome\/(\d+)/)[1])).toBeGreaterThanOrEqual(100);
	// The platform half is the reason those entries exist; it must survive.
	expect(agent.served).toContain('Windows NT 10.0; Win64; x64');
});

test('wires the two files the theme package still provides', async () => {
	// Removing the Sencha Cmd scaffolding left only these behind: the Font
	// Awesome the generator loads, and the one override that marks the theme.
	const theme = await redil.window.evaluate(async () => {
		await document.fonts.ready;
		return {
			 marker: typeof Ext.theme !== 'undefined' ? Ext.theme.name : null
			,stylesheet: [...document.styleSheets].some(sheet => (sheet.href || '').includes('font-awesome'))
			,glyphs: document.fonts.check('16px FontAwesome')
		};
	});

	expect(theme.marker).toBe('redil-default-theme');
	expect(theme.stylesheet).toBe(true);
	expect(theme.glyphs).toBe(true);
});
