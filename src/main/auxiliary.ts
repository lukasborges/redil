import { shell, type BrowserWindow, type WebContents } from 'electron';
import { classifyWindowOpen, isBlank, isPopupRequested, isReturnToService } from './links.ts';
import { followColorScheme } from './theme.ts';
import { attachPageMenu } from './menus.ts';

const AUXILIARY_WINDOW_OPTIONS = { width: 1100, height: 780, autoHideMenuBar: true };
const BLANK_WINDOW_WRITTEN_CHECK_MS = 1000;

function showOnceWrittenIntoOrNavigated(window: BrowserWindow): void {
	let shown = false;
	const show = () => {
		if ( shown || window.isDestroyed() ) return;
		shown = true;
		window.show();
	};
	setTimeout(() => {
		if ( shown || window.isDestroyed() ) return;
		window.webContents.executeJavaScript('!!document.body && document.body.childElementCount > 0')
			.then(written => { if ( written ) show(); })
			.catch(() => {});
	}, BLANK_WINDOW_WRITTEN_CHECK_MS);
	window.webContents.on('did-start-navigation', event => {
		if ( event.isMainFrame && !isBlank(event.url) ) show();
	});
}

function handBackSignIns(window: BrowserWindow, serviceContents: WebContents, openedWith: string): void {
	let currentUrl = openedWith;
	window.webContents.on('did-navigate', (event, url) => { currentUrl = url; });
	const returnToService = (event: Electron.Event, url: string) => {
		if ( serviceContents.isDestroyed() ) return;
		if ( !isReturnToService(serviceContents.getURL(), currentUrl, url) ) return;
		event.preventDefault();
		serviceContents.loadURL(url);
		window.close();
	};
	window.webContents.on('will-navigate', (event) => returnToService(event, event.url));
	window.webContents.on('will-redirect', (event) => returnToService(event, event.url));
}

export function keepLinksInTheApp(contents: WebContents, serviceContents: WebContents): void {
	const popupFlagsInOpenOrder: boolean[] = [];

	contents.setWindowOpenHandler(({ url, features }) => {
		const kind = classifyWindowOpen(url, features);
		const openedAsPopup = kind === 'popup' || (kind === 'blank' && isPopupRequested(features));
		if ( kind === 'blank' || kind === 'popup' || kind === 'window' ) popupFlagsInOpenOrder.push(openedAsPopup);
		switch ( kind ) {
			case 'blank':
				// Meet's "Open in new window" fills a sized blank window without navigating, so that one is shown at once
				return openedAsPopup ? { action: 'allow' } : { action: 'allow', overrideBrowserWindowOptions: { show: false } };
			case 'popup':
				return { action: 'allow' };
			case 'window':
				return { action: 'allow', overrideBrowserWindowOptions: AUXILIARY_WINDOW_OPTIONS };
			case 'external':
				shell.openExternal(url);
				return { action: 'deny' };
			default:
				return { action: 'deny' };
		}
	});

	contents.on('did-create-window', (window, details) => {
		window.center();
		const openedAsPopup = popupFlagsInOpenOrder.shift() ?? false;
		attachPageMenu(window.webContents);
		followColorScheme(window.webContents);
		keepLinksInTheApp(window.webContents, serviceContents);
		if ( !openedAsPopup ) handBackSignIns(window, serviceContents, details.url);
		const isHiddenBlankWindow = isBlank(details.url) && details.options.show === false;
		if ( isHiddenBlankWindow ) showOnceWrittenIntoOrNavigated(window);
	});
}
