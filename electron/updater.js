const { app, ipcMain, BrowserWindow } = require('electron');
const { autoUpdater } = require("electron-updater");

// autoUpdater.logger = require("electron-log");
// autoUpdater.logger.transports.file.level = "debug";
// autoUpdater.currentVersion = '0.8.0';
// autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml');

// Releases of this fork. Upstream pointed at ramboxapp/download, which is
// archived, so a packaged build was asking a dead repository for updates.
autoUpdater.setFeedURL({
	"provider": "github",
	"owner": "lukasborges",
	"repo": "redil",
	"vPrefixedTagName": false
});

const initialize = (window) => {
	const webContents = window.webContents;
	const send = webContents.send.bind(window.webContents);
	autoUpdater.on('checking-for-update', (event) => send('autoUpdater:checking-for-update'));
	autoUpdater.on('update-downloaded', (...args) => send('autoUpdater:update-downloaded', ...args));
	ipcMain.on('autoUpdater:quit-and-install', (event) => {
		app.removeAllListeners('window-all-closed');
		BrowserWindow.getAllWindows().forEach((browserWindow) => browserWindow.removeAllListeners('close'));
		autoUpdater.quitAndInstall(true, true);
	});
	ipcMain.on('autoUpdater:check-for-updates', (event) => autoUpdater.checkForUpdates());
};

module.exports = {initialize};
