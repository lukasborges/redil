const { test, expect } = require('@playwright/test');
const path = require('path');
const { launchShep, closeShep, repoRoot } = require('./helpers/launch');

// Workspaces filter the rail and nothing else: a service outside the active one
// keeps its card, so it keeps counting and notifying. What is checked here is
// which tabs the rail shows, where the active tab goes when it leaves, and what
// becomes of a deleted workspace's services.
const FIXTURE = 'file://' + path.join(repoRoot, 'test', 'fixtures', 'service.html');

let shep;

const rail = () => shep.window.evaluate(() => Shep.util.Workspaces.serviceTabs()
	.filter(tab => !tab.tab.isHidden()).map(tab => tab.record.get('name')));

test.beforeAll(async () => {
	shep = await launchShep();
	await shep.window.evaluate(url => {
		const W = Shep.util.Workspaces;
		const work = W.create('Work'), home = W.create('Personal');
		const add = (id, name, workspace) => {
			Ext.getStore('Services').add({ id, type: 'custom', name, url, enabled: true, notifications: false, muted: true, workspace });
			Ext.cq1('app-main').insert(Ext.cq1('app-main').items.length, { xtype: 'webview', id: 'tab_' + id, src: url, type: 'custom', record: Ext.getStore('Services').getById(id), tabConfig: {} });
		};
		add(9101, 'Mail', work.id);
		add(9102, 'Tracker', work.id);
		add(9103, 'Family', home.id);
		add(9104, 'Chat', '');
		Ext.cq1('app-main').setActiveTab('tab_9101');
	}, FIXTURE);
});

test.afterAll(async () => {
	await closeShep(shep);
});

test('opens the switcher\'s menu from a real click', async () => {
	// Ext will not open an empty menu from a click, and the items are built as
	// it opens; calling showMenu() skips that check, so only a click proves it.
	// onTabChange focuses the new tab's page 300ms after the switch in
	// beforeAll, and a focus change in the middle of the click closes the menu
	await new Promise(resolve => setTimeout(resolve, 500));
	const box = await shep.window.evaluate(() => {
		const r = Ext.getCmp('workspaceSwitcher').el.dom.getBoundingClientRect();
		return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
	});
	await shep.window.mouse.click(box.x, box.y);
	const menu = await shep.window.evaluate(() => {
		const m = Ext.getCmp('workspaceSwitcher').menu;
		// the avatar chip, the unread dot and the shortcut are markup around the name
		const texts = m.items.items.map(i => i.text).filter(Boolean).map(t => {
			const holder = document.createElement('div');
			holder.innerHTML = t;
			holder.querySelectorAll('.rx-ws-chip, .rx-menu-dot, .rx-menu-shortcut').forEach(e => e.remove());
			return holder.textContent.trim();
		});
		const shown = m.isVisible();
		m.hide();
		return { shown, texts };
	});
	expect(menu.shown).toBe(true);
	expect(menu.texts.slice(0, 3)).toEqual(['Work', 'Personal', 'All services']);
});

test('gives two workspaces created at once different ids', async () => {
	const ids = await shep.window.evaluate(() => Shep.util.Workspaces.list().map(w => w.id));
	expect(new Set(ids).size).toBe(2);
});

test('shows a workspace\'s services and the ones in no workspace', async () => {
	await shep.window.evaluate(() => Shep.util.Workspaces.activateByNumber(1));
	expect(await rail()).toEqual(['Mail', 'Tracker', 'Chat']);
});

test('moves off a service that the new workspace hides', async () => {
	await shep.window.evaluate(() => Shep.util.Workspaces.activateByNumber(2));
	expect(await rail()).toEqual(['Family', 'Chat']);
	expect(await shep.window.evaluate(() => Ext.cq1('app-main').getActiveTab().id)).toBe('tab_9103');
});

test('shows everything under All services, the number after the last workspace', async () => {
	await shep.window.evaluate(() => Shep.util.Workspaces.activateByNumber(3));
	expect(await rail()).toEqual(['Mail', 'Tracker', 'Family', 'Chat']);
	expect(await shep.window.evaluate(() => Ext.getCmp('workspaceSwitcher').getText())).toBe('');
});

test('keeps a deleted workspace\'s services, in every workspace', async () => {
	await shep.window.evaluate(() => {
		const W = Shep.util.Workspaces;
		W.remove(W.list()[0].id);
		W.setActive(W.list()[0].id);
	});
	expect(await rail()).toEqual(['Mail', 'Tracker', 'Family', 'Chat']);
	expect(await shep.window.evaluate(() => Shep.util.Workspaces.list().map(w => w.name))).toEqual(['Personal']);
});

test('draws an avatar for a new workspace, keeps it through a rename and lets the initials back', async () => {
	const steps = await shep.window.evaluate(() => {
		const W = Shep.util.Workspaces;
		const id = W.create('Avatars').id;
		const drawn = W.get(id).avatar;
		W.setActive(id);
		const shown = Ext.getCmp('workspaceSwitcher').getText();
		const hasClsAtShow = Ext.getCmp('workspaceSwitcher').el.hasCls('rx-has-avatar');
		W.rename(id, 'Renamed');
		const kept = W.get(id).avatar;
		W.setAvatar(id, null);
		const initials = Ext.getCmp('workspaceSwitcher').getText();
		const known = W.AVATARS.some(a => a.icon === drawn.icon);
		W.remove(id);
		return { known, shownIsGlyph: shown === '' && hasClsAtShow, keptSame: kept.icon === drawn.icon, initials, picker: W.AVATARS.length + 1 };
	});
	// five full rows of six in the picker, the initials first
	expect(steps).toEqual({ known: true, shownIsGlyph: true, keptSame: true, initials: 'RE', picker: 30 });
});

test('moves a service to another workspace from its right click', async () => {
	const result = await shep.window.evaluate(() => {
		const W = Shep.util.Workspaces;
		const target = W.create('Elsewhere');
		W.setActive('');
		const tab = Ext.getCmp('tab_9104');
		const menu = tab.tab.menu;
		menu.show();
		const item = menu.down('#moveToWorkspace');
		const expected = W.list().map(w => w.name).concat('All');
		const names = item.menu.items.items.filter(i => !i.isXType('menuseparator')).map(i => { const d = document.createElement('div'); d.innerHTML = i.text; d.querySelectorAll('.rx-ws-chip').forEach(e => e.remove()); return d.textContent.trim(); });
		const pick = item.menu.items.items.find(i => i.text && i.text.includes('Elsewhere'));
		pick.handler();
		menu.hide();
		W.setActive(target.id);
		const rail = W.visibleServiceTabs().map(t => t.record.get('name'));
		const stored = tab.record.get('workspace') === target.id;
		W.remove(target.id);
		return { shown: !item.isHidden(), names, expected, rail, stored };
	});
	expect(result.shown).toBe(true);
	expect(result.names).toEqual(result.expected);
	expect(result.stored).toBe(true);
	// Mail and Tracker lost their workspace when it was deleted, so they show everywhere
	expect(result.rail).toContain('Chat');
});

