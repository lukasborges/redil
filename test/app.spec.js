const { test, expect } = require('@playwright/test');
const path = require('path');
const { launchShep, closeShep, repoRoot } = require('./helpers/launch');

// One launch for the whole file. Starting Electron costs a few seconds and none
// of these assertions change the application's state.
let shep;

test.beforeAll(async () => { shep = await launchShep(); });
test.afterAll(async () => { await closeShep(shep); });

test('opens a window named after the product', async () => {
	expect(await shep.window.title()).toContain('Shep');
});

test('reports the version from package.json, not Electron\'s', async () => {
	const version = await shep.window.evaluate(
		() => shep.ipc.sendSync('app:getVersion'));

	expect(version).toBe(require(path.join(repoRoot, 'package.json')).version);
});

test('serves the preference defaults over getConfig', async () => {
	const config = await shep.window.evaluate(
		() => shep.ipc.sendSync('getConfig'));

	// main.js calls this block the authoritative list of every preference key,
	// so a rename there should fail here rather than at runtime.
	expect(config).toMatchObject({
		 always_on_top: false
		,theme: 'system'
		,window_display_behavior: 'taskbar_tray'
		,locale: expect.any(String)
	});
});

test('mounts the Ext viewport with only the home tab configured', async () => {
	const tabs = await shep.window.evaluate(() => {
		const panel = Ext.cq1('app-main');
		return panel.items.items.map(item => item.id);
	});

	// A fresh userData directory means no configured services, so the tab panel
	// holds the home tab and the filler that splits the left and right groups.
	expect(tabs).toContain('shepTab');
	expect(tabs.filter(id => id.startsWith('tab_'))).toHaveLength(0);
});

test('tells every page the running Chromium as the default, since Turnstile refuses an overridden agent', async () => {
	const agent = await shep.app.evaluate(({ app }) => app.userAgentFallback);
	const chrome = await shep.window.evaluate(() => shep.versions.chrome);
	expect(agent).toContain('Chrome/' + chrome);
	expect(agent).not.toMatch(/Shep|Electron/);

	const attribute = await shep.window.evaluate(() => document.querySelector('webview') ? document.querySelector('webview').getAttribute('useragent') : 'no webview');
	expect(['no webview', null]).toContain(attribute);
});

test('wires the two files the theme package still provides', async () => {
	// Removing the Sencha Cmd scaffolding left only these behind: the Font
	// Awesome the generator loads, and the one override that marks the theme.
	const theme = await shep.window.evaluate(async () => {
		await document.fonts.ready;
		return {
			 marker: typeof Ext.theme !== 'undefined' ? Ext.theme.name : null
			,stylesheet: [...document.styleSheets].some(sheet => (sheet.href || '').includes('font-awesome'))
			,glyphs: document.fonts.check('16px FontAwesome')
		};
	});

	expect(theme.marker).toBe('shep-default-theme');
	expect(theme.stylesheet).toBe(true);
	expect(theme.glyphs).toBe(true);
});

test('runs the renderer without node', async () => {
	const reach = await shep.window.evaluate(() => ({
		 require: typeof require
		,process: typeof process
		,module: typeof module
		,bridge: typeof window.shep
	}));

	// nodeIntegration is off and contextIsolation is on, so the page cannot pull
	// in a module; electron/preload.js is the whole of its reach into Electron.
	expect(reach).toEqual({ require: 'undefined', process: 'undefined', module: 'undefined', bridge: 'object' });
});

test('refuses a channel the preload does not expose', async () => {
	const refused = await shep.window.evaluate(() => {
		try { shep.ipc.send('image:download', 'https://example.com/a.png'); return null; }
		catch (error) { return error.message; }
	});

	// A bridge that forwarded anything would hand back most of what the
	// isolation removes, so both directions are allowlisted.
	expect(refused).toContain('not exposed to the renderer');
});

test('keeps the shortcuts working without requiring mousetrap', async () => {
	// The renderer required it as a node module; it is a plain browser library
	// and the generator now loads it as a script.
	const bound = await shep.window.evaluate(() => typeof window.Mousetrap === 'object' || typeof window.Mousetrap === 'function');
	expect(bound).toBe(true);
});

