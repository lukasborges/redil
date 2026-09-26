import { join } from 'node:path';
import { Menu, Tray, nativeImage } from 'electron';
import { mainMessages } from './messages.ts';

export interface TrayActions {
	isWindowShown(): boolean;
	toggleWindow(): void;
	isDontDisturb(): boolean;
	toggleDontDisturb(): void;
	quit(): void;
}

// On Linux the monochrome masters from resources/logo, drawn the way a panel's own icons are.
// Windows' notification area expects the full-colour mark instead, and sits on a taskbar that is
// light as often as dark, where a white one would not be there at all.
const COLOURED = process.platform === 'win32';
const icon = (unread: boolean) => {
	const name = COLOURED ? (unread ? 'IconTrayColourUnread.png' : 'IconTrayColour.png') : (unread ? 'IconTrayUnread.png' : 'IconTray.png');
	return nativeImage.createFromPath(join(__dirname, '../../resources', name));
};

export class TrayIcon {
	private tray: Tray | null = null;
	private unread = false;

	constructor(private readonly actions: TrayActions) {}

	show(on: boolean): void {
		if ( on && !this.tray ) {
			this.tray = new Tray(icon(this.unread));
			this.tray.setToolTip('Shep');
			this.tray.on('click', () => this.actions.toggleWindow());
			this.refreshMenu();
		}
		if ( !on && this.tray ) {
			this.tray.destroy();
			this.tray = null;
		}
	}

	isShown(): boolean {
		return this.tray !== null;
	}

	setUnread(unread: boolean): void {
		if ( unread === this.unread ) return;
		this.unread = unread;
		this.tray?.setImage(icon(unread));
	}

	refreshMenu(): void {
		const messages = mainMessages();
		this.tray?.setContextMenu(Menu.buildFromTemplate([
			{ label: this.actions.isWindowShown() ? messages['tray.hide'] : messages['tray.show'], click: () => { this.actions.toggleWindow(); this.refreshMenu(); } },
			{ label: messages['tray.dontDisturb'], type: 'checkbox', checked: this.actions.isDontDisturb(), click: () => this.actions.toggleDontDisturb() },
			{ type: 'separator' },
			{ label: messages['tray.quit'], click: () => this.actions.quit() }
		]));
	}
}
