import { join } from 'node:path';
import { BrowserWindow, nativeTheme, screen } from 'electron';

import { CHROME_COLOURS, TITLE_BAR_HEIGHT } from '../shared/chrome.ts';

function titleBarOverlay() {
	const colours = CHROME_COLOURS[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'];
	return { color: colours.chrome, symbolColor: colours.onChrome, height: TITLE_BAR_HEIGHT };
}

export interface WindowBounds {
	x?: number;
	y?: number;
	width: number;
	height: number;
	maximized: boolean;
}

const SAVE_BOUNDS_AFTER_MS = 500;
const DEFAULT_SIZE = { width: 1200, height: 800 };

// Where it was, unless that is no longer on any screen.
function placement(saved: WindowBounds | null) {
	if ( !saved ) return DEFAULT_SIZE;
	const { x, y, width, height } = saved;
	const onAScreen = x !== undefined && y !== undefined && screen.getAllDisplays().some(({ workArea: area }) =>
		x < area.x + area.width && x + width > area.x && y < area.y + area.height && y + height > area.y);
	return onAScreen ? { x, y, width, height } : { width, height };
}

export function createMainWindow(startHidden: boolean, saved: WindowBounds | null, saveBounds: (bounds: WindowBounds) => void): BrowserWindow {
	const window = new BrowserWindow({
		...placement(saved),
		minWidth: 600,
		minHeight: 400,
		// Shown from the start, not on ready-to-show: on Wayland a window that was never mapped never paints,
		// so ready-to-show never came and the app was left in the tray. The background colour keeps it from flashing.
		show: !startHidden,
		title: 'Shep',
		titleBarStyle: 'hidden',
		titleBarOverlay: titleBarOverlay(),
		backgroundColor: titleBarOverlay().color,
		// X11 reads the window's own icon; Wayland matches the app_id to the desktop entry instead
		icon: join(__dirname, '../../resources/Icon.png'),
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

	if ( saved?.maximized ) window.maximize();

	let saving: ReturnType<typeof setTimeout> | null = null;
	const save = () => {
		if ( saving ) clearTimeout(saving);
		saving = setTimeout(() => {
			if ( window.isDestroyed() ) return;
			const bounds = window.getNormalBounds();
			saveBounds({ ...bounds, maximized: window.isMaximized() });
		}, SAVE_BOUNDS_AFTER_MS);
	};
	for ( const change of ['resize', 'move', 'maximize', 'unmaximize'] as const ) window.on(change as 'resize', save);

	if ( process.env.ELECTRON_RENDERER_URL ) window.loadURL(process.env.ELECTRON_RENDERER_URL);
	else window.loadFile(join(__dirname, '../ui/index.html'));

	return window;
}
