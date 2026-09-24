'use strict';

const {app, BrowserWindow, shell, Menu, ipcMain, nativeImage, session, desktopCapturer, dialog, systemPreferences, webContents, nativeTheme, clipboard} = require('electron');
// Tray
const tray = require('./tray');
// Context menus, built in this process for every webContents that gets one
const contextMenu = require('./contextmenu');
const { classifyWindowOpen, isReturnToService } = require('./links');
const { isPopupRequested } = require('./popup');
// AutoLaunch
var AutoLaunch = require('auto-launch-patched');
// Configuration
const Config = require('electron-store');
// Development. electron-is-dev was one line wrapping this, and went ESM-only.
const isDev = !app.isPackaged;
// Updater
const updater = require('./updater');
// Connectivity, probed for the renderer's no-connection dialog
const isOnline = require('is-online');
const path = require('path');
const fs = require('fs');

// Disk usage:
// const disk = require('diskusage');

// Launched from a desktop entry, stdout and stderr are pipes whose reader can
// go away while the app runs. The next console call then fails with EPIPE, and
// an unhandled error on a stream is an uncaught exception that Electron shows
// as a dialog. Losing a log line is the right outcome there.
[process.stdout, process.stderr].forEach(function(stream) {
	stream.on('error', function(err) {
		if ( err.code !== 'EPIPE' ) throw err;
	});
});

if ( isDev ) app.getVersion = function() { return require('../package.json').version; }; // FOR DEV ONLY, BECAUSE IN DEV RETURNS ELECTRON'S VERSION

// The default, not setUserAgent per page: Cloudflare Turnstile fails any overridden
// agent with error 600010, since Chromium keeps client hints consistent only with a default.
app.userAgentFallback = app.userAgentFallback.replace(/\s(Shep|Redil|Electron)\/\S+/g, '');

const REDIL_PRODUCT_NAME = 'Redil';
const REDIL_WELCOME_TAB_ID = 'redilTab';

function moveRedilUserDataToShep() {
	const userData = app.getPath('userData');
	const redilUserData = path.join(app.getPath('appData'), REDIL_PRODUCT_NAME);
	const wasUserDataDirRequested = app.commandLine.hasSwitch('user-data-dir');
	const isFirstLaunch = !fs.existsSync(userData) || fs.readdirSync(userData).length === 0; // not just !existsSync: Electron makes the folder, empty, before main.js runs
	if ( wasUserDataDirRequested || !isFirstLaunch || !fs.existsSync(redilUserData) ) return;
	if ( fs.existsSync(userData) ) fs.rmdirSync(userData); // Windows refuses to rename onto an existing folder, and rmdirSync refuses one that is not empty
	fs.renameSync(redilUserData, userData);
}
moveRedilUserDataToShep();

// Initial Config
const config = new Config({
	 defaults: {
		 always_on_top: false
		,window_display_behavior: 'taskbar_tray'
		,auto_launch: !isDev
		,flash_frame: true
		,window_close_behavior: 'keep_in_tray'
		,start_minimized: false
		,systemtray_indicator: true
		,master_password: false
		,dont_disturb: false
		// Upstream forced software rendering on every Linux install, from the
		// Electron 13 era. Electron's own default is acceleration, and 44 composites
		// and rasterises here without artefacts or a GPU process crash, so this is
		// opt-in now. A driver that misbehaves is still one preference away.
		,disable_gpu: false
		,proxy: false
		,proxyHost: ''
		,proxyPort: ''
		,proxyLogin: ''
		,proxyPassword: ''
		,locale: 'en'
		// system, light or dark. Driving nativeTheme rather than a class on the
		// document means the menus and dialogs follow the choice too.
		,theme: 'system'
		,enable_hidpi_support: false
		// Chromium checks spelling itself; every webContents here had it turned
		// off. Which languages is a list of its own: empty means work it out.
		,spellcheck: true
		,spellcheck_languages: []
		,user_agent: ''
		,default_service: 'shepTab'

		,x: undefined
		,y: undefined
		,width: 1000
		,height: 800
		,maximized: false
	}
});

if ( config.get('default_service') === REDIL_WELCOME_TAB_ID ) config.set('default_service', 'shepTab');

// Fix issues with HiDPI scaling on Windows platform
if (config.get('enable_hidpi_support') && (process.platform === 'win32')) {
	app.commandLine.appendSwitch('high-dpi-support', 'true')
	app.commandLine.appendSwitch('force-device-scale-factor', '1')
}

/*
 * On a Wayland session the app ran through XWayland, which cannot see the
 * compositor's output: screen sharing offered a list of X windows and no
 * screens at all. Running natively hands capture to the desktop portal, which
 * is the system's own picker and the only one that works there. The hint falls
 * back to X11 on an X11 session, so it is safe to set unconditionally on Linux.
 */
if ( process.platform === 'linux' ) {
	app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
	/*
	 * Wayland carries no window icon: the compositor matches the surface's
	 * app_id to a .desktop file and takes the icon from there. Chromium's
	 * --class sets that app_id (and WM_CLASS on X11), and `shep` is the name
	 * of the desktop entry electron-builder writes, so the running window is
	 * the same application the launcher knows rather than a second, iconless
	 * one beside it. The BrowserWindow `icon` below still answers on X11.
	 */
	app.commandLine.appendSwitch('class', 'shep');
}

app.commandLine.appendSwitch('lang', config.get('locale') === 'en' ? 'en-US' :  config.get('locale'));

// Temporary fix to load Twitter and other websites inside webviews
// Bug related with Electron: https://github.com/electron/electron/issues/25469
app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicy');

