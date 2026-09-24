import { app } from 'electron';
import AutoLaunch from 'auto-launch-patched';

// Electron's own setLoginItemSettings covers macOS and Windows only; this writes the Linux autostart entry.
// An unpacked run leaves the desktop's login items alone.
export function startWithSystem(on: boolean, minimized: boolean): void {
	if ( !app.isPackaged ) return;
	const launcher = new AutoLaunch({ name: 'Shep', path: process.env.APPIMAGE ?? process.execPath, isHidden: minimized });
	(on ? launcher.enable() : launcher.disable()).catch(() => {});
}
