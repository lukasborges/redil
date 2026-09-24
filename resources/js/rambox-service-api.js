/**
 * Loaded into every service webview.
 *
 * Electron will not let a guest be less isolated than its embedder, so once the
 * host window became contextIsolated this preload did too, sandboxed and in a
 * world of its own. Nothing it writes on `window` is the page's window, and
 * `require` reaches only electron. Two globals this used to patch in place had
 * to move somewhere they can still touch the page: the Notification wrapper is
 * injected by app/ux/WebView.js, and screen sharing is answered by the main
 * process through setDisplayMediaRequestHandler, which needs no page code at
 * all. The history shortcut moved to the main process too, because a sandboxed
 * preload cannot require Mousetrap.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rambox', {
	showWindowAndActivateTab: () => ipcRenderer.sendToHost('rambox.showWindowAndActivateTab')
});