// Because we build it using Squirrel, it will assign UserModelId automatically, so we match it here to display notifications correctly.
// https://github.com/electron-userland/electron-builder/issues/362
app.setAppUserModelId('io.github.lukasborges.shep');

// Only macOS gets a menu bar. It shows one whether or not the app asks, and
// copy and paste reach the page through its Edit roles. Elsewhere every item
// had a home already -- the rail, a service's right click, Preferences -- and
// the shortcuts the menu carried are Mousetrap's, in app/Application.js.
const appMenu = process.platform === 'darwin' ? require('./menu')(config) : null;

// Configure AutoLaunch
let appLauncher;
if ( !isDev ) {
	appLauncher = new AutoLaunch({
		 name: 'Shep'
		,isHidden: config.get('start_minimized')
	});
	config.get('auto_launch') ? appLauncher.enable() : appLauncher.disable();
	const redilExecutable = {
		 linux: path.join(path.dirname(process.execPath), 'redil')
		,win32: path.join(path.dirname(process.execPath), 'Redil.exe')
		,darwin: '/Applications/Redil.app'
	}[process.platform];
	if ( redilExecutable ) new AutoLaunch({ name: REDIL_PRODUCT_NAME, path: redilExecutable }).disable().catch(function() {}); // by path, not by name: the package names the login item after the executable
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let isQuitting = false;

/*
 * The system title bar is replaced by a strip the renderer draws in the rail's
 * colour, with the window's own buttons laid over it. Hiding the bar outright
 * would have put those buttons on the top right of every service, which is
 * where Gmail, Chat and Claude keep the account menu. Which buttons show and on
 * which side is the desktop's: GNOME's button-layout, Windows' three on the
 * right, macOS's traffic lights on the left. Only Linux has been run.
 * The colours are --rx-chrome and --rx-on-chrome in shep-modern.css; macOS
 * draws its own buttons and ignores them.
 */
const TITLE_BAR_HEIGHT = 32;

function titleBarOverlay() {
	const dark = nativeTheme.shouldUseDarkColors;
	return {
		 color: dark ? '#2A2A2E' : '#24506F'
		,symbolColor: dark ? '#D0D0D6' : '#E8F1F8'
		,height: TITLE_BAR_HEIGHT
	};
}

nativeTheme.on('updated', () => {
	// setTitleBarOverlay does not exist on macOS, where the colours mean nothing
	if ( process.platform !== 'darwin' && mainWindow && !mainWindow.isDestroyed() ) mainWindow.setTitleBarOverlay(titleBarOverlay());
	themedPages.forEach(tellColorScheme);
});

const themedPages = new Set();

function tellColorScheme(contents) {
	if ( contents.isDestroyed() ) return themedPages.delete(contents);
	// nativeTheme.themeSource never reaches prefers-color-scheme inside a <webview>; this does, across navigations
	contents.debugger.sendCommand('Emulation.setEmulatedMedia', {
		features: [{ name: 'prefers-color-scheme', value: nativeTheme.shouldUseDarkColors ? 'dark' : 'light' }]
	}).catch(() => {});
}

function followColorScheme(contents) {
	try {
		if ( !contents.debugger.isAttached() ) contents.debugger.attach('1.3');
	} catch {
		return; // another client holds the page; it keeps the default
	}
	themedPages.add(contents);
	contents.once('destroyed', () => themedPages.delete(contents));
	tellColorScheme(contents);
}

function createWindow () {
	// Before the window exists, so the first paint is already the right theme.
	applyTheme(config.get('theme'));

	// Create the browser window using the state information
	mainWindow = new BrowserWindow({
		 title: 'Shep'
		,icon: __dirname + '/../resources/Icon.' + (process.platform === 'linux' ? 'png' : 'ico')
		,backgroundColor: '#FFF'
		,x: config.get('x')
		,y: config.get('y')
		,width: config.get('width')
		,height: config.get('height')
		,alwaysOnTop: config.get('always_on_top')
		,skipTaskbar: config.get('window_display_behavior') === 'show_trayIcon'
		,show: !config.get('start_minimized')
		,acceptFirstMouse: true
		,titleBarStyle: 'hidden'
		,titleBarOverlay: titleBarOverlay()
		// the traffic lights are 12px tall; this centres them in the strip
		,trafficLightPosition: { x: 12, y: 10 }
		,webPreferences: {
			 plugins: true
			,partition: 'persist:rambox' // storage key, not a name: renaming it empties
			// the local storage that holds everyone's configured services
			,preload: path.join(__dirname, 'preload.js')
			,nodeIntegration: false
			,webviewTag: true
			,contextIsolation: true
			,spellcheck: config.get('spellcheck')
		}
	});

	contextMenu.attach(mainWindow.webContents);
	applySpellChecking(mainWindow.webContents.session);

	// Check if user has defined a custom User-Agent
	if ( config.get('user_agent').length > 0 ) mainWindow.webContents.setUserAgent( config.get('user_agent') );
	
	// Wait for the mainWindow.loadURL(..) and the optional mainWindow.webContents.openDevTools()
	// to be finished before minimizing
	config.get('start_minimized') && mainWindow.webContents.once('did-finish-load', () => config.get('window_display_behavior') === 'show_trayIcon' ? mainWindow.hide() :  mainWindow.minimize());

	// Check if the window its outside of the view (ex: multi monitor setup)
	const { positionOnScreen } = require('./utils/positionOnScreen');
	const inBounds = positionOnScreen([config.get('x'), config.get('y')]);
	if ( inBounds ) {
		mainWindow.setPosition(config.get('x'), config.get('y'));
	} else {
		mainWindow.center();
	}

	process.setMaxListeners(10000);

	// Open the DevTools.
	if ( isDev ) mainWindow.webContents.openDevTools();

	// and load the index.html of the app.
	mainWindow.loadURL('file://' + __dirname + '/../index.html');

	Menu.setApplicationMenu(appMenu);

	tray.create(mainWindow, config, toggleWindow);

	updater.initialize(mainWindow);

	// Open links in default browser
	mainWindow.webContents.setWindowOpenHandler(({ url, disposition }) => {
		if ( disposition === 'foreground-tab' ) {
			const protocol = require('url').parse(url).protocol;
			if ( protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:' ) {
				shell.openExternal(url);
				return { action: 'deny' };
			}
		}
		return { action: 'allow' };
	});

	mainWindow.webContents.on('did-create-window', (win) => {
		if ( config.get('user_agent').length > 0 ) win.webContents.setUserAgent( config.get('user_agent') );
	});

	mainWindow.webContents.on('will-navigate', function(event, url) {
		event.preventDefault();
	});

	// BrowserWindow events
	mainWindow.on('page-title-updated', (e, title) => updateBadge(title));
	mainWindow.on('maximize', function(e) { config.set('maximized', true); });
	mainWindow.on('unmaximize', function(e) { config.set('maximized', false); });
	mainWindow.on('resize', function(e) { if (!mainWindow.isMaximized()) config.set(mainWindow.getBounds()); });
	mainWindow.on('move', function(e) { if (!mainWindow.isMaximized()) config.set(mainWindow.getBounds()); });
	mainWindow.on('app-command', (e, cmd) => {
		// Navigate the window back when the user hits their mouse back button
		if ( cmd === 'browser-backward' ) mainWindow.webContents.executeJavaScript('if(Ext.cq1("app-main")) Ext.cq1("app-main").getActiveTab().goBack();');
		// Navigate the window forward when the user hits their mouse forward button
		if ( cmd === 'browser-forward' ) mainWindow.webContents.executeJavaScript('if(Ext.cq1("app-main")) Ext.cq1("app-main").getActiveTab().goForward();');
	});

	// Emitted when the window is closed.
	mainWindow.on('close', function(e) {
		if ( !isQuitting ) {
			e.preventDefault();

			switch (process.platform) {
				case 'darwin':
					app.hide();
					break;
				case 'linux':
				case 'win32':
				default:
					switch (config.get('window_close_behavior')) {
						case 'keep_in_tray':
							mainWindow.hide();
							break;
						case 'keep_in_tray_and_taskbar':
							mainWindow.minimize();
							break;
						case 'quit':
							app.quit();
							break;
					}
					break;
			}
		}
	});
	mainWindow.on('minimize', function(e) {
		if ( config.get('window_display_behavior') === 'show_trayIcon' ) mainWindow.setSkipTaskbar(true);
	});
	mainWindow.on('restore', function(e) {
		if ( config.get('window_display_behavior') === 'show_taskbar' ) mainWindow.setSkipTaskbar(false);
	});
	mainWindow.on('show', function(e) {
		if ( config.get('window_display_behavior') !== 'show_trayIcon' ) mainWindow.setSkipTaskbar(false);
	});
	mainWindow.on('closed', function(e) {
		mainWindow = null;
	});
	mainWindow.once('focus', () => mainWindow.flashFrame(false));
}

let mainMasterPasswordWindow;
function createMasterPasswordWindow() {
	// This window opens before createWindow, so the theme is applied here too.
	applyTheme(config.get('theme'));
	mainMasterPasswordWindow = new BrowserWindow({
		// the rail's colour, --rx-chrome, which is what the page paints over it
		 backgroundColor: nativeTheme.shouldUseDarkColors ? '#2A2A2E' : '#24506F'
		,frame: false
		,webPreferences: {
			 preload: path.join(__dirname, 'preload.js')
			,nodeIntegration: false
			,contextIsolation: true
		}
	});

	// Open the DevTools.
	if ( isDev ) mainMasterPasswordWindow.webContents.openDevTools();

	mainMasterPasswordWindow.loadURL('file://' + __dirname + '/../masterpassword.html');
	mainMasterPasswordWindow.on('close', function() { mainMasterPasswordWindow = null });
}

function updateBadge(title) {
	title = title.split(" - ")[0]; //Discard service name if present, could also contain digits
	var messageCount = title.match(/\d+/g) ? parseInt(title.match(/\d+/g).join("")) : 0;
	messageCount = isNaN(messageCount) ? 0 : messageCount;

	tray.setBadge(messageCount, config.get('systemtray_indicator'));

	if (process.platform === 'win32') {
		if (messageCount === 0) return mainWindow.setOverlayIcon(null, '');
		mainWindow.webContents.send('setBadge', messageCount);
	} else { // macOS & Linux
		app.setBadgeCount(messageCount);
	}

	if ( messageCount > 0 && !mainWindow.isFocused() && !config.get('dont_disturb') && config.get('flash_frame') ) mainWindow.flashFrame(true);
}


/* async function availableSpaceWatchDog() {
	// optionally render this information also in Shep window
	try {
		const { available } = await disk.check(appPath);
		if (available < 1073741824) { // 1 GB
			const options = {
				type: 'warning',
				buttons: ['OK, quit'],
				defaultId: 0,
				title: `Running out of disk space! - Shep shutting down`,
				detail: `You've got just ${formatBytes(available)} space left.\n\nShep has been frozen to prevent settings corruption.\n\nOnce you quit this dialog, Shep will shutdown.\n\n1 GB of avalable disk space is required.\nFree up space on partition where Shep is installed then start the app again.\n\nShep path: \n${appPath}`,
				message: `Running out of disk space! - Shep shutting down`,
			};
		
			dialog.showMessageBoxSync(null, options);
			app.quit(); 
		}
	} catch (err) {
		console.error(err)
	}
} */

ipcMain.on('setBadge', function(event, messageCount, value) {
	mainWindow.setOverlayIcon(nativeImage.createFromDataURL(value), messageCount.toString());
});

ipcMain.on('getConfig', function(event, arg) {
	event.returnValue = config.store;
});
ipcMain.on('sConfig', function(event, values) {
	config.set(values);
	event.returnValue = config;
});
ipcMain.on('setConfig', function(event, values) {
	config.set(values);

	// always_on_top
	mainWindow.setAlwaysOnTop(values.always_on_top);
	// auto_launch
	if ( !isDev ) values.auto_launch ? appLauncher.enable() : appLauncher.disable();
	// systemtray_indicator
	updateBadge(mainWindow.getTitle());
	// theme
	applyTheme(values.theme);
	// the languages take effect at once; switching the checker itself on or off
	// is a webPreference, and that one needs the relaunch the form asks for
	spellCheckedSessions.forEach(applySpellChecking);

	mainWindow.webContents.executeJavaScript('(function(a){if(a)a.controller.initialize(a)})(Ext.cq1("app-main"))');

	switch ( values.window_display_behavior ) {
		case 'show_taskbar':
			mainWindow.setSkipTaskbar(false);
			tray.destroy();
			break;
		case 'show_trayIcon':
			mainWindow.setSkipTaskbar(true);
			tray.create(mainWindow, config, toggleWindow);
			break;
		case 'taskbar_tray':
			mainWindow.setSkipTaskbar(false);
			tray.create(mainWindow, config, toggleWindow);
			break;
		default:
			break;
	}
});

ipcMain.on('validateMasterPassword', function(event, pass) {
	if ( config.get('master_password') === require('crypto').createHash('md5').update(pass).digest('hex') ) {
		createWindow();
		mainMasterPasswordWindow.close();
		event.returnValue = true;
	}
	event.returnValue = false;
});

// Spell checking
//
// Chromium does the checking; Electron only decides the languages, and starts
// with en-US alone. Anything the person chose comes first, and when they have
// chosen nothing the app's own language, the desktop's and the locale
// environment are tried in turn -- a system set to English by someone who
// writes Portuguese is the case that list exists for. On Linux the dictionaries
// are fetched once and cached under the user data directory; on macOS the
// system checker answers and the list is ignored.

const spellCheckedSessions = new Set();

function preferredSpellLanguages(available) {
	const chosen = config.get('spellcheck_languages');
	const fromEnvironment = (process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || '')
		.split('.')[0].replace('_', '-');

	const wanted = chosen && chosen.length
		? chosen
		: [config.get('locale'), ...app.getPreferredSystemLanguages(), fromEnvironment, 'en-US'];

	const picked = [];
	for ( const tag of wanted ) {
		if ( !tag ) continue;
		const lower = String(tag).toLowerCase();
		const match = available.find(lang => lang.toLowerCase() === lower)
			|| available.find(lang => lang.toLowerCase() === lower.split('-')[0]);
		if ( match && !picked.includes(match) ) picked.push(match);
		// Chromium checks against all of them at once; past a few that is noise.
		if ( picked.length === 3 ) break;
	}
	return picked;
}

function applySpellChecking(target) {
	if ( !target || process.platform === 'darwin' ) return;

	spellCheckedSessions.add(target);
	const languages = preferredSpellLanguages(target.availableSpellCheckerLanguages);
	if ( languages.length ) target.setSpellCheckerLanguages(languages);
}

// The unread report's Copy button. The renderer has no clipboard of its own now
// that it is isolated, and this is the only thing that needs one.
ipcMain.on('clipboard:writeText', function(event, text) {
	clipboard.writeText(String(text));
});

ipcMain.on('spellcheck:getLanguages', function(event) {
	event.returnValue = {
		 available: session.defaultSession.availableSpellCheckerLanguages
		,chosen: config.get('spellcheck_languages')
	};
});

// Service permissions
//
// A webview runs somebody else's web app, so a permission it asks for is that
// site's request and not Shep's. This used to answer callback(true) to
// everything that was not a notification, which silently handed every service
// the camera, the microphone and the user's location. Anything not named below
// is now refused.

// Needed to use a messaging app normally, and not sensitive on their own.
const SILENT_PERMISSIONS = [
	 'fullscreen'
	,'pointerLock'
	,'clipboard-sanitized-write'
	,'background-sync'
];

// Sensitive, but calls and screen sharing genuinely need them, so the person is
// asked once per service and the answer is kept.
const PROMPTED_PERMISSIONS = {
	 'media': 'use your camera and microphone'
	,'display-capture': 'capture your screen'
};

/*
 * Services the person has allowed the camera, the microphone and screen sharing
 * for without being asked. It is a flag on the service's record, and the
 * renderer reports it here as each service loads -- the same route the trust flag takes, because
 * the setting lives in the renderer's localStorage.
 *
 * It grants the permission, not the picker: screen sharing still opens the
 * source chooser, because choosing what to share is the point of it.
 */
const mediaGranted = {};

// What a call needs besides the camera and the screen, granted silently to the
// same services: without the wake lock the display sleeps in the middle of one.
const CALL_PERMISSIONS = ['screen-wake-lock'];

ipcMain.on('service:setMediaAccess', function(event, partition, allowed) {
	if ( !partition ) return;

	if ( allowed ) mediaGranted[partition] = true;
	else delete mediaGranted[partition];
});

function permissionKey(partition, permission) {
	return partition + '|' + permission;
}

function rememberedPermission(partition, permission) {
	return (config.get('permissions') || {})[permissionKey(partition, permission)];
}

function serviceNameFor(partition) {
	return String(partition).replace('persist:', '').split('_')[0] || 'This service';
}

function askAboutPermission(partition, permission, callback) {
	const remembered = rememberedPermission(partition, permission);
	if ( typeof remembered === 'boolean' ) return callback(remembered);

	dialog.showMessageBox(mainWindow, {
		 type: 'question'
		,buttons: ['Allow', 'Block']
		,defaultId: 1
		,cancelId: 1
		,title: 'Permission request'
		,message: serviceNameFor(partition) + ' wants to ' + PROMPTED_PERMISSIONS[permission] + '.'
		,detail: 'Shep remembers this answer for this service. Remove and add the service again to be asked once more.'
	}).then(function(result) {
		const allowed = result.response === 0;
		const decisions = config.get('permissions') || {};
		decisions[permissionKey(partition, permission)] = allowed;
		config.set('permissions', decisions);
		callback(allowed);
	}).catch(function() { callback(false); });
}

// Sessions the renderer has already configured. The renderer reports a
// service's settings from the panel's afterRender, which races the guest's
// creation, so the placeholder applied in web-contents-created must not land
// on top of a real policy: it did, and every service lost its notifications.
const configuredSessions = new WeakSet();

/**
 * A null partition means the renderer has not reported this service's settings
 * yet. There is no key to remember an answer against in that state, so the
 * sensitive permissions are refused instead of prompted until it does.
 */
function applyPermissionPolicy(serviceSession, partition, notificationsAllowed) {
	if ( partition ) configuredSessions.add(serviceSession);
	serviceSession.setPermissionRequestHandler(function(webContents, permission, callback) {
		if ( permission === 'notifications' ) return callback(notificationsAllowed);
		if ( SILENT_PERMISSIONS.indexOf(permission) !== -1 ) return callback(true);
		if ( CALL_PERMISSIONS.indexOf(permission) !== -1 && mediaGranted[partition] ) return callback(true);
		if ( PROMPTED_PERMISSIONS[permission] && partition ) {
			if ( mediaGranted[partition] ) return callback(true);
			return askAboutPermission(partition, permission, callback);
		}
		console.info('Refused permission "' + permission + '" for ' + (partition || 'an unconfigured service'));
		callback(false);
	});

	// navigator.permissions.query never reaches the request handler
	serviceSession.setPermissionCheckHandler(function(webContents, permission) {
		if ( permission === 'notifications' ) return notificationsAllowed;
		if ( SILENT_PERMISSIONS.indexOf(permission) !== -1 ) return true;
		if ( CALL_PERMISSIONS.indexOf(permission) !== -1 && mediaGranted[partition] ) return true;
		if ( PROMPTED_PERMISSIONS[permission] && partition ) return mediaGranted[partition] === true || rememberedPermission(partition, permission) === true;
		reportRefusedCheck(partition, permission);
		return false;
	});
}

// A page may query the same permission many times a second, so each refusal is
// reported once per service rather than on every check.
const reportedChecks = new Set();
function reportRefusedCheck(partition, permission) {
	const key = permissionKey(partition, permission);
	if ( reportedChecks.has(key) ) return;
	reportedChecks.add(key);
	console.info('Refused permission check "' + permission + '" for ' + (partition || 'an unconfigured service'));
}

// Handle Service Notifications
ipcMain.on('setServiceNotifications', function(event, partition, op) {
	if ( partition === null ) return;
	applyPermissionPolicy(session.fromPartition(partition), partition, op);
});

ipcMain.on('setDontDisturb', function(event, arg) {
	config.set('dont_disturb', arg);
});

// Reload app
ipcMain.on('reloadApp', function(event) {
	mainWindow.reload();
});

// resources/css/shep-modern.css reads nothing but prefers-color-scheme, which
// Electron keeps in step with this. An unknown value falls back to the desktop's
// own answer rather than forcing a theme nobody asked for.
function applyTheme(theme) {
	nativeTheme.themeSource = ['light', 'dark'].includes(theme) ? theme : 'system';
}

// Everything the renderer needs from this process, and the whole of what it can
// reach: electron/preload.js allowlists these channels and exposes nothing else.
ipcMain.handle('net:isOnline', async function() {
	return isOnline();
});

ipcMain.on('app:getVersion', function(event) {
	event.returnValue = app.getVersion();
});

ipcMain.on('app:quit', function() {
	app.quit();
});

// What the File, View and Window menus did, for the shortcuts and the buttons
// in Preferences that replaced them on Linux and Windows.
ipcMain.on('window:toggleFullScreen', function() {
	mainWindow.setFullScreen(!mainWindow.isFullScreen());
});
ipcMain.on('window:toggleDevTools', function() {
	mainWindow.webContents.toggleDevTools();
});
ipcMain.handle('app:clearCache', async function() {
	await mainWindow.webContents.session.clearCache();
	mainWindow.reload();
});

ipcMain.on('window:show', function() {
	if ( mainWindow ) mainWindow.show();
});

ipcMain.on('media:getAccessStatus', function(event) {
	// Only macOS gates the camera and the microphone; elsewhere there is nothing
	// to ask for, and the renderer only shows its banner when something is not
	// granted.
	event.returnValue = process.platform === 'darwin'
		? {
			 microphone: systemPreferences.getMediaAccessStatus('microphone')
			,camera: systemPreferences.getMediaAccessStatus('camera')
		}
		: { microphone: 'granted', camera: 'granted' };
});

ipcMain.handle('media:askForAccess', async function() {
	if ( process.platform !== 'darwin' ) return;
	await systemPreferences.askForMediaAccess('microphone');
	await systemPreferences.askForMediaAccess('camera');
});

ipcMain.handle('webview:clearData', async function(event, webContentsId) {
	const contents = webContents.fromId(webContentsId);
	if ( !contents ) return;
	contents.clearHistory();
	contents.session.flushStorageData();
	await contents.session.clearCache();
	await contents.session.clearStorageData();
	await contents.session.cookies.flushStore();
});

// Which services the user marked as trusted, by webContents id. The flag lives
// in the renderer's localStorage, so the renderer reports it as each service
// becomes ready and the certificate handler below reads it from here.
const trustedWebContents = new Set();

ipcMain.on('webview:setTrust', function(event, webContentsId, trust) {
	trust ? trustedWebContents.add(webContentsId) : trustedWebContents.delete(webContentsId);
});

const FAVICON_BYTES_LIMIT = 1024 * 1024;

function asBase64DataUrl(url) {
	const comma = url.indexOf(',');
	const header = url.slice(0, comma);
	if ( comma < 0 || header.endsWith(';base64') ) return url;
	try {
		return header + ';base64,' + Buffer.from(decodeURIComponent(url.slice(comma + 1))).toString('base64');
	} catch {
		return null;
	}
}
ipcMain.handle('favicon:fetch', async function(event, webContentsId, urls) {
	const contents = webContents.fromId(webContentsId);
	if ( !contents || contents.isDestroyed() || !Array.isArray(urls) ) return [];

	const fetched = await Promise.all(urls.slice(0, 8).map(async url => {
		// not the data URL as the page wrote it: Ext's setIcon puts it in an unquoted url(), which an inline SVG's quotes break
		if ( url.startsWith('data:image/') ) return asBase64DataUrl(url);
		if ( !/^https?:\/\//.test(url) ) return null;
		try {
			// not from the renderer: some favicons need the service's cookies, and a page cannot read a cross-origin image's bytes
			const response = await contents.session.fetch(url);
			const type = (response.headers.get('content-type') || '').split(';')[0].trim();
			if ( !response.ok || !(type.startsWith('image/') || type === 'application/octet-stream') ) return null;
			const bytes = Buffer.from(await response.arrayBuffer());
			if ( !bytes.length || bytes.length > FAVICON_BYTES_LIMIT ) return null;
			return 'data:' + (type.startsWith('image/') ? type : 'image/x-icon') + ';base64,' + bytes.toString('base64');
		} catch {
			return null;
		}
	}));
	return fetched.filter(Boolean);
});

ipcMain.on('relaunchApp', function(event) {
	app.relaunch();
	app.exit(0);
});

const shouldQuit = app.requestSingleInstanceLock();
if (!shouldQuit) {
	app.quit();
	return;
}
app.on('second-instance', (event, commandLine, workingDirectory) => {
	// Someone tried to run a second instance, we should focus our window.
	if (mainWindow) {
		if (mainWindow.isMinimized()) mainWindow.restore();
		mainWindow.focus();
		mainWindow.show();
		mainWindow.setSkipTaskbar(false);
		if (app.dock && app.dock.show) app.dock.show();
	}
});

function handleWindowOpen(contents, serviceContents) {
	const popupFlagsInOpenOrder = [];
	contents.setWindowOpenHandler(({ url, features }) => {
		const kind = classifyWindowOpen({ url, features });
		const popup = kind === 'popup' || (kind === 'blank' && isPopupRequested(features));
		if ( ['blank', 'popup', 'window'].includes(kind) ) popupFlagsInOpenOrder.push(popup);
		switch ( kind ) {
			case 'blank':
				// Meet's "Open in new window" fills a sized blank window without navigating, so that one is shown at once
				return popup
					? { action: 'allow' }
					: { action: 'allow', overrideBrowserWindowOptions: { show: false } };
			case 'popup':
				return { action: 'allow' };
			case 'window':
				return { action: 'allow', overrideBrowserWindowOptions: AUXILIARY_WINDOW_OPTIONS };
			case 'external':
				shell.openExternal(url);
				return { action: 'deny' };
			default:
				return { action: 'deny' };
		}
	});
	contents.on('did-create-window', (win, details) => {
		win.center();
		const openedAsPopup = popupFlagsInOpenOrder.shift();
		setUpAuxiliaryWindow(win, serviceContents, details.url, !openedAsPopup);
		const isHiddenBlankWindow = ['about:blank', 'about:blank#blocked'].includes(details.url) && details.options.show === false;
		if ( isHiddenBlankWindow ) showOnceWrittenIntoOrNavigated(win);
	});
}

function showOnceWrittenIntoOrNavigated(win) {
	let shown = false;
	const show = () => { if ( !shown && !win.isDestroyed() ) { shown = true; win.show(); } };
	setTimeout(() => {
		if ( shown || win.isDestroyed() ) return;
		win.webContents.executeJavaScript('!!document.body && document.body.childElementCount > 0')
			.then(written => written && show())
			.catch(() => {});
	}, 1000);
	win.webContents.on('did-start-navigation', (event) => {
		if ( event.isMainFrame && !['about:blank', 'about:blank#blocked'].includes(event.url) ) show();
	});
}

const AUXILIARY_WINDOW_OPTIONS = { width: 1100, height: 780, autoHideMenuBar: true };

function setUpAuxiliaryWindow(win, serviceContents, openedWith, handsSignInBack) {
	const contents = win.webContents;
	contextMenu.attach(contents);
	followColorScheme(contents);
	handleWindowOpen(contents, serviceContents);
	if ( !handsSignInBack ) return;

	let currentUrl = openedWith;
	contents.on('did-navigate', (event, url) => { currentUrl = url; });
	const returnToService = (event, legacyUrl) => {
		const url = event.url || legacyUrl;
		if ( serviceContents.isDestroyed() ) return;
		if ( !isReturnToService({ serviceUrl: serviceContents.getURL(), fromUrl: currentUrl, toUrl: url }) ) return;
		event.preventDefault();
		serviceContents.loadURL(url);
		win.close();
	};
	contents.on('will-navigate', returnToService);
	contents.on('will-redirect', returnToService);
}

app.on('web-contents-created', (webContentsCreatedEvent, contents) => {
	if (contents.getType() !== 'webview') return;
	contextMenu.attach(contents);
	followColorScheme(contents);
	if ( config.get('user_agent') ) contents.setUserAgent(config.get('user_agent'));

	// A service calling getDisplayMedia used to be answered by a patch the
	// preload wrote over navigator.mediaDevices. An isolated preload cannot
	// reach the page's navigator, and this is the API meant for the job: it
	// needs no code in the page at all.
	// Each service keeps its own session, so each needs the languages set.
	applySpellChecking(contents.session);

	/*
	 * Who picks the screen depends on whether the system has a picker of its own.
	 * macOS 15 does, and useSystemPicker hands the whole request to it. Wayland
	 * does too: asking desktopCapturer for sources opens the portal's chooser and
	 * answers with the one stream the person selected there, so showing our own
	 * picker after it would ask the same question twice. Everywhere else -- X11,
	 * Windows -- nothing asks, and screenselector.html is the picker.
	 */
	contents.session.setDisplayMediaRequestHandler(async (request, callback) => {
		const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });

		// Answering with nothing is how a request is refused, and an empty list is
		// what a cancelled portal dialog looks like.
		if ( !sources.length ) return callback();
		if ( systemPicksTheSource() ) return callback({ video: sources[0] });

		const chosen = await pickScreenShareSource(sources);
		chosen ? callback({ video: chosen }) : callback();
	}, { useSystemPicker: true });

	// Held on its own, because reading it back off a destroyed webContents throws.
	const contentsId = contents.id;

	// A bad certificate is refused unless the user marked the service trusted.
	// Either way the renderer is told, because the warning belongs in that
	// service's status bar and only the renderer can draw it.
	contents.on('certificate-error', (event, url, error, certificate, callback) => {
		if ( trustedWebContents.has(contentsId) ) {
			event.preventDefault();
			callback(true);
		} else {
			callback(false);
		}
		if ( mainWindow ) mainWindow.webContents.send('webview:certificate-error', contentsId);
	});

	// A shortcut typed while a service has the focus never reaches the app's own
	// Mousetrap, which listens in the host window. Electron reports the key here
	// first, so it is replayed there.
	contents.on('before-input-event', (event, input) => {
		if ( input.type !== 'keyDown' ) return;

		const modifiers = [];
		if (input.shift) modifiers.push('shift');
		if (input.control) modifiers.push('control');
		if (input.alt) modifiers.push('alt');
		if (input.meta) modifiers.push('meta');
		if (input.isAutoRepeat) modifiers.push('isAutoRepeat');

		if ( input.key === 'Tab' && !modifiers.length ) return;

		// History navigation, which the preload drove with Mousetrap until it was
		// sandboxed.
		const historyKey = process.platform === 'darwin' ? 'meta' : 'alt';
		if ( modifiers.length === 1 && modifiers[0] === historyKey && ['ArrowLeft', 'ArrowRight'].includes(input.key) ) {
			const history = contents.navigationHistory;
			input.key === 'ArrowLeft' ? history.canGoBack() && history.goBack() : history.canGoForward() && history.goForward();
			return;
		}

		// Maps special keys to fire the correct event in Mac OS
		let key = input.key;
		if ( process.platform === 'darwin' ) {
			const macKeys = {
				 '\u0192': 'f' // Search
				,' ': 'l'       // Lock
				,'\u2202': 'd'  // DND
			};
			key = macKeys[key] ? macKeys[key] : key;
		}

		if (
			// macOS still has menu accelerators for these, and replaying them
			// would fire each twice; elsewhere Mousetrap is the only listener
			(process.platform === 'darwin' && (key === 'F11' || key === 'q')) ||
			key === 'a' ||
			key === 'A' ||
			key === 'F12' ||
			(key === 'F1' && modifiers.includes('control'))
		)
			return;

		if ( mainWindow ) mainWindow.webContents.sendInputEvent({
			 type: input.type
			,keyCode: key
			,modifiers: modifiers
		});
	});

	contents.on('destroyed', () => trustedWebContents.delete(contentsId));
	// Without this the session carries no handler until the renderer reports the
	// service's settings, and Electron's own default is to grant.
	if ( !configuredSessions.has(contents.session) ) applyPermissionPolicy(contents.session, null, false);
	handleWindowOpen(contents, contents);
});


