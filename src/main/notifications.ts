// Injected into the page's own world, where an isolated preload cannot patch
// Notification. A click brings the service forward; a service that may not
// notify now, because of its setting or Don't Disturb, gets a notification
// nothing shows. Electron never shows what a service worker shows, and Google
// Chat sends its messages that way, so those become page notifications.
export const NOTIFICATION_WRAPPER = `(() => {
	if ( window.__shepNotifications || !window.shepService ) return;
	window.__shepNotifications = true;
	const Native = window.Notification;
	const inert = () => Object.assign(new EventTarget(), { close() {}, onclick: null, onclose: null, onerror: null, onshow: null });
	function Wrapped(title, options) {
		if ( !window.shepService.mayNotify() ) return inert();
		const notification = new Native(title, options);
		notification.addEventListener('click', () => window.shepService.notificationClicked());
		return notification;
	}
	Wrapped.prototype = Native.prototype;
	Object.defineProperty(Wrapped, 'permission', { get: () => Native.permission });
	Wrapped.requestPermission = Native.requestPermission.bind(Native);
	window.Notification = Wrapped;
	if ( window.ServiceWorkerRegistration ) {
		ServiceWorkerRegistration.prototype.showNotification = function (title, options) {
			const pageOptions = Object.assign({}, options);
			delete pageOptions.actions;
			try { new window.Notification(title, pageOptions); } catch (error) { return Promise.reject(error); }
			return Promise.resolve();
		};
		ServiceWorkerRegistration.prototype.getNotifications = () => Promise.resolve([]);
	}
})()`;
