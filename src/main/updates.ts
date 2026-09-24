import { app, dialog, type BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
import { mainMessages } from './messages.ts';
import { fill } from '../shared/i18n/index.ts';

const { autoUpdater } = electronUpdater;

// This repository's own releases.
autoUpdater.setFeedURL({ provider: 'github', owner: 'lukasborges', repo: 'shep', vPrefixedTagName: false });

export class Updates {
	private askedByHand = false;

	constructor(private readonly window: BrowserWindow) {
		autoUpdater.on('update-not-available', () => {
			if ( !this.askedByHand ) return;
			this.askedByHand = false;
			const messages = mainMessages();
			dialog.showMessageBox(window, { type: 'info', message: messages['updates.upToDate'], detail: fill(messages['updates.latest'], { version: app.getVersion() }) });
		});
		autoUpdater.on('update-downloaded', async info => {
			const messages = mainMessages();
			const { response } = await dialog.showMessageBox(window, {
				type: 'info', buttons: [messages['updates.restartNow'], messages['updates.later']], defaultId: 0, cancelId: 1,
				message: fill(messages['updates.ready'], { version: info.version }), detail: messages['updates.restart']
			});
			if ( response === 0 ) autoUpdater.quitAndInstall(true, true);
		});
		autoUpdater.on('error', error => {
			if ( !this.askedByHand ) return;
			this.askedByHand = false;
			dialog.showMessageBox(window, { type: 'warning', message: mainMessages()['updates.failed'], detail: String(error.message ?? error) });
		});
	}

	// Only a packaged build has an update to install.
	check(byHand: boolean): void {
		if ( !app.isPackaged ) {
			if ( byHand ) dialog.showMessageBox(this.window, { type: 'info', message: mainMessages()['updates.packagedOnly'] });
			return;
		}
		this.askedByHand = byHand;
		autoUpdater.checkForUpdates().catch(() => {});
	}
}
