export type CloseOutcome = 'hide' | 'quit';

// Closing hides the window only where it can be brought back: from the tray icon, or a Mac's Dock.
export function whatClosingDoes(closeBehaviour: 'tray' | 'quit', canComeBack: boolean, quitting: boolean): CloseOutcome {
	return !quitting && closeBehaviour === 'tray' && canComeBack ? 'hide' : 'quit';
}
