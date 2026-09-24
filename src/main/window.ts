import { join } from 'node:path';
import { BrowserWindow, nativeTheme } from 'electron';
import { CHROME_COLOURS, TITLE_BAR_HEIGHT } from '../shared/chrome.ts';

function titleBarOverlay() {
	const colours = CHROME_COLOURS[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'];
	return { color: colours.chrome, symbolColor: colours.onChrome, height: TITLE_BAR_HEIGHT };
}

export function createMainWindow(): BrowserWindow {
	const window = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 600,
		minHeight: 400,
		show: false,
		title: 'Shep',
		titleBarStyle: 'hidden',
		titleBarOverlay: titleBarOverlay(),
		backgroundColor: titleBarOverlay().color,
		webPreferences: {
			preload: join(__dirname, '../preload/ui.js'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true
		}
	});

	const syncOverlay = () => { if ( !window.isDestroyed() ) window.setTitleBarOverlay(titleBarOverlay()); };
	nativeTheme.on('updated', syncOverlay);
	window.on('closed', () => nativeTheme.off('updated', syncOverlay));

	window.once('ready-to-show', () => window.show());

	if ( process.env.ELECTRON_RENDERER_URL ) window.loadURL(process.env.ELECTRON_RENDERER_URL);
	else window.loadFile(join(__dirname, '../ui/index.html'));

	return window;
}
