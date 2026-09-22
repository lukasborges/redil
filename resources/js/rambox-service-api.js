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

// The js_unread snippets in the catalogue, and the custom code a user writes per
// service, run in the page's main world through executeJavaScript. This is the
// window.rambox they call.
contextBridge.exposeInMainWorld('rambox', {
	/**
	 * Sets the unread count of the tab.
	 *
	 * @param {*} count	The unread count
	 */
	 setUnreadCount: count => ipcRenderer.sendToHost('rambox.setUnreadCount', count)

	/**
	 * Clears the unread count.
	 */
	,clearUnreadCount: () => ipcRenderer.sendToHost('rambox.clearUnreadCount')

	/**
	 * Brings the window forward and activates this service's tab. Called by the
	 * notification wrapper the panel injects.
	 */
	,showWindowAndActivateTab: () => ipcRenderer.sendToHost('rambox.showWindowAndActivateTab')
});
