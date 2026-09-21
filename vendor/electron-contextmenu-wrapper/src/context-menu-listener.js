// See the note in context-menu-builder.js: the built-in `remote` module was
// removed in Electron 14, so this pulls the same API from @electron/remote.
const remote = require('@electron/remote');


let d = require('debug')('electron-contextmenu-wrapper:context-menu-listener');

/**
 * ContextMenuListener will listen to the given window / WebView control and
 * invoke a handler function. This function usually will immediately turn around
 * and invoke {{showPopupMenu}} from {{ContextMenuBuilder}}.
 */
class ContextMenuListener {
  /**
   * Constructs a ContextMenuListener and wires up the events it needs to fire
   * the callback.
   *
   * @param  {Function} handler             The callback that will be invoked
   *                                        with the 'context-menu' info.
   * @param  {BrowserWindow|WebView} windowOrWebView  The target, either a
   *                                                  BrowserWindow or a WebView
   */
  constructor(handler, windowOrWebView=null) {
    this.windowOrWebView = windowOrWebView || remote.getCurrentWebContents();
    this.handler = handler;

    this.windowOrWebView.on('context-menu', this.handler);
  }

  /**
   * Override the default logger for this class. You probably want to use
   * {{setGlobalLogger}} instead
   *
   * @param {Function} fn   The function which will operate like console.log
   */
  static setLogger(fn) {
    d = fn;
  }

  /**
   * Disconnect the events that we connected in the Constructor
   */
  unsubscribe() {
    this.windowOrWebView.removeListener('context-menu', this.handler);

  }
}

module.exports = ContextMenuListener;
