const { test, expect } = require('@playwright/test');
const path = require('path');
const { launchShep, closeShep, repoRoot } = require('./helpers/launch');

// A service tab is the one place the app runs somebody else's page, so this is
// where the isolation matters most. The fixture is local: the suite never waits
// on a real service.
const FIXTURE = 'file://' + path.join(repoRoot, 'test', 'fixtures', 'service.html');

let shep;

test.beforeAll(async () => {
	shep = await launchShep();

	// The tab panel is built when the store loads, from records the localStorage
	// proxy persisted. Rather than drive that persistence, the record and the tab
	// are made here in the shape app/store/Services.js gives them: what this file
	// is testing is the webview, not how a service comes to exist.
	await shep.window.evaluate(url => {
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
			const ready = await shep.window.evaluate(() => {
				const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
				try { return !!(tab && tab.getWebView() && tab.getWebView().getWebContentsId()); } catch { return false; }
			});
			if (ready) return;
			await new Promise(resolve => setTimeout(resolve, 100));
		}
		throw new Error('the service webview never attached');
	});
});

test.afterAll(async () => { await closeShep(shep); });

const inGuest = expression => shep.window.evaluate(source => {
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

test('bridges only the notification click into the page world', async () => {
	// The Notification wrapper the panel injects runs in the page's own world, so
	// an isolated preload has to expose this through contextBridge.
	const api = await inGuest('Object.keys(window.rambox).sort().join(",")');
	expect(api).toBe('showWindowAndActivateTab');
});

test('carries an unread count from the page title to the global counter', async () => {
	expect(await shep.window.evaluate(() => Shep.util.UnreadCounter.getTotalUnreadCount())).toBe(0);

	await inGuest('document.title = "(7) Fixture service"');
	await shep.window.waitForFunction(() => Shep.util.UnreadCounter.getTotalUnreadCount() === 7, null, { timeout: 10000 });

	await inGuest('document.title = "Fixture service"');
	await shep.window.waitForFunction(() => Shep.util.UnreadCounter.getTotalUnreadCount() === 0, null, { timeout: 10000 });
});

test('wraps Notification so a click can reach the tab', async () => {
	// The preload patched this global in place until it lost the page's window;
	// the panel injects it now.
	// It is injected on dom-ready, which can land after the webview attaches.
	await expect.poll(() => inGuest('({ marked: !!window.__ramboxNotification, isWrapper: Notification.toString().indexOf("__native") > -1 })'), { timeout: 10000 })
		.toEqual({ marked: true, isWrapper: true });
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

	await shep.window.evaluate(() => {
		const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
		tab.setMediaAccess(true);
	});

	expect(await inGuest(consulta)).toBe('camera=granted microphone=granted');

	await shep.window.evaluate(() => {
		const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
		tab.setMediaAccess(false);
	});

	expect(await inGuest(consulta)).toBe('camera=denied microphone=denied');
});

test('reads the count in the shapes services write it in the title', async () => {
	const counts = await shep.window.evaluate(() => [
		 '(3) WhatsApp'
		,'Inbox (12) - someone@gmail.com - Gmail'
		,'(1.234) Feed'
		,'(99+) Chat'
		,'(•) Chat'
		,'Discord'
		,'(Draft) Notes'
	].map(title => Shep.ux.WebView.prototype.countFromTitle(title)));

	expect(counts).toEqual([3, 12, 1234, 99, '•', 0, 0]);
});

test('waits before believing a title that drops its count, which some services blink', async () => {
	await inGuest('document.title = "(4) Fixture service"');
	await shep.window.waitForFunction(() => Shep.util.UnreadCounter.getTotalUnreadCount() === 4, null, { timeout: 10000 });

	await inGuest('document.title = "Fixture service"; setTimeout(() => { document.title = "(4) Fixture service"; }, 300)');
	await new Promise(resolve => setTimeout(resolve, 2000));
	expect(await shep.window.evaluate(() => Shep.util.UnreadCounter.getTotalUnreadCount())).toBe(4);

	await inGuest('document.title = "Fixture service"');
	await shep.window.waitForFunction(() => Shep.util.UnreadCounter.getTotalUnreadCount() === 0, null, { timeout: 10000 });
});

test('says what title each service last showed and what it counted', async () => {
	await inGuest('document.title = "(2) Fixture service"');
	await shep.window.waitForFunction(() => Shep.util.UnreadCounter.getTotalUnreadCount() === 2, null, { timeout: 10000 });

	const diagnosis = await shep.window.evaluate(() => {
		const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
		return tab.unreadDiagnosis();
	});
	expect(diagnosis).toEqual({ name: 'Fixture', title: '(2) Fixture service', total: '2' });

	await inGuest('document.title = "Fixture service"');
	await shep.window.waitForFunction(() => Shep.util.UnreadCounter.getTotalUnreadCount() === 0, null, { timeout: 10000 });
});

test('marks a service whose title says there is something, without a number', async () => {
	// '•' cannot be added to a total, so it is a dot on the rail and the total is
	// left alone.
	await inGuest('document.title = "(•) Fixture service"');
	await shep.window.waitForFunction(() => Shep.util.UnreadCounter.hasSomethingUnread(4242), null, { timeout: 10000 });

	const marcado = await shep.window.evaluate(() => {
		const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
		return {
			 selo: tab.tab.el.dom.getAttribute('data-badge-text')
			,total: Shep.util.UnreadCounter.getTotalUnreadCount()
		};
	});
	expect(marcado).toEqual({ selo: '•', total: 0 });

	await inGuest('document.title = "Fixture service"');
	await shep.window.waitForFunction(() => !Shep.util.UnreadCounter.hasSomethingUnread(4242), null, { timeout: 10000 });
});

test('wears the page favicon on a tile and keeps it on the record', async () => {
	// The fixture lists an inline SVG favicon. Main hands it back in base64,
	// because Ext writes the icon into an unquoted url(), where its quotes and
	// spaces were a syntax error and the rail silently kept the initials.
	await shep.window.waitForFunction(() => {
		const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
		return /^data:image\/svg\+xml;base64,/.test(tab.tab.icon || '');
	}, null, { timeout: 10000 });

	const worn = await shep.window.evaluate(() => {
		const tab = Ext.cq1('app-main').items.items.find(item => item.id === 'tab_4242');
		return {
			 tile: tab.tab.hasCls('rx-tab-favicon')
			,kept: tab.record.get('favicon') === tab.tab.icon
			,painted: tab.tab.btnIconEl.dom.style.backgroundImage.indexOf(tab.tab.icon) > -1
		};
	});
	expect(worn).toEqual({ tile: true, kept: true, painted: true });
});

test('picks the smallest favicon that is sharp at 24px on a 2x screen', async () => {
	const picked = await shep.window.evaluate(async () => {
		const png = size => {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = size;
			return canvas.toDataURL('image/png');
		};
		const pick = Shep.util.ServiceIcon.pickFavicon;
		return {
			 prefers48: await pick([png(128), png(16), png(48), png(32)]) === png(48)
			,largestWhenNoneIsSharp: await pick([png(16), png(32)]) === png(32)
			,noneLoads: await pick(['data:image/png;base64,broken'])
		};
	});
	expect(picked).toEqual({ prefers48: true, largestWhenNoneIsSharp: true, noneLoads: null });
});

test('draws initials for a service that has shown no favicon yet', async () => {
	const described = await shep.window.evaluate(() => {
		const record = Ext.create('Shep.model.Service', { type: 'custom', name: 'Acme Chat', url: 'https://chat.acme.com' });
		const legacy = Ext.create('Shep.model.Service', { type: 'whatsapp', logo: 'whatsapp.png', name: 'WhatsApp', url: 'https://web.whatsapp.com' });
		return {
			 initials: decodeURIComponent(Shep.util.ServiceIcon.describe(record).url).indexOf('>AC</text>') > -1
			,legacy: Shep.util.ServiceIcon.describe(legacy).url
		};
	});
	expect(described).toEqual({ initials: true, legacy: 'resources/icons/whatsapp.png' });
});
