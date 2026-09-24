const { test, expect } = require('@playwright/test');
const { launchShep, closeShep } = require('./helpers/launch');

// The dark theme is nothing but different values for the tokens in
// resources/css/shep-modern.css, switched by one media query. What drives that
// query is nativeTheme.themeSource, which electron/main.js sets from the `theme`
// preference -- so this checks the whole chain, preference to painted colour.

async function paleta(theme) {
	const shep = await launchShep({ config: { theme: theme } });
	try {
		return await shep.window.evaluate(() => {
			const raiz = getComputedStyle(document.documentElement);
			return {
				 escuro: matchMedia('(prefers-color-scheme: dark)').matches
				,ink: raiz.getPropertyValue('--rx-ink').trim()
				,surface: raiz.getPropertyValue('--rx-surface').trim()
			};
		});
	} finally {
		await closeShep(shep);
	}
}

test('paints light when the preference says light', async () => {
	expect(await paleta('light')).toEqual({ escuro: false, ink: '#12222E', surface: '#FFFFFF' });
});

test('paints dark when the preference says dark', async () => {
	expect(await paleta('dark')).toEqual({ escuro: true, ink: '#EDEDEF', surface: '#1E1E21' });
});

test('leaves the choice to the desktop when the preference says system', async () => {
	// Whatever the machine running the suite answers, the tokens have to agree
	// with it: that pairing is the thing that breaks if the query is mistyped.
	const { escuro, ink } = await paleta('system');
	expect(ink).toBe(escuro ? '#EDEDEF' : '#12222E');
});

test('tells a service page the theme, which a webview is not told on its own', async () => {
	const path = require('path');
	const { repoRoot } = require('./helpers/launch');
	const fixture = 'file://' + path.join(repoRoot, 'test', 'fixtures', 'service.html');
	const shep = await launchShep({ config: { theme: 'dark' } });
	try {
		await shep.window.evaluate(url => {
			const rec = Ext.getStore('Services').add({ id: 8801, type: 'custom', name: 'Themed', url, enabled: true, muted: true, notifications: false })[0];
			Ext.cq1('app-main').insert(1, { xtype: 'webview', id: 'tab_8801', record: rec, tabConfig: { service: rec } });
			Ext.cq1('app-main').setActiveTab('tab_8801');
		}, fixture);
		const guestIsDark = () => shep.window.evaluate(async () => {
			try {
				return await Ext.getCmp('tab_8801').getWebView().executeJavaScript('matchMedia("(prefers-color-scheme: dark)").matches');
			} catch {
				return null;
			}
		});
		await expect.poll(guestIsDark, { timeout: 10000 }).toBe(true);

		await shep.app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'light'; });
		await expect.poll(guestIsDark, { timeout: 10000 }).toBe(false);
	} finally {
		await closeShep(shep);
	}
});
