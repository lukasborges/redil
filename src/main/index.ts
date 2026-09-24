import { join } from 'node:path';
import { app, ipcMain } from 'electron';
import { productName, version } from '../../package.json';
import { createMainWindow } from './window.ts';

// Run unpacked from out/main, Electron finds no package.json and calls itself Electron.
app.setName(productName);

const hasOwnUserData = process.argv.some(arg => arg.startsWith('--user-data-dir'));
// Until 1.0 replaces the Ext app, an unpacked run must never open the real Shep profile.
if ( !app.isPackaged && !hasOwnUserData ) app.setPath('userData', join(app.getPath('appData'), 'Shep-next'));

// The Wayland app_id the desktop entry matches, or the window is an iconless second app.
app.commandLine.appendSwitch('class', 'shep');
// Under XWayland the screen-share portal sees X windows only, never the screens.
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');

if ( !app.requestSingleInstanceLock() ) {
	app.quit();
} else {
	let mainWindow: ReturnType<typeof createMainWindow> | null = null;

	app.on('second-instance', () => {
		if ( !mainWindow ) return;
		if ( mainWindow.isMinimized() ) mainWindow.restore();
		mainWindow.show();
		mainWindow.focus();
	});

	ipcMain.handle('app:getVersion', () => version);

	app.whenReady().then(() => { mainWindow = createMainWindow(); });
	app.on('window-all-closed', () => app.quit());
}
