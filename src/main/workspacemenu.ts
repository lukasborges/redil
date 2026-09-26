import type { ActiveWorkspace, Workspace } from '../shared/workspace.ts';
import type { Messages } from '../shared/i18n/index.ts';

export interface WorkspaceMenuActions {
	choose(id: ActiveWorkspace): void;
	create(): void;
	rename(id: string): void;
	changeIcon(id: string): void;
	remove(id: string): void;
}

export interface WorkspaceMenuItem {
	label?: string;
	type?: 'separator' | 'radio';
	checked?: boolean;
	accelerator?: string;
	click?: () => void;
}

const SEPARATOR: WorkspaceMenuItem = { type: 'separator' };
const NUMBERED_SHORTCUTS = 9;

export function workspaceMenu(workspaces: readonly Workspace[], active: ActiveWorkspace, actions: WorkspaceMenuActions, messages: Messages): WorkspaceMenuItem[] {
	const shortcut = (index: number) => index < NUMBERED_SHORTCUTS ? `CommandOrControl+Alt+${index + 1}` : undefined;
	const choices: WorkspaceMenuItem[] = [
		...workspaces.map((workspace, index) => ({
			label: workspace.name, type: 'radio' as const, checked: workspace.id === active, accelerator: shortcut(index), click: () => actions.choose(workspace.id)
		})),
		{ label: messages['menu.allServices'], type: 'radio', checked: active === null, accelerator: shortcut(workspaces.length), click: () => actions.choose(null) }
	];
	const managing: WorkspaceMenuItem[] = [{ label: messages['menu.newWorkspace'], click: actions.create }];
	if ( active !== null ) {
		managing.push(
			{ label: messages['menu.renameWorkspace'], click: () => actions.rename(active) },
			{ label: messages['menu.changeIcon'], click: () => actions.changeIcon(active) },
			{ label: messages['menu.deleteWorkspace'], click: () => actions.remove(active) }
		);
	}
	return [...choices, SEPARATOR, ...managing];
}
