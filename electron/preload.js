'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The renderer used to run with nodeIntegration on and contextIsolation off, so
// every script in the page could require any node module. It now gets this
// object and nothing else.
//
// Both lists are closed on purpose. A bridge that forwarded whatever channel it
// was handed would keep most of the reach the isolation exists to remove, and
// the main process answers some channels with the whole configuration.

// Sent by the renderer, answered or acted on by the main process.
const TO_MAIN = [
	 'app:getVersion'
	,'app:quit'
	,'autoUpdater:check-for-updates'
	,'autoUpdater:quit-and-install'
	,'getConfig'
	,'media:askForAccess'
	,'media:getAccessStatus'
	,'net:isOnline'
	,'relaunchApp'
	,'reloadApp'
	,'sConfig'
	,'setBadge'
	,'setConfig'
	,'setDontDisturb'
	,'service:setMediaAccess'
	,'setServiceNotifications'
	,'toggleWin'
	,'validateMasterPassword'
	,'webview:clearData'
	,'webview:setTrust'
	,'window:show'
	// screenselector.html, which shares this preload.
	,'screenShare:cancelSelection'
	,'screenShare:getSources'
	,'screenShare:selectScreen'
];

// Pushed by the main process, listened for by the renderer.
const FROM_MAIN = [
	 'autoUpdater:check-update'
	,'autoUpdater:update-available'
	,'autoUpdater:update-downloaded'
	,'autoUpdater:update-not-available'
	,'reloadCurrentService'
	,'resetzoom-webview'
	,'setBadge'
	,'showAbout'
	,'showPreferences'
	,'toggleStatusBar'
	,'webview:certificate-error'
	,'zoomin-webview'
	,'zoomout-webview'
];

function checked(allowed, channel) {
	if (!allowed.includes(channel)) {
		throw new Error('This channel is not exposed to the renderer: ' + channel);
	}
	return channel;
}

// removeListener is handed the same function the renderer passed to on, but what
// was registered is the wrapper below, so the pairing is remembered here.
const wrappers = new Map();

const ipc = {
	 send: (channel, ...args) => ipcRenderer.send(checked(TO_MAIN, channel), ...args)
	,sendSync: (channel, ...args) => ipcRenderer.sendSync(checked(TO_MAIN, channel), ...args)
	,invoke: (channel, ...args) => ipcRenderer.invoke(checked(TO_MAIN, channel), ...args)

	// The IpcRendererEvent itself stays on this side: it carries a reference to
	// the sender, which is exactly the sort of thing that should not cross. Every
	// handler in the renderer takes it and ignores it, so the arity is kept.
	,on: (channel, listener) => {
		checked(FROM_MAIN, channel);
		const wrapper = (event, ...args) => listener(undefined, ...args);
		wrappers.set(listener, wrapper);
		ipcRenderer.on(channel, wrapper);
	}

	,removeListener: (channel, listener) => {
		checked(FROM_MAIN, channel);
		const wrapper = wrappers.get(listener);
		if (!wrapper) return;
		wrappers.delete(listener);
		ipcRenderer.removeListener(channel, wrapper);
	}
};

contextBridge.exposeInMainWorld('redil', {
	 ipc: ipc
	// What the renderer read off node's own process before it lost it.
	,platform: process.platform
	,arch: process.arch
	,versions: {
		 electron: process.versions.electron
		,chrome: process.versions.chrome
		,node: process.versions.node
	}
});
