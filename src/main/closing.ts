export type CloseOutcome = 'hide' | 'quit';

// Closing hides the window only where it can be brought back: from the tray icon.
export function whatClosingDoes(closeBehaviour: 'tray' | 'quit', trayIcon: boolean, quitting: boolean): CloseOutcome {
	return !quitting && closeBehaviour === 'tray' && trayIcon ? 'hide' : 'quit';
}
