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
		() => redil.ipc.sendSync('app:getVersion'));

	expect(version).toBe(require(path.join(repoRoot, 'package.json')).version);
});

test('serves the preference defaults over getConfig', async () => {
	const config = await redil.window.evaluate(
		() => redil.ipc.sendSync('getConfig'));

	// main.js calls this block the authoritative list of every preference key,
	// so a rename there should fail here rather than at runtime.
	expect(config).toMatchObject({
		 always_on_top: false
		,hide_menu_bar: false
		,theme: 'system'
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
		,chrome: redil.versions.chrome
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

test('runs the renderer without node', async () => {
	const reach = await redil.window.evaluate(() => ({
		 require: typeof require
		,process: typeof process
		,module: typeof module
		,bridge: typeof window.redil
	}));

	// nodeIntegration is off and contextIsolation is on, so the page cannot pull
	// in a module; electron/preload.js is the whole of its reach into Electron.
	expect(reach).toEqual({ require: 'undefined', process: 'undefined', module: 'undefined', bridge: 'object' });
});

test('refuses a channel the preload does not expose', async () => {
	const refused = await redil.window.evaluate(() => {
		try { redil.ipc.send('image:download', 'https://example.com/a.png'); return null; }
		catch (error) { return error.message; }
	});

	// A bridge that forwarded anything would hand back most of what the
	// isolation removes, so both directions are allowlisted.
	expect(refused).toContain('not exposed to the renderer');
});

test('keeps the shortcuts working without requiring mousetrap', async () => {
	// The renderer required it as a node module; it is a plain browser library
	// and the generator now loads it as a script.
	const bound = await redil.window.evaluate(() => typeof window.Mousetrap === 'object' || typeof window.Mousetrap === 'function');
	expect(bound).toBe(true);
});

test('puts the service bar on the left, as a rail of icons', async () => {
	const rail = await redil.window.evaluate(() => {
		const bar = Ext.getCmp('mainTabBar');
		return {
			 posicao: Ext.cq1('app-main').getTabPosition()
			,largura: Math.round(bar.el.dom.getBoundingClientRect().width)
			// Ext.tab.Tab extends Ext.button.Button, so the tabs answer to that too.
			,botoes: bar.items.items
				.filter(item => item.isXType && item.isXType('button') && !item.isXType('tab'))
				.map(item => item.handler)
			,abaInicialOculta: Ext.getCmp('redilTab').tab.isHidden()
			,rotulos: bar.el.dom.querySelectorAll('.x-tab-inner').length
			,rotulosVisiveis: [...bar.el.dom.querySelectorAll('.x-tab-inner')]
				.filter(el => el.offsetParent !== null).length
		};
	});

	expect(rail.posicao).toBe('left');
	expect(rail.largura).toBe(68);
	// Add a service above the fill; below it the home tab and the three that were
	// the home tab's own toolbar until they moved here, which meant they vanished
	// whenever a service was open. The top of the rail is services only, so the
	// home tab is a glyph down here rather than the app's mark up there.
	expect(rail.botoes).toEqual(['openCatalogue', 'showHome', 'dontDisturb', 'lockRedil', 'openPreferences']);
	expect(rail.abaInicialOculta).toBe(true);
	// Icons only: the label elements exist, and none of them is shown.
	expect(rail.rotulos).toBeGreaterThan(0);
	expect(rail.rotulosVisiveis).toBe(0);
});

test('splits the preferences into sections without unbinding a field', async () => {
	const prefs = await redil.window.evaluate(() => {
		const win = Ext.create('Redil.view.preferences.Preferences');
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

test('opens on the unread summary, with the catalogue behind a button', async () => {
	const inicio = await redil.window.evaluate(() => {
		const catalogo = Ext.getCmp('redilTab').down('#catalogue');
		return {
			 flutuante: !!catalogo.floating
			,oculto: catalogo.isHidden()
			,resumo: Ext.getCmp('redilTab').down('#unreadSummary').el.dom.innerText.trim()
		};
	});

	// The catalogue used to be two thirds of this screen, which made a list of
	// 104 services the app's front door.
	expect(inicio.flutuante).toBe(true);
	expect(inicio.oculto).toBe(true);
	expect(inicio.resumo).toContain('No unread messages');

	// The summary is written from the totalNotifications config, which
	// UnreadCounter drives, so a count set anywhere reaches it.
	const comNaoLidas = await redil.window.evaluate(() => {
		Redil.util.UnreadCounter.setUnreadCountForService(99, 4);
		const texto = Ext.getCmp('redilTab').down('#unreadSummary').el.dom.innerText.trim();
		Redil.util.UnreadCounter.clearUnreadCountForService(99);
		return texto;
	});
	expect(comNaoLidas).toContain('4 unread messages');

	const aberto = await redil.window.evaluate(() => {
		Ext.cq1('app-main').getController().openCatalogue();
		const catalogo = Ext.getCmp('redilTab').down('#catalogue');
		const visivel = catalogo.isVisible();
		catalogo.hide();
		return visivel;
	});
	expect(aberto).toBe(true);
});

test('draws the service list from a template, one node per service', async () => {
	const lista = await redil.window.evaluate(() => {
		const view = Ext.getCmp('redilTab').down('#serviceList');
		const store = view.getStore();

		store.add({ id: 4141, type: 'custom', name: 'Probe', url: 'file:///probe.html',
			align: 'left', enabled: true, notifications: true, muted: false });
		Redil.util.UnreadCounter.setUnreadCountForService(4141, 3);
		view.refresh();

		const linha = view.el.dom.querySelector('.rx-service');
		const resultado = {
			 nos: view.getNodes().length
			,registros: store.getCount()
			,nome: linha.querySelector('.rx-service-name').textContent
			,naoLidas: linha.querySelector('.rx-unread').textContent
			,estado: linha.querySelector('.rx-state').textContent
			,ponto: linha.querySelector('.rx-dot').className
			// Edit, remove and the enable toggle: what the grid spent three
			// columns on, dispatched from one click handler by data-act.
			,acoes: [...linha.querySelectorAll('.rx-act')].map(a => a.getAttribute('data-act'))
		};

		Redil.util.UnreadCounter.clearUnreadCountForService(4141);
		store.remove(store.getById(4141));
		return resultado;
	});

	expect(lista.nos).toBe(lista.registros);
	expect(lista.nome).toBe('Probe');
	expect(lista.naoLidas).toBe('3 unread');
	expect(lista.estado).toBe('Active');
	expect(lista.ponto).toContain('rx-dot-active');
	expect(lista.acoes).toEqual(['edit', 'remove', 'toggle']);
});

test('filters the catalogue by type and by name at the same time', async () => {
	// The two controls used to filter the store independently, so typing a name
	// replaced the type filter and vice versa. They are one filter now, and the
	// tally under them counts what is left, minus the synthetic custom entry.
	const filtro = await redil.window.evaluate(() => {
		const controlador = Ext.cq1('app-main').getController();
		const catalogo = Ext.getCmp('redilTab').down('#catalogue');
		controlador.openCatalogue();

		const contagem = () => catalogo.down('#catalogueCount').el.dom.textContent;
		const nomes = () => {
			const lista = [];
			Ext.getStore('ServicesList').each(r => { if ( r.get('type') !== 'custom' ) lista.push(r.get('name')); });
			return lista;
		};

		const resultado = { aberto: contagem() };

		// pressing the button, not setValue: Ext suppresses the toggle event while
		// it applies a value, so setValue would change the control and filter nothing
		const porTipo = valor => catalogo.down('#catalogueFilter').items.findBy(b => b.value === valor).setPressed(true);
		porTipo('email');
		resultado.email = nomes().length;
		const tipos = [];
		Ext.getStore('ServicesList').each(r => { if ( !tipos.includes(r.get('type')) ) tipos.push(r.get('type')); });
		resultado.tipos = tipos.sort();

		catalogo.down('#catalogueSearch').setValue('gm');
		resultado.emailEGm = nomes();
		resultado.rotulo = contagem();

		catalogo.down('#catalogueSearch').setValue('');
		porTipo('all');
		catalogo.hide();
		return resultado;
	});

	expect(filtro.aberto).toMatch(/^\d+ services$/);
	expect(filtro.email).toBeGreaterThan(3);
	// the custom entry stays whatever the filter says, since it is how a service
	// the catalogue does not carry gets added
	expect(filtro.tipos).toEqual(['custom', 'email']);
	expect(filtro.emailEGm).toEqual(['Gmail']);
	expect(filtro.rotulo).toBe('1 service');
});

test('keeps the custom entry last under a name the add window can print', async () => {
	const custom = await redil.window.evaluate(() => {
		const store = Ext.getStore('ServicesList');
		return {
			 nome: store.getById('custom').get('name')
			,ultimo: store.getAt(store.getCount() - 1).getId()
		};
	});

	// It used to be called '_Custom Service' to sort itself to the end, and the
	// Add window titles itself from the record, so it read "Add _Custom Service".
	expect(custom.nome).toBe('Custom Service');
	expect(custom.ultimo).toBe('custom');
});

test('reorders the rail and writes the order back to the store', async () => {
	// The reorderer moves the card and the panel fires childmove; updatePositions
	// walks the rail from there. It used to finish with store.load(), which threw
	// inside the home tab's list, so any page error here is the regression.
	const erros = [];
	const anotar = e => erros.push(String(e));
	redil.window.on('pageerror', anotar);

	const fixture = 'file://' + path.join(repoRoot, 'test', 'fixtures', 'service.html');
	const ordem = await redil.window.evaluate(url => {
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
			,nos: Ext.getCmp('redilTab').down('#serviceList').getNodes().length
			,itens: Ext.getStore('Services').getCount()
		};

		[7001, 7002, 7003].forEach(id => {
			Ext.getCmp('tab_' + id).destroy();
			store.remove(store.getById(id));
		});
		return resultado;
	}, fixture);

	redil.window.off('pageerror', anotar);

	expect(erros).toEqual([]);
	expect(ordem.abas.slice(0, 4)).toEqual(['redilTab', 'tab_7002', 'tab_7003', 'tab_7001']);
	// the store follows the rail, and nothing crossed into the right group
	expect(ordem.loja).toEqual(['Reorder 2:left', 'Reorder 3:left', 'Reorder 1:left']);
	expect(ordem.nos).toBe(ordem.itens);
});

test('exposes the online check the renderer runs at boot', async () => {
	// Application.js invokes this before it loads the services; it was left out
	// of the preload's allowlist when is-online moved to the main process, so the
	// call threw on every launch. The promise is not awaited: what is under test
	// is the allowlist, not the network.
	const exposto = await redil.window.evaluate(() => {
		try {
			redil.ipc.invoke('net:isOnline');
			return true;
		} catch (e) {
			return e.message;
		}
	});

	expect(exposto).toBe(true);
});

test('opens the catalogue from a service and goes back to it', async () => {
	// The catalogue is a floating child of the home tab, so the card layout hid
	// it with the card: from a service the + did nothing. Reordering made this
	// easy to hit, because the reorderer activates the tab it just moved.
	const fixture = 'file://' + path.join(repoRoot, 'test', 'fixtures', 'service.html');
	const passo = await redil.window.evaluate(url => {
		const painel = Ext.cq1('app-main');
		const store = Ext.getStore('Services');
		const rec = store.add({ id: 7101, type: 'custom', name: 'From service', url: url,
			align: 'left', position: 0, enabled: true, notifications: false, muted: false })[0];

		painel.suspendEvent('add');
		painel.insert(1, { xtype: 'webview', id: 'tab_7101', title: '', tooltip: rec.get('name'),
			src: url, type: 'custom', enabled: true, record: rec, tabConfig: { service: rec } });
		painel.resumeEvent('add');
		painel.setActiveTab('tab_7101');

		const controlador = painel.getController();
		const catalogo = Ext.getCmp('redilTab').down('#catalogue');

		controlador.openCatalogue();
		const aberto = { visivel: catalogo.isVisible(), ativo: painel.getActiveTab().id };

		// close(), not hide(): a panel closes by destroying itself unless it is
		// told otherwise, and a destroyed catalogue makes every later + a no-op.
		catalogo.close();
		const fechado = { visivel: catalogo.isVisible(), ativo: painel.getActiveTab().id };

		controlador.openCatalogue();
		const reaberto = { visivel: catalogo.isVisible(), ativo: painel.getActiveTab().id };
		catalogo.close();

		Ext.getCmp('tab_7101').destroy();
		store.remove(store.getById(7101));
		return { aberto: aberto, fechado: fechado, reaberto: reaberto };
	}, fixture);

	expect(passo.aberto).toEqual({ visivel: true, ativo: 'redilTab' });
	expect(passo.fechado).toEqual({ visivel: false, ativo: 'tab_7101' });
	expect(passo.reaberto).toEqual({ visivel: true, ativo: 'redilTab' });
});

test('seeds the media permission from the catalogue and exposes the channel', async () => {
	// A person who adds Google Meet is asking for a camera and a microphone, so
	// the checkbox arrives ticked and main grants the permission without a
	// dialog. Anything the catalogue does not mark still has to be answered.
	const caixas = await redil.window.evaluate(() => {
		const ler = id => {
			const janela = Ext.create('Redil.view.add.Add', { record: Ext.getStore('ServicesList').getById(id) });
			const valor = janela.down('checkbox[name=media]').getValue();
			janela.destroy();
			return valor;
		};

		return { chamada: ler('googlemeet'), correio: ler('gmail') };
	});

	expect(caixas).toEqual({ chamada: true, correio: false });

	const exposto = await redil.window.evaluate(() => {
		try {
			redil.ipc.send('service:setMediaAccess', 'persist:probe', true);
			return true;
		} catch (e) {
			return e.message;
		}
	});

	expect(exposto).toBe(true);
});

test('names the services that are waiting instead of counting them again', async () => {
	// "in 1 of your 6 services" is the one thing on that line the rail and the
	// list below do not already say -- and it says nothing you can act on.
	const linhas = await redil.window.evaluate(() => {
		const store = Ext.getStore('Services');
		const registros = ['Fixture one', 'Fixture two', 'Fixture three'].map((name, i) => store.add({
			 id: 7201 + i, type: 'custom', name: name, url: 'file:///probe.html'
			,align: 'left', enabled: true, notifications: false, muted: false
		})[0]);

		const ler = () => Ext.getCmp('redilTab').down('#unreadSummary').el.dom.innerText.trim().split('\n').pop();

		Redil.util.UnreadCounter.setUnreadCountForService(7201, 2);
		const um = ler();
		Redil.util.UnreadCounter.setUnreadCountForService(7202, 1);
		const dois = ler();
		Redil.util.UnreadCounter.setUnreadCountForService(7203, 4);
		const tres = ler();

		[7201, 7202, 7203].forEach(id => Redil.util.UnreadCounter.clearUnreadCountForService(id));
		registros.forEach(record => store.remove(record));
		return { um: um, dois: dois, tres: tres };
	});

	expect(linhas.um).toBe('in Fixture one');
	expect(linhas.dois).toBe('in Fixture one and Fixture two');
	// past two names the line would be a list, so it counts again
	expect(linhas.tres).toMatch(/^in 3 of your \d+ services$/);
});
