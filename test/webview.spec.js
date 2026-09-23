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

test('grants the camera and the microphone only to a service marked for calls', async () => {
	// navigator.permissions.query answers from main's permission check handler,
	// which is the same policy the real request goes through -- and unlike a
	// request it never opens the dialog, so the assertion cannot hang.
	const consulta = "Promise.all(['camera', 'microphone'].map(name =>"
		+ " navigator.permissions.query({ name: name }).then(status => name + '=' + status.state)"
		+ ")).then(states => states.join(' '))";

	// The fixture is not marked, so it is asked about rather than granted.
	expect(await inGuest(consulta)).toBe('camera=denied microphone=denied');

	await redil.window.evaluate(() => {
		const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
		tab.setMediaAccess(true);
	});

	expect(await inGuest(consulta)).toBe('camera=granted microphone=granted');

	await redil.window.evaluate(() => {
		const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
		tab.setMediaAccess(false);
	});

	expect(await inGuest(consulta)).toBe('camera=denied microphone=denied');
});

test('counts unread from the title until the snippet proves it can count', async () => {
	// What WhatsApp needed: its catalogue snippet was written against class names
	// the site stopped generating years ago, so it reported zero for ever and the
	// service went quiet. The title, which every messenger writes as "(3) Name",
	// answers for a snippet that has never said anything -- and an earlier test
	// in this file made this one say 7, so the reset is what "never" means here.
	await redil.window.evaluate(() => {
		const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
		tab.snippetWorks = false;
		tab.snippetUnread = 0;
	});

	await inGuest('document.title = "(3) Fixture service"');
	await redil.window.waitForFunction(() => Redil.util.UnreadCounter.getTotalUnreadCount() === 3, null, { timeout: 10000 });

	// A snippet that answers takes the service over: it is the one that knows
	// which chats are muted, and the title does not.
	await inGuest('window.rambox.setUnreadCount(1)');
	await redil.window.waitForFunction(() => Redil.util.UnreadCounter.getTotalUnreadCount() === 1, null, { timeout: 10000 });

	await inGuest('document.title = "(9) Fixture service"');
	await new Promise(resolve => setTimeout(resolve, 500));
	expect(await redil.window.evaluate(() => Redil.util.UnreadCounter.getTotalUnreadCount())).toBe(1);

	await inGuest('window.rambox.clearUnreadCount(); document.title = "Fixture service"');
	await redil.window.waitForFunction(() => Redil.util.UnreadCounter.getTotalUnreadCount() === 0, null, { timeout: 10000 });
});

test('says where each service is getting its count from', async () => {
	// The report under View is this, once per open service. Testing unread
	// detection means logging into the service, so what the app can do instead
	// is say what it sees: a snippet that never answers reads "neither yet".
	const quiet = await redil.window.evaluate(() => {
		const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
		tab.snippetWorks = false;
		tab.snippetUnread = 0;
		tab.titleUnread = '0';
		return tab.unreadDiagnosis();
	});

	expect(quiet).toMatchObject({ name: 'Fixture', snippet: 'none', counting: 'neither yet', total: '0' });

	const counted = await redil.window.evaluate(() => {
		const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
		tab.reportTitleUnread('2');
		const fromTitle = tab.unreadDiagnosis();
		tab.reportSnippetUnread(5);
		return { fromTitle: fromTitle, fromSnippet: tab.unreadDiagnosis() };
	});

	expect(counted.fromTitle).toMatchObject({ counting: 'title', total: '2' });
	expect(counted.fromSnippet).toMatchObject({ counting: 'snippet', total: '5' });

	await redil.window.evaluate(() => {
		const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
		tab.reportSnippetUnread(0);
	});
});

test('marks a service that can only say there is something, without a number', async () => {
	// Google Chat puts no count in its title and none in markup worth reading,
	// but it swaps its favicon when messages arrive. '•' is how a service says
	// "something is waiting": it cannot be added to a total, so it is a dot on
	// the rail and the total is left alone.
	const marcado = await redil.window.evaluate(() => {
		const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
		tab.reportSnippetUnread('•');

		return {
			 selo: tab.tab.el.dom.getAttribute('data-badge-text')
			,algo: Redil.util.UnreadCounter.hasSomethingUnread(tab.record.get('id'))
			,total: Redil.util.UnreadCounter.getTotalUnreadCount()
		};
	});

	expect(marcado.selo).toBe('•');
	expect(marcado.algo).toBe(true);
	expect(marcado.total).toBe(0);

	const limpo = await redil.window.evaluate(() => {
		const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
		tab.reportSnippetUnread(0);
		return Redil.util.UnreadCounter.hasSomethingUnread(tab.record.get('id'));
	});

	expect(limpo).toBe(false);
});
