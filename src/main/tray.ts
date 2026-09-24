import { join } from 'node:path';
import { Menu, Tray, nativeImage } from 'electron';

export interface TrayActions {
	isWindowShown(): boolean;
	toggleWindow(): void;
	isDontDisturb(): boolean;
	toggleDontDisturb(): void;
	quit(): void;
}

// The monochrome masters from resources/logo, drawn the way a panel's own icons are.
const icon = (name: string) => nativeImage.createFromPath(join(__dirname, '../../resources', name));

export class TopBarIcon {
	private tray: Tray | null = null;
	private unread = false;

	constructor(private readonly actions: TrayActions) {}

	show(on: boolean): void {
		if ( on && !this.tray ) {
			this.tray = new Tray(icon(this.unread ? 'IconTrayUnread.png' : 'IconTray.png'));
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
		this.tray?.setImage(icon(unread ? 'IconTrayUnread.png' : 'IconTray.png'));
	}

	refreshMenu(): void {
		this.tray?.setContextMenu(Menu.buildFromTemplate([
			{ label: this.actions.isWindowShown() ? 'Hide Shep' : 'Show Shep', click: () => { this.actions.toggleWindow(); this.refreshMenu(); } },
			{ label: "Don't Disturb", type: 'checkbox', checked: this.actions.isDontDisturb(), click: () => this.actions.toggleDontDisturb() },
			{ type: 'separator' },
			{ label: 'Quit', click: () => this.actions.quit() }
		]));
	}
}
