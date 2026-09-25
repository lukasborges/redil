import { join } from 'node:path';
import { app, dialog, Menu, WebContentsView, type BrowserWindow, type WebContents } from 'electron';
import { RAIL_WIDTH, TITLE_BAR_HEIGHT } from '../shared/chrome.ts';
import { nameFromUrl, normalizeUrl } from '../shared/address.ts';
import type { Navigation, ServiceRecord, ServiceState, UnreadCount } from '../shared/service.ts';
import { preferences, store, updateService } from './store.ts';
import { countFromTitle, createBlinkGuard, totalUnread } from './unread.ts';
import { faviconFor } from './favicon.ts';
import { followColorScheme } from './theme.ts';
import { applyPermissionPolicy } from './permissions.ts';
import { keepLinksInTheApp } from './auxiliary.ts';
import { attachPageMenu } from './menus.ts';
import { serviceMenu } from './servicemenu.ts';
import { NOTIFICATION_WRAPPER } from './notifications.ts';

// A page that marks itself as a title bar, as Teams does, would take the window's clicks, and
// the region outlives the page. A user stylesheet outranks the page's own !important.
const NO_WINDOW_DRAGGING = '* { app-region: no-drag !important; }';
import type { KeyInput } from './shortcuts.ts';
import { mainMessages } from './messages.ts';
import { fill } from '../shared/i18n/index.ts';
import { isShownIn, type ActiveWorkspace } from '../shared/workspace.ts';

interface RunningService {
	view: WebContentsView;
	unread: UnreadCount;
	pageTitle: string;
	disposeBlinkGuard: () => void;
}

export interface ServiceHostEvents {
	edit(id: string): void;
	changed(): void;
	sessionStarted(session: Electron.Session): void;
	// true when the key was an app shortcut, which the page then never sees
	shortcut(input: KeyInput): boolean;
}

const ZOOM_STEP = 0.25;

export class ServiceHost {
	private readonly running = new Map<string, RunningService>();
	private locked = false;

	constructor(private readonly window: BrowserWindow, private readonly events: ServiceHostEvents) {
		window.on('resize', () => this.layout());
		window.on('closed', () => this.running.forEach(service => service.disposeBlinkGuard()));
	}

	start(): void {
		for ( const record of store.get('services') ) if ( record.enabled ) this.run(record);
		const { openOnStart } = preferences();
		const wanted = openOnStart === 'welcome' ? null : openOnStart === 'last' ? store.get('activeServiceId') : openOnStart;
		this.activate(wanted && this.running.has(wanted) && this.shownIds().includes(wanted) ? wanted : null);
	}

	async clearCaches(): Promise<void> {
		await Promise.all([...this.running.values()].map(service => service.view.webContents.session.clearCache()));
	}

	async confirmRemoveAll(): Promise<void> {
		const messages = mainMessages();
		const { response } = await dialog.showMessageBox(this.window, {
			type: 'warning', buttons: [messages['removeAll.confirm'], messages['dialog.cancel']], defaultId: 1, cancelId: 1,
			message: messages['removeAll.message'], detail: messages['removeAll.detail']
		});
		if ( response !== 0 ) return;
		const sessions = [...this.running.values()].map(service => service.view.webContents.session);
		for ( const id of [...this.running.keys()] ) this.stop(id);
		store.set('services', []);
		await Promise.all(sessions.map(session => session.clearStorageData().catch(() => {})));
		this.activate(null);
	}

	list(): ServiceState[] {
		const active = store.get('activeServiceId');
		return store.get('services').map(record => {
			const running = this.running.get(record.id);
			const history = running?.view.webContents.navigationHistory;
			return {
				id: record.id,
				name: record.name,
				favicon: record.favicon,
				enabled: record.enabled,
				unread: running?.unread ?? 0,
				pageTitle: running?.pageTitle ?? '',
				active: record.id === active,
				canGoBack: history?.canGoBack() ?? false,
				canGoForward: history?.canGoForward() ?? false,
				zoomLevel: record.zoomLevel,
				loading: running?.view.webContents.isLoading() ?? false,
				workspace: record.workspace,
				shown: isShownIn(record.workspace, store.get('activeWorkspace'))
			};
		});
	}

