import type { Messages } from '../shared/i18n/index.ts';

export interface ServiceMenuState {
	enabled: boolean;
	notifications: boolean;
	sound: boolean;
	workspaces: readonly { id: string; name: string }[];
	workspace: string;
}

export interface ServiceMenuActions {
	reload(): void;
	toggleNotifications(): void;
	toggleSound(): void;
	toggleEnabled(): void;
	edit(): void;
	moveToWorkspace(id: string): void;
	remove(): void;
	developerTools(): void;
}

export interface ServiceMenuItem {
	label?: string;
	type?: 'separator' | 'checkbox' | 'radio' | 'submenu';
	submenu?: ServiceMenuItem[];
	checked?: boolean;
	enabled?: boolean;
	accelerator?: string;
	click?: () => void;
}

const SEPARATOR: ServiceMenuItem = { type: 'separator' };

// Grouped by what is acted on: the page, what is switched, the service, and the developer's tools.
export function serviceMenu(state: ServiceMenuState, actions: ServiceMenuActions, messages: Messages): ServiceMenuItem[] {
	// Back, forward and zoom are the title bar's, since they act on the page in view; reload also rescues a hidden one that stopped counting.
	const page: ServiceMenuItem[] = [{ label: messages['menu.reload'], click: actions.reload }, SEPARATOR];
	const switches: ServiceMenuItem[] = [
		{ label: messages['menu.notifications'], type: 'checkbox', checked: state.notifications, click: actions.toggleNotifications },
		{ label: messages['menu.sound'], type: 'checkbox', checked: state.sound, click: actions.toggleSound },
		{ label: messages['menu.enabled'], type: 'checkbox', checked: state.enabled, click: actions.toggleEnabled },
		SEPARATOR
	];
	const moveToWorkspace: ServiceMenuItem[] = state.workspaces.length ? [{
		label: messages['menu.moveToWorkspace'],
		type: 'submenu',
		// One radio group: a separator would split it, and Electron ticks the lone item of a group of its own.
		submenu: [
			...state.workspaces.map(workspace => ({
				label: workspace.name, type: 'radio' as const, checked: state.workspace === workspace.id, click: () => actions.moveToWorkspace(workspace.id)
			})),
			{ label: messages['menu.everyWorkspace'], type: 'radio', checked: state.workspace === '', click: () => actions.moveToWorkspace('') }
		]
	}] : [];
	const service: ServiceMenuItem[] = [
		{ label: messages['menu.edit'], click: actions.edit },
		...moveToWorkspace,
		{ label: messages['menu.remove'], click: actions.remove }
	];
	const tools: ServiceMenuItem[] = [SEPARATOR, { label: messages['menu.developerTools'], click: actions.developerTools }];

	return state.enabled ? [...page, ...switches, ...service, ...tools] : [...switches, ...service];
}