test('puts the service bar on the left, as a rail of icons', async () => {
	const rail = await shep.window.evaluate(() => {
		const bar = Ext.getCmp('mainTabBar');
		return {
			 posicao: Ext.cq1('app-main').getTabPosition()
			,largura: Math.round(bar.el.dom.getBoundingClientRect().width)
			// Ext.tab.Tab extends Ext.button.Button, so the tabs answer to that too.
			,botoes: bar.items.items
				.filter(item => item.isXType && item.isXType('button') && !item.isXType('tab'))
				.map(item => item.handler)
			,abaInicialOculta: Ext.getCmp('shepTab').tab.isHidden()
			,rotulos: bar.el.dom.querySelectorAll('.x-tab-inner').length
			,rotulosVisiveis: [...bar.el.dom.querySelectorAll('.x-tab-inner')]
				.filter(el => el.offsetParent !== null).length
		};
	});

	expect(rail.posicao).toBe('left');
	expect(rail.largura).toBe(68);
	// Add a service above the fill; below it the three that were the home tab's
	// own toolbar until they moved here, which meant they vanished whenever a
	// service was open. The home tab has no button: it is what the app opens on.
	expect(rail.botoes).toEqual(['openAddService', 'dontDisturb', 'lockShep', 'openPreferences']);
	expect(rail.abaInicialOculta).toBe(true);
	// Icons only: the label elements exist, and none of them is shown.
	expect(rail.rotulos).toBeGreaterThan(0);
	expect(rail.rotulosVisiveis).toBe(0);
});

test('splits the preferences into sections without unbinding a field', async () => {
	const prefs = await shep.window.evaluate(() => {
		const win = Ext.create('Shep.view.preferences.Preferences');
		win.show();
		const nomes = win.down('form').getForm().getFields().items.map(f => f.getName());
		const resultado = {
			 secoes: win.down('tabpanel').items.items.map(t => t.title)
			// proxyHost lives on Advanced, which is not the open section: it is
			// bound only because the tab panel renders every section up front.
			,temProxyHost: nomes.includes('proxyHost')
			,temMasterPassword: nomes.includes('master_password1')
			,temTheme: nomes.includes('theme')
			// The ui: 'decline' buttons had no styling at all, so Cancel was
			// rendered, coloured and 42px wide inside a line box 0px tall.
			,alturaDoCancelar: (() => {
				const botao = win.dockedItems.items
					.flatMap(d => (d.items && d.items.items) || [])
					.find(b => b.isXType && b.isXType('button') && b.ui === 'decline-small');
				return Math.round(botao.el.dom.querySelector('.x-btn-inner').getBoundingClientRect().height);
			})()
		};
		win.destroy();
		return resultado;
	});

	expect(prefs.secoes).toEqual(['Appearance', 'Window', 'Services', 'Security', 'Advanced']);
	expect(prefs.temProxyHost).toBe(true);
	expect(prefs.temMasterPassword).toBe(true);
	expect(prefs.temTheme).toBe(true);
	expect(prefs.alturaDoCancelar).toBeGreaterThan(0);
});

test('opens on a welcome page, with an Add window behind the + that asks only for the address, a name and a workspace', async () => {
	const inicio = await shep.window.evaluate(() => ({
		 ativo: Ext.cq1('app-main').getActiveTab().id
		,boasVindas: Ext.getCmp('shepTab').down('#welcome').el.dom.innerText.trim()
	}));

	expect(inicio.ativo).toBe('shepTab');
	expect(inicio.boasVindas).toContain('Welcome to Shep');

	const janela = await shep.window.evaluate(() => {
		Ext.cq1('app-main').getController().openAddService();
		const win = Ext.ComponentQuery.query('window').find(w => w.$className === 'Shep.view.add.Add');
		const resultado = {
			 aberta: !!win && win.isVisible()
			,campos: win.down('form').getForm().getFields().items.map(f => f.getName()).filter(Boolean)
		};
		win.destroy();
		return resultado;
	});

	expect(janela.aberta).toBe(true);
	expect(janela.campos).toEqual(['url', 'serviceName', 'workspace']);
});

