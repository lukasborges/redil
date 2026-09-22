'use strict';

const {app, BrowserWindow, shell, Menu, ipcMain, nativeImage, session, desktopCapturer, dialog, systemPreferences, webContents} = require('electron');
// Tray
const tray = require('./tray');
// Context menus, built in this process for every webContents that gets one
const contextMenu = require('./contextmenu');
// AutoLaunch
var AutoLaunch = require('auto-launch-patched');
// Configuration
const Config = require('electron-store');
// Development
const isDev = require('electron-is-dev');
// Updater
const updater = require('./updater');
// File System
var fs = require("fs");
const path = require('path');

// Disk usage:
// const disk = require('diskusage');

if ( isDev ) app.getVersion = function() { return require('../package.json').version; }; // FOR DEV ONLY, BECAUSE IN DEV RETURNS ELECTRON'S VERSION

// Initial Config
const config = new Config({
	 defaults: {
		 always_on_top: false
		,hide_menu_bar: false
		,tabbar_location: 'top'
		,hide_tabbar_labels: false
		,window_display_behavior: 'taskbar_tray'
		,auto_launch: !isDev
		,flash_frame: true
		,window_close_behavior: 'keep_in_tray'
		,start_minimized: false
		,systemtray_indicator: true
		,master_password: false
		,dont_disturb: false
		,disable_gpu: process.platform === 'linux'
		,proxy: false
		,proxyHost: ''
		,proxyPort: ''
		,proxyLogin: ''
		,proxyPassword: ''
		,locale: 'en'
		,enable_hidpi_support: false
		,user_agent: ''
		,default_service: 'redilTab'

		,x: undefined
		,y: undefined
		,width: 1000
		,height: 800
		,maximized: false
	}
});

// Fix issues with HiDPI scaling on Windows platform
if (config.get('enable_hidpi_support') && (process.platform === 'win32')) {
	app.commandLine.appendSwitch('high-dpi-support', 'true')
	app.commandLine.appendSwitch('force-device-scale-factor', '1')
}

app.commandLine.appendSwitch('lang', config.get('locale') === 'en' ? 'en-US' :  config.get('locale'));

// Temporary fix to load Twitter and other websites inside webviews
// Bug related with Electron: https://github.com/electron/electron/issues/25469
app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicy');

// Because we build it using Squirrel, it will assign UserModelId automatically, so we match it here to display notifications correctly.
// https://github.com/electron-userland/electron-builder/issues/362
app.setAppUserModelId('io.github.lukasborges.redil');

// Menu
const appMenu = require('./menu')(config);