	// Nothing of a service shows, or takes the keyboard, while the app is locked.
	setLocked(locked: boolean): void {
		this.locked = locked;
		this.activate(store.get('activeServiceId'));
	}

	activate(id: string | null): void {
		store.set('activeServiceId', id);
		this.running.forEach((service, serviceId) => service.view.setVisible(!this.locked && serviceId === id));
		this.layout();
		this.focusActive();
		this.announce();
	}

	focusActive(): void {
		if ( this.locked ) return;
		const active = store.get('activeServiceId');
		if ( active ) this.running.get(active)?.view.webContents.focus();
	}

	add(address: string, name: string, workspace = store.get('activeWorkspace') ?? ''): string | null {
		const url = normalizeUrl(address);
		if ( !url ) return null;
		const services = store.get('services');
		const id = String(services.reduce((highest, service) => Math.max(highest, Number(service.id) || 0), 0) + 1);
		const record: ServiceRecord = {
			id, url, name: name.trim() || nameFromUrl(url), partition: `persist:service-${id}`, workspace,
			enabled: true, notifications: true, muted: false, media: false, trust: false, zoomLevel: 0, favicon: ''
		};
		store.set('services', [...services, record]);
		this.run(record);
		this.activate(id);
		return id;
	}

	update(id: string, address: string, name: string, workspace = this.record(id).workspace): boolean {
		const url = normalizeUrl(address);
		if ( !url ) return false;
		const before = this.record(id);
		updateService(id, { url, name: name.trim() || nameFromUrl(url), workspace });
		if ( before.url !== url ) this.running.get(id)?.view.webContents.loadURL(url);
		this.showWorkspace(store.get('activeWorkspace'));
		return true;
	}

	reorder(ids: string[]): void {
		const byId = new Map(store.get('services').map(service => [service.id, service]));
		const ordered = ids.map(id => byId.get(id)).filter(service => service !== undefined);
		const rest = [...byId.values()].filter(service => !ids.includes(service.id));
		store.set('services', [...ordered, ...rest]);
		this.announce();
	}

	setEnabled(id: string, enabled: boolean): void {
		updateService(id, { enabled });
		if ( enabled ) this.run(this.record(id));
		else this.stop(id);
		this.activate(id);
	}

	navigate(id: string, where: Navigation): void {
		const contents = this.contentsOf(id);
		if ( !contents ) return;
		const history = contents.navigationHistory;
		if ( where === 'back' && history.canGoBack() ) history.goBack();
		if ( where === 'forward' && history.canGoForward() ) history.goForward();
		if ( where === 'reload' ) contents.reload();
		// the address the service was added with
		if ( where === 'home' ) contents.loadURL(this.record(id).url).catch(() => {});
	}

	find(id: string, text: string, forward: boolean): void {
		const contents = this.contentsOf(id);
		if ( !contents ) return;
		if ( text ) contents.findInPage(text, { forward, findNext: true });
		else contents.stopFindInPage('clearSelection');
	}

	stopFind(id: string): void {
		this.contentsOf(id)?.stopFindInPage('keepSelection');
	}

	showMenu(id: string): void {
		const record = this.record(id);
		const contents = this.contentsOf(id);
		const items = serviceMenu({
			enabled: record.enabled,
			notifications: record.notifications,
			sound: !record.muted,
			workspaces: store.get('workspaces'),
			workspace: record.workspace
		}, {
			reload: () => this.navigate(id, 'reload'),
			toggleNotifications: () => updateService(id, { notifications: !(this.existing(id)?.notifications ?? true) }),
			toggleSound: () => {
				updateService(id, { muted: !(this.existing(id)?.muted ?? false) });
				this.applyMute(id);
			},
			toggleEnabled: () => { const current = this.existing(id); if ( current ) this.setEnabled(id, !current.enabled); },
			edit: () => this.events.edit(id),
			moveToWorkspace: workspace => this.moveToWorkspace(id, workspace),
			remove: () => { this.confirmRemove(id); },
			developerTools: () => contents?.openDevTools({ mode: 'detach' })
		}, mainMessages());
		Menu.buildFromTemplate(items).popup({ window: this.window });
	}