test('edits, disables and enables a service from its icon\'s right click', async () => {
	// The list on the home tab used to be the only place for these, and a
	// disabled service lost its tab: with the list gone the tab has to stay,
	// greyed, or there would be no way back.
	const fixture = 'file://' + path.join(repoRoot, 'test', 'fixtures', 'service.html');
	const passos = await shep.window.evaluate(url => {
		const painel = Ext.cq1('app-main');
		const store = Ext.getStore('Services');
		const rec = store.add({ id: 7301, type: 'custom', name: 'Right click', url: url,
			align: 'left', position: 0, enabled: true, notifications: false, muted: false })[0];

		painel.suspendEvent('add');
		painel.insert(1, { xtype: 'webview', id: 'tab_7301', title: '', tooltip: rec.get('name'),
			src: url, type: 'custom', enabled: true, record: rec, tabConfig: { service: rec } });
		painel.resumeEvent('add');

		// Ext lays out a card only while it is showing, so the disabled page
		// exists once the tab is the active one.
		painel.setActiveTab('tab_7301');
		const aba = Ext.getCmp('tab_7301');
		const menu = aba.tab.menu;
		const ler = () => {
			menu.show();
			const visiveis = menu.items.items.filter(i => !i.isHidden() && !i.isXType('menuseparator') && i.text).map(i => i.text);
			menu.hide();
			return visiveis;
		};

		const ligado = ler();
		menu.down('#disableService').handler.call(aba);
		const desligado = { menu: ler(), existe: !!Ext.getCmp('tab_7301'), enabled: rec.get('enabled'),
			pagina: !!aba.el.dom.querySelector('.rx-disabled .rx-enable') };
		aba.el.dom.querySelector('.rx-enable').click();
		const religado = { enabled: rec.get('enabled'), webview: !!aba.getWebView() };

		aba.destroy();
		store.remove(rec);
		painel.setActiveTab('shepTab');
		return { ligado: ligado, desligado: desligado, religado: religado };
	}, fixture);

	expect(passos.ligado).toEqual(['Reload', 'Notifications', 'Sound', 'Enabled', 'Edit', 'Remove', 'Developer Tools']);
	// a disabled service has no page, so only what can be done to the service is left
	expect(passos.desligado).toEqual({ menu: ['Notifications', 'Sound', 'Enabled', 'Edit', 'Remove'], existe: true, enabled: false, pagina: true });
	expect(passos.religado).toEqual({ enabled: true, webview: true });
});

test('installs no menu bar outside macOS', async () => {
	// Every item it held has a home now: the rail, a service's right click, or
	// Preferences, and its shortcuts are bound in the renderer.
	const menu = await shep.app.evaluate(({ Menu }) => Menu.getApplicationMenu());
	expect(menu).toBeNull();
});

test('adds a service from a typed address, naming it after the site', async () => {
	const statics = await shep.window.evaluate(() => {
		const c = Shep.view.add.AddController;
		return {
			 urls: ['web.whatsapp.com', 'https://claude.ai/new', 'http://localhost:8065', 'ftp://example.com', 'intranet', ''].map(c.normalizeUrl)
			,names: ['https://web.whatsapp.com/', 'https://chat.google.com/', 'https://mail.google.com/', 'https://claude.ai/', 'https://www.bbc.co.uk/', 'https://acme.slack.com/'].map(c.nameFromUrl)
		};
	});

	expect(statics.urls).toEqual(['https://web.whatsapp.com/', 'https://claude.ai/new', 'http://localhost:8065/', null, null, null]);
	expect(statics.names).toEqual(['Whatsapp', 'Google Chat', 'Google Mail', 'Claude', 'Bbc', 'Slack Acme']);

	const ADDRESS_NOTHING_LISTENS_ON = 'localhost:9';
	const id = await shep.window.evaluate(address => {
		Ext.cq1('app-main').getController().openAddService();
		const win = Ext.ComponentQuery.query('window').find(w => w.$className === 'Shep.view.add.Add');
		win.down('textfield[name=url]').setValue(address);
		win.getController().doSave();
		const store = Ext.getStore('Services');
		return store.getAt(store.getCount() - 1).get('id');
	}, ADDRESS_NOTHING_LISTENS_ON);

	// not destroyed at once: Electron throws "Invalid guestInstanceId" later, inside whichever test is running
	await shep.window.waitForFunction(id => {
		try { return !!Ext.getCmp('tab_' + id).getWebView().getWebContentsId(); } catch { return false; }
	}, id, { timeout: 10000 });

	const adicionado = await shep.window.evaluate(id => {
		const store = Ext.getStore('Services');
		const rec = store.getById(id);
		const tab = Ext.getCmp('tab_' + id);
		const resultado = {
			 type: rec.get('type')
			,name: rec.get('name')
			,url: rec.get('url')
			,media: rec.get('media')
			,initials: decodeURIComponent(tab.tab.icon).indexOf('>LO</text>') > -1
		};
		tab.destroy();
		store.remove(rec);
		Ext.cq1('app-main').setActiveTab('shepTab');
		return resultado;
	}, id);

	expect(adicionado).toEqual({ type: 'custom', name: 'Localhost', url: 'https://localhost:9/', media: false, initials: true });
});