function toggleWindow(allwaysShow) {
	if ( config.get('window_display_behavior') !== 'show_trayIcon' ) mainWindow.setSkipTaskbar(false);
	if ( !mainWindow.isMinimized() && mainWindow.isMaximized() && mainWindow.isVisible() ) { // Maximized
		!allwaysShow ? mainWindow.close() : mainWindow.show();
	} else if ( mainWindow.isMinimized() && !mainWindow.isMaximized() && !mainWindow.isVisible() ) { // Minimized
		if ( process.platform === 'linux' ) {
			mainWindow.minimize();
			mainWindow.restore();
			mainWindow.focus();
			return
		}
		mainWindow.restore();
	} else if ( !mainWindow.isMinimized() && !mainWindow.isMaximized() && mainWindow.isVisible() ) { // Windowed mode
		!allwaysShow ? mainWindow.close() : mainWindow.show();
	} else if ( mainWindow.isMinimized() && !mainWindow.isMaximized() && mainWindow.isVisible() ) { // Closed to taskbar
		if ( process.platform === 'linux' ) {
			mainWindow.minimize();
			mainWindow.restore();
			mainWindow.focus();
			return
		}
		mainWindow.restore();
	} else if ( !mainWindow.isMinimized() && mainWindow.isMaximized() && !mainWindow.isVisible() ) { // Closed maximized to tray
		mainWindow.show();
	} else if ( !mainWindow.isMinimized() && !mainWindow.isMaximized() && !mainWindow.isVisible() ) { // Closed windowed to tray
		mainWindow.show();
	// A seventh branch stood here, labelled "closed minimized to tray", asking
	// exactly what the "minimized" branch above asks, so it never ran. The two
	// states cannot be told apart by isMinimized, isMaximized and isVisible: a
	// window hidden to the tray while minimized answers the same as one that is
	// merely minimized. Distinguishing them needs a fourth fact this does not keep.
	} else {
		if ( process.platform === 'linux' ) {
			mainWindow.minimize();
			mainWindow.maximize();
			mainWindow.focus();
			return
		}
		mainWindow.restore();
	}
}

