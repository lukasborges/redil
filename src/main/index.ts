import { join } from 'node:path';
import { app, ipcMain } from 'electron';
import { productName, version } from '../../package.json';
import { withoutAppTokens } from './useragent.ts';
import { createMainWindow } from './window.ts';
import { ServiceHost } from './services.ts';

// Run unpacked from out/main, Electron finds no package.json and calls itself Electron.
app.setName(productName);

const hasOwnUserData = process.argv.some(arg => arg.startsWith('--user-data-dir'));
// Until 1.0 replaces the Ext app, an unpacked run must never open the real Shep profile.
if ( !app.isPackaged && !hasOwnUserData ) app.setPath('userData', join(app.getPath('appData'), 'Shep-next'));

// The default, not setUserAgent per page: Cloudflare Turnstile fails any overridden
// agent with error 600010, since Chromium keeps client hints consistent only with a default.
app.userAgentFallback = withoutAppTokens(app.userAgentFallback);

// The Wayland app_id the desktop entry matches, or the window is an iconless second app.
app.commandLine.appendSwitch('class', 'shep');
// Under XWayland the screen-share portal sees X windows only, never the screens.
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');

if ( !app.requestSingleInstanceLock() ) {
	app.quit();
} else {
	let mainWindow: ReturnType<typeof createMainWindow> | null = null;
	let services: ServiceHost | null = null;

	app.on('second-instance', () => {
		if ( !mainWindow ) return;
		if ( mainWindow.isMinimized() ) mainWindow.restore();
		mainWindow.show();
		mainWindow.focus();
	});

	ipcMain.handle('app:getVersion', () => version);
	ipcMain.handle('services:list', () => services?.list() ?? []);
	ipcMain.handle('services:activate', (event, id: unknown) => services?.activate(typeof id === 'string' ? id : null));

	app.whenReady().then(() => {
		mainWindow = createMainWindow();
		services = new ServiceHost(mainWindow);
		mainWindow.webContents.once('did-finish-load', () => services?.start());
	});
	app.on('window-all-closed', () => app.quit());
}