test('reorders the rail and writes the order back to the store', async () => {
	// The reorderer moves the card and the panel fires childmove; updatePositions
	// walks the rail from there. It used to finish with store.load(), which threw
	// inside the home tab's old list, so any page error here is the regression.
	const erros = [];
	const anotar = e => erros.push(String(e));
	shep.window.on('pageerror', anotar);

	const fixture = 'file://' + path.join(repoRoot, 'test', 'fixtures', 'service.html');
	const ordem = await shep.window.evaluate(url => {
		const painel = Ext.cq1('app-main');
		const store = Ext.getStore('Services');

		const registros = [7001, 7002, 7003].map((id, i) => store.add({
			 id: id, type: 'custom', name: 'Reorder ' + (i + 1), url: url
			,align: 'left', position: i, enabled: true, notifications: false, muted: false
		})[0]);

		painel.suspendEvent('add');
		registros.forEach((rec, i) => painel.insert(1 + i, {
			 xtype: 'webview', id: 'tab_' + rec.get('id'), title: '', tooltip: rec.get('name')
			,src: url, type: 'custom', enabled: true, record: rec, tabConfig: { service: rec }
		}));
		painel.resumeEvent('add');

		// what the reorderer does once the drag has settled
		painel.move(Ext.getCmp('tab_7001'), 3);

		const resultado = {
			 abas: painel.items.items.map(t => t.id)
			,loja: store.getRange().map(r => r.get('name') + ':' + r.get('align'))
		};

		[7001, 7002, 7003].forEach(id => {
			Ext.getCmp('tab_' + id).destroy();
			store.remove(store.getById(id));
		});
		return resultado;
	}, fixture);

	shep.window.off('pageerror', anotar);

	expect(erros).toEqual([]);
	expect(ordem.abas.slice(0, 4)).toEqual(['shepTab', 'tab_7002', 'tab_7003', 'tab_7001']);
	// the store follows the rail, and nothing crossed into the right group
	expect(ordem.loja).toEqual(['Reorder 2:left', 'Reorder 3:left', 'Reorder 1:left']);
});

test('exposes the online check the renderer runs at boot', async () => {
	// Application.js invokes this before it loads the services; it was left out
	// of the preload's allowlist when is-online moved to the main process, so the
	// call threw on every launch. The promise is not awaited: what is under test
	// is the allowlist, not the network.
	const exposto = await shep.window.evaluate(() => {
		try {
			shep.ipc.invoke('net:isOnline');
			return true;
		} catch (e) {
			return e.message;
		}
	});

	expect(exposto).toBe(true);
});