ipcMain.on('toggleWin', (event, allwaysShow) => toggleWindow(allwaysShow));

/**
 * Whether the desktop has already asked which screen to share by the time the
 * sources come back. That is what the Wayland portal does, and there is no way
 * to ask it for a list without it showing its dialog.
 */
function systemPicksTheSource() {
	return process.platform === 'linux'
		&& (process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY);
}

// ScreenShare
// Enumerating screens belongs to the main process: desktopCapturer stopped being
// reachable from renderers, so the service preload asks for the list over IPC.
// Thumbnails are serialised here because a NativeImage cannot cross the boundary.
// Opens screenselector.html over the screens and windows on offer and settles
// on the one the user picks, or on nothing if they close it or cancel.
function pickScreenShareSource(sources) {
	return new Promise(resolve => {
		const offered = sources.map(source => ({
			 id: source.id
			,name: source.name
			,thumbnail: source.thumbnail.toDataURL()
		}));

		let picker = new BrowserWindow({
			title: 'Shep - Select screen',
			width: 600,
			height: 500,
			icon: __dirname + '/../resources/Icon.ico',
			autoHideMenuBar: true,
			transparent: true,
			show: true,
			frame: false,
			hasShadow: true,
			webPreferences: {
				preload: path.join(__dirname, 'preload.js'),
				nodeIntegration: false,
				contextIsolation: true,
			},
		});

		const settle = chosenId => {
			ipcMain.removeHandler('screenShare:getSources');
			ipcMain.removeAllListeners('screenShare:cancelSelection');
			ipcMain.removeAllListeners('screenShare:selectScreen');
			const window = picker;
			picker = null;
			if ( window && !window.isDestroyed() ) window.close();
			resolve(chosenId ? sources.find(source => source.id === chosenId) : null);
		};

		ipcMain.handle('screenShare:getSources', () => offered);
		ipcMain.once('screenShare:cancelSelection', () => settle(null));
		ipcMain.once('screenShare:selectScreen', (event, chosenId) => settle(chosenId));
		// Closing the window with no choice counts as cancelling.
		picker.on('closed', () => settle(null));

		picker.loadFile(__dirname + '/../screenselector.html');
	});
}


