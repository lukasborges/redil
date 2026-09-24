import { nativeTheme, type WebContents } from 'electron';

const themedPages = new Set<WebContents>();

function tellColorScheme(contents: WebContents): void {
	if ( contents.isDestroyed() ) {
		themedPages.delete(contents);
		return;
	}
	// nativeTheme.themeSource never reaches prefers-color-scheme in embedded content; this does, across navigations
	contents.debugger.sendCommand('Emulation.setEmulatedMedia', {
		features: [{ name: 'prefers-color-scheme', value: nativeTheme.shouldUseDarkColors ? 'dark' : 'light' }]
	}).catch(() => {});
}

export function followColorScheme(contents: WebContents): void {
	try {
		if ( !contents.debugger.isAttached() ) contents.debugger.attach('1.3');
	} catch {
		return; // another client holds the page's debugger; it keeps the default scheme
	}
	themedPages.add(contents);
	contents.once('destroyed', () => themedPages.delete(contents));
	tellColorScheme(contents);
}

nativeTheme.on('updated', () => themedPages.forEach(tellColorScheme));