test('opens the Add window over a service and leaves the service on screen', async () => {
	const fixture = 'file://' + path.join(repoRoot, 'test', 'fixtures', 'service.html');
	const passo = await shep.window.evaluate(url => {
		const painel = Ext.cq1('app-main');
		const store = Ext.getStore('Services');
		const rec = store.add({ id: 7101, type: 'custom', name: 'From service', url: url,
			align: 'left', position: 0, enabled: true, notifications: false, muted: false })[0];

		painel.suspendEvent('add');
		painel.insert(1, { xtype: 'webview', id: 'tab_7101', title: '', tooltip: rec.get('name'),
			src: url, type: 'custom', enabled: true, record: rec, tabConfig: { service: rec } });
		painel.resumeEvent('add');
		painel.setActiveTab('tab_7101');

		painel.getController().openAddService();
		const win = Ext.ComponentQuery.query('window').find(w => w.$className === 'Shep.view.add.Add');
		const aberto = { visivel: win.isVisible(), ativo: painel.getActiveTab().id };
		win.close();

		Ext.getCmp('tab_7101').destroy();
		store.remove(store.getById(7101));
		return aberto;
	}, fixture);

	expect(passo).toEqual({ visivel: true, ativo: 'tab_7101' });
});

test('switches a service\'s notifications and sound from its right click', async () => {
	const fixture = 'file://' + path.join(repoRoot, 'test', 'fixtures', 'service.html');
	const passos = await shep.window.evaluate(url => {
		const painel = Ext.cq1('app-main');
		const store = Ext.getStore('Services');
		const rec = store.add({ id: 7401, type: 'custom', name: 'Toggles', url: url, enabled: true })[0];

		painel.suspendEvent('add');
		painel.insert(1, { xtype: 'webview', id: 'tab_7401', record: rec, tabConfig: { service: rec } });
		painel.resumeEvent('add');

		const aba = Ext.getCmp('tab_7401');
		const menu = aba.tab.menu;
		const chaves = () => {
			menu.show();
			const r = { notificacoes: menu.down('#notificationsOn').isVisible(), som: menu.down('#soundOn').isVisible() };
			menu.hide();
			return r;
		};
		const antes = chaves();
		menu.down('#notificationsOn').handler.call(aba);
		menu.down('#soundOn').handler.call(aba);
		const depois = { notifications: rec.get('notifications'), muted: rec.get('muted'), abaMuda: aba.muted };
		const reaberto = chaves();

		aba.destroy();
		store.remove(rec);
		painel.setActiveTab('shepTab');
		return { antes, depois, reaberto };
	}, fixture);

	expect(passos.antes).toEqual({ notificacoes: true, som: true });
	expect(passos.depois).toEqual({ notifications: false, muted: true, abaMuda: true });
	expect(passos.reaberto).toEqual({ notificacoes: false, som: false });
});

test('exposes the camera channel a service reports its setting on', async () => {
	const exposto = await shep.window.evaluate(() => {
		try {
			shep.ipc.send('service:setMediaAccess', 'persist:probe', true);
			return true;
		} catch (e) {
			return e.message;
		}
	});

	expect(exposto).toBe(true);
});

test('zooms from the level a service was saved with and shows it as a percentage', async () => {
	const fixture = 'file://' + path.join(repoRoot, 'test', 'fixtures', 'service.html');
	const id = await shep.window.evaluate(url => {
		const rec = Ext.getStore('Services').add({ id: 7501, type: 'custom', name: 'Zoom', url, enabled: true, zoomLevel: 1 })[0];
		Ext.cq1('app-main').insert(1, { xtype: 'webview', id: 'tab_7501', record: rec, tabConfig: { service: rec } });
		Ext.cq1('app-main').setActiveTab('tab_7501');
		return 7501;
	}, fixture);
	await shep.window.waitForFunction(id => {
		try { return !!Ext.getCmp('tab_' + id).getWebView().getWebContentsId(); } catch { return false; }
	}, id, { timeout: 10000 });

	const zoom = await shep.window.evaluate(() => {
		const aba = Ext.getCmp('tab_7501');
		const menu = aba.tab.menu;
		menu.show();
		const aberto = menu.down('#zoomReset').getText();
		aba.zoomIn();
		const depois = { nivel: aba.record.get('zoomLevel'), rotulo: menu.down('#zoomReset').getText() };
		aba.resetZoom();
		const zerado = menu.down('#zoomReset').getText();
		menu.hide();

		aba.destroy();
		Ext.getStore('Services').remove(aba.record);
		Ext.cq1('app-main').setActiveTab('shepTab');
		return { aberto, depois, zerado };
	});

	expect(zoom).toEqual({ aberto: '120%', depois: { nivel: 1.25, rotulo: '126%' }, zerado: '100%' });
});
