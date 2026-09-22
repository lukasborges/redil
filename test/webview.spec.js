const { test, expect } = require('@playwright/test');
const path = require('path');
const { launchRedil, closeRedil, repoRoot } = require('./helpers/launch');

// A service tab is the one place the app runs somebody else's page, so this is
// where the isolation matters most. The fixture is local: the suite never waits
// on a real service.
const FIXTURE = 'file://' + path.join(repoRoot, 'test', 'fixtures', 'service.html');

let redil;

test.beforeAll(async () => {
	redil = await launchRedil();

	// The tab panel is built when the store loads, from records the localStorage
	// proxy persisted. Rather than drive that persistence, the record and the tab
	// are made here in the shape app/store/Services.js gives them: what this file
	// is testing is the webview, not how a service comes to exist.
	await redil.window.evaluate(url => {
		const record = Ext.getStore('Services').add({
			 id: 4242
			,type: 'custom'
			,name: 'Fixture'
			,url: url
			,align: 'left'
			,enabled: true
			,notifications: false
			,muted: true
			,includeInGlobalUnreadCounter: true
			,displayTabUnreadCounter: true
		})[0];

		Ext.cq1('app-main').insert(1, {
			 xtype: 'webview'
			,id: 'tab_4242'
			,title: 'Fixture'
			,src: url
			,type: 'custom'
			,muted: true
			,includeInGlobalUnreadCounter: true
			,displayTabUnreadCounter: true
			,enabled: true
			,record: record
			,tabConfig: { service: record }
		});
	}, FIXTURE);

	await test.step('wait for the service webview', async () => {
		for (let attempt = 0; attempt < 150; attempt++) {
			const ready = await redil.window.evaluate(() => {
				const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
				try { return !!(tab && tab.getWebView() && tab.getWebView().getWebContentsId()); } catch { return false; }
			});
			if (ready) return;
			await new Promise(resolve => setTimeout(resolve, 100));
		}
		throw new Error('the service webview never attached');
	});
});

test.afterAll(async () => { await closeRedil(redil); });

const inGuest = expression => redil.window.evaluate(source => {
	const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
	return tab.getWebView().executeJavaScript(source);
}, expression);

test('runs the service page isolated, sandboxed and without node', async () => {
	// Electron will not let a guest be less isolated than its embedder, so these
	// follow the main window. The webpreferences attribute asking for the
	// opposite is ignored, which is why the preload had to be rewritten.
	const reach = await inGuest('({ process: typeof process, module: typeof module })');
	expect(reach).toEqual({ process: 'undefined', module: 'undefined' });
});

test('bridges window.rambox into the page world for the injected snippets', async () => {
	// js_unread from the catalogue runs here, in the page's own world, so an
	// isolated preload has to expose this through contextBridge or nothing the
	// catalogue injects can report anything.
	const api = await inGuest('Object.keys(window.rambox).sort().join(",")');
	expect(api).toBe('clearUnreadCount,setUnreadCount,showWindowAndActivateTab');
});

test('carries an unread count from the page to the global counter', async () => {
	expect(await redil.window.evaluate(() => Redil.util.UnreadCounter.getTotalUnreadCount())).toBe(0);

	await inGuest('window.rambox.setUnreadCount(7)');
	await redil.window.waitForFunction(() => Redil.util.UnreadCounter.getTotalUnreadCount() === 7, null, { timeout: 10000 });

	await inGuest('window.rambox.clearUnreadCount()');
	await redil.window.waitForFunction(() => Redil.util.UnreadCounter.getTotalUnreadCount() === 0, null, { timeout: 10000 });
});

test('wraps Notification so a click can reach the tab', async () => {
	// The preload patched this global in place until it lost the page's window;
	// the panel injects it now, beside the js_unread snippets.
	const wrapped = await inGuest('({ marked: !!window.__ramboxNotification, isWrapper: Notification.toString().indexOf("__native") > -1 })');
	expect(wrapped).toEqual({ marked: true, isWrapper: true });
});