	contentsOf(id: string): WebContents | undefined {
		return this.running.get(id)?.view.webContents;
	}

	idOf(contents: WebContents): string | null {
		for ( const [id, service] of this.running ) if ( service.view.webContents === contents ) return id;
		return null;
	}

	mayNotify(id: string): boolean {
		return !store.get('dontDisturb') && (this.existing(id)?.notifications ?? false);
	}

	activeContents(): WebContents | undefined {
		const active = store.get('activeServiceId');
		return active ? this.contentsOf(active) : undefined;
	}

	// The services the rail shows, in its order.
	shownIds(): string[] {
		const active = store.get('activeWorkspace');
		return store.get('services').filter(service => isShownIn(service.workspace, active)).map(service => service.id);
	}

	// Hides the services of other workspaces from the rail; they keep running, counting and notifying.
	showWorkspace(workspace: ActiveWorkspace): void {
		store.set('activeWorkspace', workspace);
		const shown = this.shownIds();
		const active = store.get('activeServiceId');
		if ( active && !shown.includes(active) ) this.activate(shown.find(id => this.running.has(id)) ?? null);
		else this.announce();
	}

	moveToWorkspace(id: string, workspace: string): void {
		updateService(id, { workspace });
		this.showWorkspace(store.get('activeWorkspace'));
	}

	somethingUnread(): boolean {
		return [...this.running.values()].some(service => service.unread === '•' || service.unread > 0);
	}

	unreadElsewhere(): boolean {
		const active = store.get('activeWorkspace');
		return active !== null && store.get('services').some(record => {
			const unread = this.running.get(record.id)?.unread ?? 0;
			return !isShownIn(record.workspace, active) && (unread === '•' || unread > 0);
		});
	}

	activateNth(index: number): void {
		const id = this.shownIds()[index];
		if ( id ) this.activate(id);
	}

	cycle(step: 1 | -1): void {
		const shown = this.shownIds();
		if ( !shown.length ) return;
		const current = shown.indexOf(store.get('activeServiceId') ?? '');
		this.activate(shown[(current + step + shown.length) % shown.length] ?? null);
	}

	zoomActive(step: 1 | -1 | 0): void {
		const active = store.get('activeServiceId');
		const record = active ? this.existing(active) : undefined;
		if ( record ) this.setZoom(record.id, step === 0 ? 0 : record.zoomLevel + step * ZOOM_STEP);
	}

	setZoom(id: string, level: number): void {
		if ( !this.existing(id) ) return;
		updateService(id, { zoomLevel: level });
		this.contentsOf(id)?.setZoomLevel(level);
		this.announce();
	}

	reloadActive(ignoringCache: boolean): void {
		const contents = this.activeContents();
		if ( ignoringCache ) contents?.reloadIgnoringCache();
		else contents?.reload();
	}

	setDontDisturb(on: boolean): void {
		store.set('dontDisturb', on);
		for ( const id of this.running.keys() ) this.applyMute(id);
	}

	private applyMute(id: string): void {
		const record = this.existing(id);
		if ( record ) this.contentsOf(id)?.setAudioMuted(store.get('dontDisturb') || record.muted);
	}

	private async confirmRemove(id: string): Promise<void> {
		const messages = mainMessages();
		const { response } = await dialog.showMessageBox(this.window, {
			type: 'question',
			buttons: [messages['remove.confirm'], messages['dialog.cancel']],
			defaultId: 1,
			cancelId: 1,
			message: fill(messages['remove.message'], { name: this.record(id).name }),
			detail: messages['remove.detail']
		});
		if ( response !== 0 ) return;
		const session = this.contentsOf(id)?.session;
		this.stop(id);
		store.set('services', store.get('services').filter(service => service.id !== id));
		await session?.clearStorageData().catch(() => {});
		if ( store.get('activeServiceId') === id ) this.activate(store.get('services').find(service => service.enabled)?.id ?? null);
		else this.announce();
	}

	private record(id: string): ServiceRecord {
		const record = this.existing(id);
		if ( !record ) throw new Error('No service with id ' + id);
		return record;
	}

	// What a page's own events use: they can still arrive after the service is removed.
	private existing(id: string): ServiceRecord | undefined {
		return store.get('services').find(service => service.id === id);
	}

