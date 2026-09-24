import { join } from 'node:path';
import { app, dialog, Menu, WebContentsView, type BrowserWindow, type WebContents } from 'electron';
import { RAIL_WIDTH, TITLE_BAR_HEIGHT } from '../shared/chrome.ts';
import { nameFromUrl, normalizeUrl } from '../shared/address.ts';
import type { ServiceRecord, ServiceState, UnreadCount } from '../shared/service.ts';
import { store, updateService } from './store.ts';
import { countFromTitle, createBlinkGuard, totalUnread } from './unread.ts';
import { faviconFor } from './favicon.ts';
import { followColorScheme } from './theme.ts';
import { applyPermissionPolicy } from './permissions.ts';
import { keepLinksInTheApp } from './auxiliary.ts';
import { attachPageMenu } from './menus.ts';
import { serviceMenu } from './servicemenu.ts';
import { NOTIFICATION_WRAPPER } from './notifications.ts';
import type { KeyInput } from './shortcuts.ts';
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
	// true when the key was an app shortcut, which the page then never sees
	shortcut(input: KeyInput): boolean;
}

const ZOOM_STEP = 0.25;

export class ServiceHost {
	private readonly running = new Map<string, RunningService>();

	constructor(private readonly window: BrowserWindow, private readonly events: ServiceHostEvents) {
		window.on('resize', () => this.layout());
		window.on('closed', () => this.running.forEach(service => service.disposeBlinkGuard()));
	}

	start(): void {
		for ( const record of store.get('services') ) if ( record.enabled ) this.run(record);
		const active = store.get('activeServiceId');
		this.activate(active && this.running.has(active) ? active : null);
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
				loading: running?.view.webContents.isLoading() ?? false,
				workspace: record.workspace,
				shown: isShownIn(record.workspace, store.get('activeWorkspace'))
			};
		});
	}

	activate(id: string | null): void {
		store.set('activeServiceId', id);
		this.running.forEach((service, serviceId) => service.view.setVisible(serviceId === id));
		this.layout();
		this.focusActive();
		this.announce();
	}

	focusActive(): void {
		const active = store.get('activeServiceId');
		if ( active ) this.running.get(active)?.view.webContents.focus();
	}

	add(address: string, name: string, workspace = store.get('activeWorkspace') ?? ''): string | null {
		const url = normalizeUrl(address);
		if ( !url ) return null;
		const services = store.get('services');
		const id = String(services.reduce((highest, service) => Math.max(highest, Number(service.id) || 0), 0) + 1);
		const record: ServiceRecord = {
			id, url, name: name.trim() || nameFromUrl(url), partition: `persist:custom_${id}`, workspace,
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

	navigate(id: string, where: 'back' | 'forward' | 'reload'): void {
		const contents = this.contentsOf(id);
		if ( !contents ) return;
		const history = contents.navigationHistory;
		if ( where === 'back' && history.canGoBack() ) history.goBack();
		if ( where === 'forward' && history.canGoForward() ) history.goForward();
		if ( where === 'reload' ) contents.reload();
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
		const history = contents?.navigationHistory;
		const setZoom = (level: number) => {
			updateService(id, { zoomLevel: level });
			contents?.setZoomLevel(level);
		};
		const items = serviceMenu({
			enabled: record.enabled,
			canGoBack: history?.canGoBack() ?? false,
			canGoForward: history?.canGoForward() ?? false,
			notifications: record.notifications,
			sound: !record.muted,
			zoomLevel: record.zoomLevel,
			workspaces: store.get('workspaces'),
			workspace: record.workspace
		}, {
			back: () => this.navigate(id, 'back'),
			forward: () => this.navigate(id, 'forward'),
			reload: () => this.navigate(id, 'reload'),
			zoomIn: () => setZoom(this.record(id).zoomLevel + ZOOM_STEP),
			zoomOut: () => setZoom(this.record(id).zoomLevel - ZOOM_STEP),
			resetZoom: () => setZoom(0),
			toggleNotifications: () => updateService(id, { notifications: !this.record(id).notifications }),
			toggleSound: () => {
				updateService(id, { muted: !this.record(id).muted });
				this.applyMute(id);
			},
			toggleEnabled: () => this.setEnabled(id, !this.record(id).enabled),
			edit: () => this.events.edit(id),
			moveToWorkspace: workspace => this.moveToWorkspace(id, workspace),
			remove: () => { this.confirmRemove(id); },
			developerTools: () => contents?.openDevTools({ mode: 'detach' })
		});
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
		return !store.get('dontDisturb') && this.record(id).notifications;
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
		if ( !active ) return;
		const level = step === 0 ? 0 : this.record(active).zoomLevel + step * ZOOM_STEP;
		updateService(active, { zoomLevel: level });
		this.contentsOf(active)?.setZoomLevel(level);
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
		this.contentsOf(id)?.setAudioMuted(store.get('dontDisturb') || this.record(id).muted);
	}

	private async confirmRemove(id: string): Promise<void> {
		const { response } = await dialog.showMessageBox(this.window, {
			type: 'question',
			buttons: ['Remove', 'Cancel'],
			defaultId: 1,
			cancelId: 1,
			message: `Remove ${this.record(id).name}?`,
			detail: 'Its sign-in and everything it stored on this computer go with it.'
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
		const record = store.get('services').find(service => service.id === id);
		if ( !record ) throw new Error('No service with id ' + id);
		return record;
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
				sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: true
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

		applyPermissionPolicy(contents.session, this.window, () => this.record(record.id));
		followColorScheme(contents);
		attachPageMenu(contents);
		keepLinksInTheApp(contents, contents);
		this.applyMute(record.id);
		contents.on('dom-ready', () => { contents.executeJavaScript(NOTIFICATION_WRAPPER).catch(() => {}); });

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
				if ( !favicon || favicon === this.record(record.id).favicon ) return;
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
		contents.on('did-finish-load', () => contents.setZoomLevel(this.record(record.id).zoomLevel));
		contents.on('certificate-error', (event, url, error, certificate, callback) => {
			const trusted = this.record(record.id).trust;
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
