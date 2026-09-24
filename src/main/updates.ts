import { app, dialog, type BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
import { mainMessages } from './messages.ts';
import { fill } from '../shared/i18n/index.ts';

// Only a packaged build has an update to install, and electron-updater refuses the version an unpacked run reports.
export class Updates {
	private askedByHand = false;
	private readonly updater = app.isPackaged ? electronUpdater.autoUpdater : null;

	constructor(private readonly window: BrowserWindow) {
		const updater = this.updater;
		if ( !updater ) return;
		// This repository's own releases.
		updater.setFeedURL({ provider: 'github', owner: 'lukasborges', repo: 'shep', vPrefixedTagName: false });
		updater.on('update-not-available', () => {
			if ( !this.askedByHand ) return;
			this.askedByHand = false;
			const messages = mainMessages();
			dialog.showMessageBox(window, { type: 'info', message: messages['updates.upToDate'], detail: fill(messages['updates.latest'], { version: app.getVersion() }) });
		});
		updater.on('update-downloaded', async info => {
			const messages = mainMessages();
			const { response } = await dialog.showMessageBox(window, {
				type: 'info', buttons: [messages['updates.restartNow'], messages['updates.later']], defaultId: 0, cancelId: 1,
				message: fill(messages['updates.ready'], { version: info.version }), detail: messages['updates.restart']
			});
			if ( response === 0 ) updater.quitAndInstall(true, true);
		});
		updater.on('error', error => {
			if ( !this.askedByHand ) return;
			this.askedByHand = false;
			dialog.showMessageBox(window, { type: 'warning', message: mainMessages()['updates.failed'], detail: String(error.message ?? error) });
		});
	}

	check(byHand: boolean): void {
		if ( !this.updater ) {
			if ( byHand ) dialog.showMessageBox(this.window, { type: 'info', message: mainMessages()['updates.packagedOnly'] });
			return;
		}
		this.askedByHand = byHand;
		this.updater.checkForUpdates().catch(() => {});
	}
}