// Configure AutoLaunch
let appLauncher;
if ( !isDev ) {
	appLauncher = new AutoLaunch({
		 name: 'Redil'
		,isHidden: config.get('start_minimized')
	});
	config.get('auto_launch') ? appLauncher.enable() : appLauncher.disable();
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let isQuitting = false;

function createWindow () {
	// Create the browser window using the state information
	mainWindow = new BrowserWindow({
		 title: 'Redil'
		,icon: __dirname + '/../resources/Icon.' + (process.platform === 'linux' ? 'png' : 'ico')
		,backgroundColor: '#FFF'
		,x: config.get('x')
		,y: config.get('y')
		,width: config.get('width')
		,height: config.get('height')
		,alwaysOnTop: config.get('always_on_top')
		,autoHideMenuBar: config.get('hide_menu_bar')
		,skipTaskbar: config.get('window_display_behavior') === 'show_trayIcon'
		,show: !config.get('start_minimized')
		,acceptFirstMouse: true
		,webPreferences: {
			 plugins: true
			,partition: 'persist:rambox' // storage key, not a name: renaming it empties
			// the local storage that holds everyone's configured services
			,nodeIntegration: true
			,webviewTag: true
			,contextIsolation: false
			,spellcheck: false
		}
	});

	contextMenu.attach(mainWindow.webContents);

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

	tray.create(mainWindow, config);

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
	mainMasterPasswordWindow = new BrowserWindow({
		 backgroundColor: '#0675A0'
		,frame: false
		,webPreferences: {
			 nodeIntegration: true
			,contextIsolation: false
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

function formatBytes(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/* async function availableSpaceWatchDog() {
	// optionally render this information also in Redil window
	try {
		const { available } = await disk.check(appPath);
		if (available < 1073741824) { // 1 GB
			const options = {
				type: 'warning',
				buttons: ['OK, quit'],
				defaultId: 0,
				title: `Running out of disk space! - Redil shutting down`,
				detail: `You've got just ${formatBytes(available)} space left.\n\nRedil has been frozen to prevent settings corruption.\n\nOnce you quit this dialog, Redil will shutdown.\n\n1 GB of avalable disk space is required.\nFree up space on partition where Redil is installed then start the app again.\n\nRedil path: \n${appPath}`,
				message: `Running out of disk space! - Redil shutting down`,
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

	// hide_menu_bar
	mainWindow.setAutoHideMenuBar(values.hide_menu_bar);
	if ( !values.hide_menu_bar ) mainWindow.setMenuBarVisibility(true);
	// always_on_top
	mainWindow.setAlwaysOnTop(values.always_on_top);
	// auto_launch
	if ( !isDev ) values.auto_launch ? appLauncher.enable() : appLauncher.disable();
	// systemtray_indicator
	updateBadge(mainWindow.getTitle());

	mainWindow.webContents.executeJavaScript('(function(a){if(a)a.controller.initialize(a)})(Ext.cq1("app-main"))');

	switch ( values.window_display_behavior ) {
		case 'show_taskbar':
			mainWindow.setSkipTaskbar(false);
			tray.destroy();
			break;
		case 'show_trayIcon':
			mainWindow.setSkipTaskbar(true);
			tray.create(mainWindow, config);
			break;
		case 'taskbar_tray':
			mainWindow.setSkipTaskbar(false);
			tray.create(mainWindow, config);
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

// Service permissions
//
// A webview runs somebody else's web app, so a permission it asks for is that
// site's request and not Redil's. This used to answer callback(true) to
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
		,detail: 'Redil remembers this answer for this service. Remove and add the service again to be asked once more.'
	}).then(function(result) {
		const allowed = result.response === 0;
		const decisions = config.get('permissions') || {};
		decisions[permissionKey(partition, permission)] = allowed;
		config.set('permissions', decisions);
		callback(allowed);
	}).catch(function() { callback(false); });
}

/**
 * A null partition means the renderer has not reported this service's settings
 * yet. There is no key to remember an answer against in that state, so the
 * sensitive permissions are refused instead of prompted; the real policy
 * replaces this one as soon as the service reaches dom-ready.
 */
function applyPermissionPolicy(serviceSession, partition, notificationsAllowed) {
	serviceSession.setPermissionRequestHandler(function(webContents, permission, callback) {
		if ( permission === 'notifications' ) return callback(notificationsAllowed);
		if ( SILENT_PERMISSIONS.indexOf(permission) !== -1 ) return callback(true);
		if ( PROMPTED_PERMISSIONS[permission] && partition ) return askAboutPermission(partition, permission, callback);
		console.info('Refused permission "' + permission + '" for ' + (partition || 'an unconfigured service'));
		callback(false);
	});

	// navigator.permissions.query never reaches the request handler
	serviceSession.setPermissionCheckHandler(function(webContents, permission) {
		if ( permission === 'notifications' ) return notificationsAllowed;
		if ( SILENT_PERMISSIONS.indexOf(permission) !== -1 ) return true;
		if ( PROMPTED_PERMISSIONS[permission] && partition ) return rememberedPermission(partition, permission) === true;
		return false;
	});
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

// Relaunch app
// What the renderer used to reach through the remote bridge. It runs with
// nodeIntegration, so anything already on its own `process` stays there; only
// the calls that genuinely belong to the main process crossed over.
ipcMain.on('app:getVersion', function(event) {
	event.returnValue = app.getVersion();
});

ipcMain.on('app:quit', function() {
	app.quit();
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

// ALLOWED URLS POPUPS
let allowPopUp = [
	'feedly.com/v3/auth/',
	'identity.linuxfoundation.org/cas/login',
	'auth.missiveapp.com',
	'accounts.google.com/AccountChooser',
	'facebook.com/v3.1/dialog/oauth?',
	'accounts.google.com/o/oauth2',
	'app.slack.com/files/import/gdrive',
	'spikenow.com/s/account',
	'app.mixmax.com/_oauth/google',
	'officeapps.live.com',
	'dropbox.com/profile_services/start_auth_flow',
	'facebook.com/v3.2/dialog/oauth?',
	'notion.so/googlepopupredirect',
	'zoom.us/office365',
	'figma.com/start_google_sso',
	'mail.google.com/mail',
	'app.slack.com/free-willy/',
	'messenger.com/videocall',
	'api.moo.do',
	'manychat.com/fb?popup',
	'=?print=true' // esta ultima checkea como anda imprimir un pedf desde gmail, si no va bie sacala
];

app.on('web-contents-created', (webContentsCreatedEvent, contents) => {
	if (contents.getType() !== 'webview') return;
	contextMenu.attach(contents);

	// Held on its own, because reading it back off a destroyed webContents throws.
	const contentsId = contents.id;

	// Google turns its sign-in away when it arrives from an embedded Chrome, so
	// the request that carries it announces Firefox instead. Installed here
	// rather than from the renderer, which reached the session over the remote
	// bridge to say something only the main process can act on.
	contents.session.webRequest.onBeforeSendHeaders((details, callback) => {
		if ( /^https:\/\/accounts\.google\.com(\/|$)/.test(details.url) ) {
			details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:97.0) Gecko/20100101 Firefox/97.0';
		}
		callback({ cancel: false, requestHeaders: details.requestHeaders });
	});

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
			key === 'F11' ||
			key === 'a' ||
			key === 'A' ||
			key === 'F12' ||
			key === 'q' ||
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
	applyPermissionPolicy(contents.session, null, false);
	// Block some Deep links to prevent that open its app (Ex: Slack)
	contents.on('will-navigate', (event, url) => url.substring(0, 8) === 'slack://' && event.preventDefault());
	// New Window handler. The about:blank case is finished in 'did-create-window'.
	contents.setWindowOpenHandler(({ url }) => {
		if (['about:blank', 'about:blank#blocked'].includes(url)) {
			return { action: 'allow', overrideBrowserWindowOptions: { show: false } };
		}

		// Protocol rules used to live on the webview's own 'new-window' DOM event,
		// which was removed alongside this one.
		let target;
		try {
			target = new URL(url);
		} catch (e) {
			return { action: 'deny' };
		}
		// Block deep links that would hand the session to a native app (Ex: Slack)
		if (target.protocol === 'slack:') return { action: 'deny' };
		if (!['http:', 'https:'].includes(target.protocol)) {
			shell.openExternal(url);
			return { action: 'deny' };
		}

		// Allow the login and foreground-tab URLs that need a real popup,
		// send everything else to the default browser.
		let allow = false;
		allowPopUp.forEach(allowed => url.indexOf(allowed) > -1 && (allow = true));
		if (allow) return { action: 'allow' };

		// Google's full page sign-in reaches this handler because the link that
		// starts it carries target="_blank", but the flow ends by following its
		// `continue` back to the service, so a window of its own would leave the
		// user signed in beside the tab instead of inside it. Navigate the tab.
		// The list above names paths and Google moves them: ServiceLogin now
		// redirects to /v3/signin/identifier, which is how Chat and Calendar
		// ended up in the default browser. `continue` is what marks a login that
		// comes back; the OAuth handshakes carry redirect_uri instead, and the
		// list matches them first, so they stay popups for the opener waiting on
		// them.
		if (target.hostname === 'accounts.google.com' && target.searchParams.has('continue')) {
			setImmediate(() => contents.loadURL(url));
			return { action: 'deny' };
		}

		shell.openExternal(url);
		return { action: 'deny' };
	});
	contents.on('did-create-window', (win, details) => {
		// Here we center the new window.
		win.center();
		// The following code is for handling the about:blank cases only.
		if (!['about:blank', 'about:blank#blocked'].includes(details.url)) return;
		let once = false;
		win.webContents.on('will-navigate', (e, nextURL) => {
			if (once) return;
			if (['about:blank', 'about:blank#blocked'].includes(nextURL)) return;
			once = true;
			let allow = false;
			allowPopUp.forEach(allowed => nextURL.indexOf(allowed) > -1 && (allow = true));
			// If the url is in aboutBlankOnlyWindow we handle this as a popup window
			if (allow) return win.show();
			shell.openExternal(nextURL);
			win.close();
		});
	});
});


ipcMain.on('toggleWin', function(event, allwaysShow) {
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
	} else if ( mainWindow.isMinimized() && !mainWindow.isMaximized() && !mainWindow.isVisible() ) { // Closed minimized to tray
		mainWindow.show();
	} else {
		if ( process.platform === 'linux' ) {
			mainWindow.minimize();
			mainWindow.maximize();
			mainWindow.focus();
			return
		}
		mainWindow.restore();
	}
});

// ScreenShare
// Enumerating screens belongs to the main process: desktopCapturer stopped being
// reachable from renderers, so the service preload asks for the list over IPC.
// Thumbnails are serialised here because a NativeImage cannot cross the boundary.
ipcMain.handle('screenShare:listSources', async () => {
	const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
	return sources.map(source => ({
		 id: source.id
		,name: source.name
		,thumbnail: source.thumbnail.toDataURL()
	}));
});

ipcMain.on('screenShare:show', (event, screenList) => {
	let tmpWindow = new BrowserWindow({
		title: 'Redil - Select screen',
		width: 600,
		height: 500,
		icon: __dirname + '/../resources/Icon.ico',
		autoHideMenuBar: true,
		transparent: true,
		show: true,
		frame: false,
		hasShadow: true,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	});

	const close = () => {
		tmpWindow.close();
		tmpWindow = null;
	};

	const onCancel = () => {
		event.sender.send('screenShare:cancel');
		close();
	};

	const onShare = (_, shareId) => {
		event.sender.send('screenShare:share', shareId);
		close();
	};

	ipcMain.handle('screenShare:getSources', () => screenList);
	ipcMain.on('screenShare:cancelSelection', onCancel);
	ipcMain.on('screenShare:selectScreen', onShare);

	tmpWindow.on('closed', () => {
		ipcMain.removeHandler('screenShare:getSources');
		ipcMain.removeAllListeners('screenShare:cancelSelection');
		ipcMain.removeAllListeners('screenShare:selectScreen');
	});

	tmpWindow.loadFile(__dirname + '/../screenselector.html');
});


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
