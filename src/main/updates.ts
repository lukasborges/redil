import { app, dialog, type BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';

const { autoUpdater } = electronUpdater;

// This repository's own releases.
autoUpdater.setFeedURL({ provider: 'github', owner: 'lukasborges', repo: 'shep', vPrefixedTagName: false });

export class Updates {
	private askedByHand = false;

	constructor(private readonly window: BrowserWindow) {
		autoUpdater.on('update-not-available', () => {
			if ( !this.askedByHand ) return;
			this.askedByHand = false;
			dialog.showMessageBox(window, { type: 'info', message: 'Shep is up to date.', detail: `Version ${app.getVersion()} is the latest.` });
		});
		autoUpdater.on('update-downloaded', async info => {
			const { response } = await dialog.showMessageBox(window, {
				type: 'info', buttons: ['Restart Now', 'Later'], defaultId: 0, cancelId: 1,
				message: `Shep ${info.version} is ready.`, detail: 'Restart Shep to use it.'
			});
			if ( response === 0 ) autoUpdater.quitAndInstall(true, true);
		});
		autoUpdater.on('error', error => {
			if ( !this.askedByHand ) return;
			this.askedByHand = false;
			dialog.showMessageBox(window, { type: 'warning', message: 'Shep could not check for updates.', detail: String(error.message ?? error) });
		});
	}

	// Only a packaged build has an update to install.
	check(byHand: boolean): void {
		if ( !app.isPackaged ) {
			if ( byHand ) dialog.showMessageBox(this.window, { type: 'info', message: 'Updates come to packaged builds only.' });
			return;
		}
		this.askedByHand = byHand;
		autoUpdater.checkForUpdates().catch(() => {});
	}
}
