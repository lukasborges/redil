import { join } from 'node:path';
import { app, ipcMain, session, shell, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { productName, version, bugs, homepage } from '../../package.json';
import { withoutAppTokens } from './useragent.ts';
import { createMainWindow } from './window.ts';
import { ServiceHost } from './services.ts';
import { Overlay, type OverlayDialog } from './overlay.ts';
import { Workspaces } from './workspaces.ts';
import { preferences, store } from './store.ts';
import { hashPassword } from './password.ts';
import { PreferenceHost, applyThemeBeforeTheWindow } from './preferences.ts';
import { APP_ACTIONS, type AppAction } from '../shared/channels.ts';
import { DEFAULT_PREFERENCES, type Preferences } from '../shared/preferences.ts';
import { shortcutFor, type KeyInput, type ShortcutAction } from './shortcuts.ts';
import type { AppState } from '../shared/channels.ts';

// Run unpacked from out/main, Electron finds no package.json and calls itself Electron.
app.setName(productName);

const hasOwnUserData = process.argv.some(arg => arg.startsWith('--user-data-dir'));
// Until 1.0 replaces the Ext app, an unpacked run must never open the real Shep profile.
if ( !app.isPackaged && !hasOwnUserData ) app.setPath('userData', join(app.getPath('appData'), 'Shep-next'));

// The default, not setUserAgent per page: Cloudflare Turnstile fails any overridden
// agent with error 600010, since Chromium keeps client hints consistent only with a default.
app.userAgentFallback = withoutAppTokens(app.userAgentFallback);

if ( !preferences().hardwareAcceleration ) app.disableHardwareAcceleration();

// The Wayland app_id the desktop entry matches, or the window is an iconless second app.
app.commandLine.appendSwitch('class', 'shep');
// Under XWayland the screen-share portal sees X windows only, never the screens.
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');

const text = (value: unknown) => typeof value === 'string' ? value : '';

if ( !app.requestSingleInstanceLock() ) {
	app.quit();
} else {
	let mainWindow: ReturnType<typeof createMainWindow> | null = null;
	let services: ServiceHost | null = null;
	let overlay: Overlay | null = null;
	let workspaces: Workspaces | null = null;
	let prefs: PreferenceHost | null = null;

	app.on('second-instance', () => {
		if ( !mainWindow ) return;
		if ( mainWindow.isMinimized() ) mainWindow.restore();
		mainWindow.show();
		mainWindow.focus();
	});

	const handle = (channel: string, listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) => ipcMain.handle(channel, listener);

	handle('app:getVersion', () => version);
	handle('services:list', () => services?.list() ?? []);
	handle('services:activate', (event, id) => services?.activate(typeof id === 'string' ? id : null));
	handle('services:add', (event, url, name, workspace) => services?.add(text(url), text(name), typeof workspace === 'string' ? workspace : undefined) ?? null);
	handle('services:update', (event, id, url, name, workspace) => services?.update(text(id), text(url), text(name), typeof workspace === 'string' ? workspace : undefined) ?? false);
	handle('services:reorder', (event, ids) => services?.reorder(Array.isArray(ids) ? ids.map(text) : []));
	handle('services:menu', (event, id) => services?.showMenu(text(id)));
	handle('services:record', (event, id) => store.get('services').find(service => service.id === text(id)) ?? null);
	handle('service:navigate', (event, id, where) => {
		if ( where === 'back' || where === 'forward' || where === 'reload' ) services?.navigate(text(id), where);
	});
	handle('service:find', (event, id, query, forward) => services?.find(text(id), text(query), forward !== false));
	handle('service:stopFind', (event, id) => services?.stopFind(text(id)));
	handle('overlay:open', (event, dialog) => overlay?.open(dialog as OverlayDialog));
	handle('overlay:close', () => overlay?.close());

	handle('workspaces:menu', () => workspaces?.showMenu());
	handle('workspaces:save', (event, id, name) => workspaces?.save(typeof id === 'string' ? id : null, text(name)));
	handle('workspaces:get', (event, id) => store.get('workspaces').find(workspace => workspace.id === text(id)) ?? null);

	const appState = (): AppState => ({
		dontDisturb: store.get('dontDisturb'),
		workspaces: store.get('workspaces'),
		activeWorkspace: store.get('activeWorkspace'),
		unreadElsewhere: services?.unreadElsewhere() ?? false,
		language: preferences().language === 'auto' ? app.getLocale() : preferences().language
	});
	const announceState = () => mainWindow?.webContents.send('app:state', appState());
	const setDontDisturb = (on: boolean) => {
		services?.setDontDisturb(on);
		announceState();
	};
	handle('app:state', () => appState());
	handle('preferences:get', () => preferences());
	handle('preferences:set', (event, key, value) => {
		if ( typeof key !== 'string' || !(key in DEFAULT_PREFERENCES) ) return false;
		return prefs?.set(key as keyof Preferences, value) ?? false;
	});
	handle('spellcheck:languages', () => session.defaultSession.availableSpellCheckerLanguages);
	handle('lock:hasPassword', () => store.get('lockPasswordHash') !== '');
	handle('lock:setPassword', (event, password) => {
		const chosen = text(password);
		store.set('lockPasswordHash', chosen ? hashPassword(chosen) : '');
		if ( !chosen ) prefs?.set('lockOnStart', false);
	});
	handle('app:about', () => ({ version, electron: process.versions.electron, chrome: process.versions.chrome, homepage }));
	handle('services:report', () => services?.list().map(service => ({ name: service.name, pageTitle: service.pageTitle, unread: service.unread })) ?? []);
	handle('app:action', (event, action) => {
		if ( !APP_ACTIONS.includes(action as AppAction) ) return;
		switch ( action as AppAction ) {
			case 'reportIssue': return shell.openExternal(bugs.url);
			case 'clearCache': return services?.clearCaches();
			case 'removeAllServices': return services?.confirmRemoveAll();
			case 'relaunch': app.relaunch(); app.exit(0); return;
			case 'checkForUpdates': return;
		}
	});
	handle('app:setDontDisturb', (event, on) => setDontDisturb(on === true));

	const bringForward = () => {
		if ( !mainWindow ) return;
		if ( mainWindow.isMinimized() ) mainWindow.restore();
		mainWindow.show();
		mainWindow.focus();
	};
	ipcMain.on('service:notification-click', event => {
		const id = services?.idOf(event.sender);
		bringForward();
		if ( id ) services?.activate(id);
	});
	ipcMain.on('service:may-notify', event => {
		const id = services?.idOf(event.sender);
		event.returnValue = id ? services?.mayNotify(id) ?? false : false;
	});

	function run(shortcut: ShortcutAction): void {
		const active = store.get('activeServiceId');
		switch ( shortcut.action ) {
			case 'service': return services?.activateNth(shortcut.index);
			case 'cycle': return services?.cycle(shortcut.step);
			case 'find': mainWindow?.webContents.send('titlebar:find'); mainWindow?.webContents.focus(); return;
			case 'reload': return services?.reloadActive(shortcut.ignoringCache);
			case 'zoom': return services?.zoomActive(shortcut.step);
			case 'history': if ( active ) services?.navigate(active, shortcut.direction); return;
			case 'fullscreen': mainWindow?.setFullScreen(!mainWindow.isFullScreen()); return;
			case 'developerTools': services?.activeContents()?.toggleDevTools(); return;
			case 'addService': overlay?.open({ dialog: 'add' }); return;
			case 'dontDisturb': return setDontDisturb(!store.get('dontDisturb'));
			case 'quit': app.quit(); return;
			case 'workspace': return workspaces?.chooseNumber(shortcut.index);
			case 'preferences': overlay?.open({ dialog: 'preferences' }); return;
			case 'lock': return;
		}
	}

	const handleShortcut = (input: KeyInput): boolean => {
		const shortcut = shortcutFor(input);
		if ( shortcut ) run(shortcut);
		return shortcut !== null;
	};
	const listenForShortcuts = (contents: WebContents) => contents.on('before-input-event', (event, input) => {
		if ( handleShortcut(input) ) event.preventDefault();
	});

	app.whenReady().then(() => {
		applyThemeBeforeTheWindow();
		const window = createMainWindow();
		mainWindow = window;
		listenForShortcuts(window.webContents);
		overlay = new Overlay(window, () => services?.focusActive(), listenForShortcuts);
		prefs = new PreferenceHost(window, announceState);
		services = new ServiceHost(window, {
			edit: id => overlay?.open({ dialog: 'edit', serviceId: id }),
			shortcut: handleShortcut,
			changed: announceState,
			sessionStarted: session => prefs?.followProxy(session)
		});
		workspaces = new Workspaces(window, services, id => overlay?.open({ dialog: 'workspace', workspaceId: id }));
		window.webContents.once('did-finish-load', () => services?.start());
	});
	app.on('window-all-closed', () => app.quit());
}
