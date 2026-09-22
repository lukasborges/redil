const { app, ipcMain, BrowserWindow } = require('electron');
const { autoUpdater } = require("electron-updater");

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
	autoUpdater.on('update-available', (...args) => send('autoUpdater:update-available', ...args));
	autoUpdater.on('update-not-available', (...args) => send('autoUpdater:update-not-available', ...args));
	autoUpdater.on('update-downloaded', (...args) => send('autoUpdater:update-downloaded', ...args));
	ipcMain.on('autoUpdater:quit-and-install', (event) => {
		app.removeAllListeners('window-all-closed');
		BrowserWindow.getAllWindows().forEach((browserWindow) => browserWindow.removeAllListeners('close'));
		autoUpdater.quitAndInstall(true, true);
	});
	ipcMain.on('autoUpdater:check-for-updates', (event) => autoUpdater.checkForUpdates());
};

module.exports = {initialize};