// Proxy
if ( config.get('proxy') ) {
	app.commandLine.appendSwitch('proxy-server', config.get('proxyHost')+':'+config.get('proxyPort'));
	app.on('login', (event, webContents, request, authInfo, callback) => {
		if(!authInfo.isProxy)
			return;

		event.preventDefault();
		callback(config.get('proxyLogin'), config.get('proxyPassword'))
	})
}

// Disable GPU Acceleration for Linux
// to prevent White Page bug
// https://github.com/electron/electron/issues/6139
// https://github.com/saenzramiro/rambox/issues/181
if ( config.get('disable_gpu') ) app.disableHardwareAcceleration();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
	config.get('master_password') ? createMasterPasswordWindow() : createWindow();
	// setInterval(availableSpaceWatchDog, 1000 * 60);
});
// Quit when all windows are closed.
app.on('window-all-closed', function () {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

// Only macOS: On OS X it's common to re-create a window in the app when the
// dock icon is clicked and there are no other windows open.
app.on('activate', function () {
	if (mainWindow === null && mainMasterPasswordWindow === null ) {
		config.get('master_password') ? createMasterPasswordWindow() : createWindow();
	}

	if (mainWindow) {
		mainWindow.show();
	}
});

app.on('before-quit', function () {
	isQuitting = true;
});