	private layout(): void {
		const [width = 0, height = 0] = this.window.getContentSize();
		const contentArea = { x: RAIL_WIDTH, y: TITLE_BAR_HEIGHT, width: Math.max(0, width - RAIL_WIDTH), height: Math.max(0, height - TITLE_BAR_HEIGHT) };
		this.running.forEach(service => service.view.setBounds(contentArea));
	}

	private announce(): void {
		if ( this.window.isDestroyed() ) return;
		this.window.webContents.send('services:changed', this.list());
		app.setBadgeCount(totalUnread([...this.running.values()].map(service => service.unread)));
		this.events.changed();
	}

	private stop(id: string): void {
		const running = this.running.get(id);
		if ( !running ) return;
		running.disposeBlinkGuard();
		this.window.contentView.removeChildView(running.view);
		running.view.webContents.close();
		this.running.delete(id);
	}

	private run(record: ServiceRecord): void {
		if ( this.running.has(record.id) ) return;
		const view = new WebContentsView({
			webPreferences: {
				partition: record.partition, preload: join(__dirname, '../preload/service.js'),
				sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: preferences().spellcheck
			}
		});
		view.setVisible(false);
		this.window.contentView.addChildView(view, 0);
		this.layout();

		const contents = view.webContents;
		const blinkGuard = createBlinkGuard(count => {
			const running = this.running.get(record.id);
			if ( running ) running.unread = count;
			this.announce();
		});
		this.running.set(record.id, { view, unread: 0, pageTitle: '', disposeBlinkGuard: blinkGuard.dispose });

		applyPermissionPolicy(contents.session, this.window, () => this.existing(record.id));
		this.events.sessionStarted(contents.session);
		// typed into Preferences, and so an override, which Cloudflare's Turnstile refuses
		const { userAgent } = preferences();
		if ( userAgent ) contents.setUserAgent(userAgent);
		followColorScheme(contents);
		attachPageMenu(contents);
		keepLinksInTheApp(contents, contents, () => this.existing(record.id)?.url ?? '');
		this.applyMute(record.id);
		contents.on('dom-ready', () => {
			contents.executeJavaScript(NOTIFICATION_WRAPPER).catch(() => {});
			contents.insertCSS(NO_WINDOW_DRAGGING, { cssOrigin: 'user' }).catch(() => {});
		});

		// the history the navigation events report is committed a tick after they arrive
		const announceSoon = () => setImmediate(() => this.announce());
		for ( const navigation of ['did-navigate', 'did-navigate-in-page', 'did-start-loading', 'did-stop-loading'] as const ) {
			contents.on(navigation as 'did-navigate', announceSoon);
		}
		contents.on('page-title-updated', (event, title) => {
			const running = this.running.get(record.id);
			if ( running ) running.pageTitle = title;
			blinkGuard.fromTitle(countFromTitle(title));
		});
		contents.on('page-favicon-updated', (event, favicons) => {
			faviconFor(favicons, url => contents.session.fetch(url)).then(favicon => {
				const current = this.existing(record.id);
				if ( !favicon || !current || favicon === current.favicon ) return;
				updateService(record.id, { favicon });
				this.announce();
			}, () => {});
		});
		contents.on('update-target-url', (event, url) => {
			if ( !this.window.isDestroyed() ) this.window.webContents.send('services:hover', record.id, url);
		});
		contents.on('found-in-page', (event, result) => {
			if ( !this.window.isDestroyed() ) this.window.webContents.send('services:found', record.id, result.activeMatchOrdinal, result.matches);
		});
		contents.on('did-finish-load', () => contents.setZoomLevel(this.existing(record.id)?.zoomLevel ?? 0));
		contents.on('certificate-error', (event, url, error, certificate, callback) => {
			const trusted = this.existing(record.id)?.trust ?? false;
			if ( trusted ) event.preventDefault();
			callback(trusted);
			if ( !trusted && !this.window.isDestroyed() ) this.window.webContents.send('services:certificate-error', record.id);
		});
		contents.on('before-input-event', (event, input) => {
			if ( this.events.shortcut(input) ) event.preventDefault();
		});

		contents.loadURL(record.url);
	}
}
