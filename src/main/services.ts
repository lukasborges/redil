import { app, WebContentsView, type BrowserWindow, type WebContents } from 'electron';
import { RAIL_WIDTH, TITLE_BAR_HEIGHT } from '../shared/chrome.ts';
import type { ServiceRecord, ServiceState, UnreadCount } from '../shared/service.ts';
import { store, updateService } from './store.ts';
import { countFromTitle, createBlinkGuard, totalUnread } from './unread.ts';
import { faviconFor } from './favicon.ts';
import { followColorScheme } from './theme.ts';
import { applyPermissionPolicy } from './permissions.ts';
import { keepLinksInTheApp } from './auxiliary.ts';
import { attachPageMenu } from './menus.ts';

interface RunningService {
	view: WebContentsView;
	unread: UnreadCount;
	pageTitle: string;
	disposeBlinkGuard: () => void;
}

const HISTORY_KEYS = { ArrowLeft: 'back', ArrowRight: 'forward' } as const;

export class ServiceHost {
	private readonly running = new Map<string, RunningService>();

	constructor(private readonly window: BrowserWindow) {
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
			return {
				id: record.id,
				name: record.name,
				favicon: record.favicon,
				enabled: record.enabled,
				unread: running?.unread ?? 0,
				pageTitle: running?.pageTitle ?? '',
				active: record.id === active
			};
		});
	}

	activate(id: string | null): void {
		store.set('activeServiceId', id);
		this.running.forEach((service, serviceId) => service.view.setVisible(serviceId === id));
		this.layout();
		if ( id ) this.running.get(id)?.view.webContents.focus();
		this.announce();
	}

	contentsOf(id: string): WebContents | undefined {
		return this.running.get(id)?.view.webContents;
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
	}

	private run(record: ServiceRecord): void {
		const view = new WebContentsView({
			webPreferences: { partition: record.partition, sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: true }
		});
		view.setVisible(false);
		this.window.contentView.addChildView(view);

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
		contents.setAudioMuted(record.muted);

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
		contents.on('did-finish-load', () => contents.setZoomLevel(this.record(record.id).zoomLevel));
		contents.on('certificate-error', (event, url, error, certificate, callback) => {
			const trusted = this.record(record.id).trust;
			if ( trusted ) event.preventDefault();
			callback(trusted);
			if ( !trusted && !this.window.isDestroyed() ) this.window.webContents.send('services:certificate-error', record.id);
		});
		contents.on('before-input-event', (event, input) => {
			const direction = HISTORY_KEYS[input.key as keyof typeof HISTORY_KEYS];
			if ( input.type !== 'keyDown' || !input.alt || input.control || input.shift || input.meta || !direction ) return;
			event.preventDefault();
			const history = contents.navigationHistory;
			if ( direction === 'back' && history.canGoBack() ) history.goBack();
			if ( direction === 'forward' && history.canGoForward() ) history.goForward();
		});

		contents.loadURL(record.url);
	}
}
