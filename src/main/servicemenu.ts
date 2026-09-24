export interface ServiceMenuState {
	enabled: boolean;
	canGoBack: boolean;
	canGoForward: boolean;
	notifications: boolean;
	sound: boolean;
	zoomLevel: number;
	workspaces: readonly { id: string; name: string }[];
	workspace: string;
}

export interface ServiceMenuActions {
	back(): void;
	forward(): void;
	reload(): void;
	zoomIn(): void;
	zoomOut(): void;
	resetZoom(): void;
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

export const CHROMIUM_ZOOM_FACTOR_PER_LEVEL = 1.2;

export function zoomPercent(level: number): number {
	return Math.round(100 * Math.pow(CHROMIUM_ZOOM_FACTOR_PER_LEVEL, level));
}

const SEPARATOR: ServiceMenuItem = { type: 'separator' };

// Grouped by what is acted on: the page, what is switched, the service, and the developer's tools.
export function serviceMenu(state: ServiceMenuState, actions: ServiceMenuActions): ServiceMenuItem[] {
	const page: ServiceMenuItem[] = [
		{ label: 'Back', enabled: state.canGoBack, click: actions.back },
		{ label: 'Forward', enabled: state.canGoForward, click: actions.forward },
		{ label: 'Reload', click: actions.reload },
		SEPARATOR,
		{ label: 'Zoom In', click: actions.zoomIn },
		{ label: 'Zoom Out', click: actions.zoomOut },
		{ label: `Actual Size (${zoomPercent(state.zoomLevel)}%)`, enabled: state.zoomLevel !== 0, click: actions.resetZoom },
		SEPARATOR
	];
	const switches: ServiceMenuItem[] = [
		{ label: 'Notifications', type: 'checkbox', checked: state.notifications, click: actions.toggleNotifications },
		{ label: 'Sound', type: 'checkbox', checked: state.sound, click: actions.toggleSound },
		{ label: 'Enabled', type: 'checkbox', checked: state.enabled, click: actions.toggleEnabled },
		SEPARATOR
	];
	const moveToWorkspace: ServiceMenuItem[] = state.workspaces.length ? [{
		label: 'Move to Workspace',
		type: 'submenu',
		submenu: [
			{ label: 'None', type: 'radio', checked: state.workspace === '', click: () => actions.moveToWorkspace('') },
			SEPARATOR,
			...state.workspaces.map(workspace => ({
				label: workspace.name, type: 'radio' as const, checked: state.workspace === workspace.id, click: () => actions.moveToWorkspace(workspace.id)
			}))
		]
	}] : [];
	const service: ServiceMenuItem[] = [
		{ label: 'Edit…', click: actions.edit },
		...moveToWorkspace,
		{ label: 'Remove…', click: actions.remove }
	];
	const tools: ServiceMenuItem[] = [SEPARATOR, { label: 'Developer Tools', click: actions.developerTools }];

	return state.enabled ? [...page, ...switches, ...service, ...tools] : [...switches, ...service];
}
