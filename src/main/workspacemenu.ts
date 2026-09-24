import type { ActiveWorkspace, Workspace } from '../shared/workspace.ts';

export interface WorkspaceMenuActions {
	choose(id: ActiveWorkspace): void;
	create(): void;
	rename(id: string): void;
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

export function workspaceMenu(workspaces: readonly Workspace[], active: ActiveWorkspace, actions: WorkspaceMenuActions): WorkspaceMenuItem[] {
	const shortcut = (index: number) => index < NUMBERED_SHORTCUTS ? `Ctrl+Alt+${index + 1}` : undefined;
	const choices: WorkspaceMenuItem[] = [
		...workspaces.map((workspace, index) => ({
			label: workspace.name, type: 'radio' as const, checked: workspace.id === active, accelerator: shortcut(index), click: () => actions.choose(workspace.id)
		})),
		{ label: 'All Services', type: 'radio', checked: active === null, accelerator: shortcut(workspaces.length), click: () => actions.choose(null) }
	];
	const managing: WorkspaceMenuItem[] = [{ label: 'New Workspace…', click: actions.create }];
	if ( active !== null ) managing.push({ label: 'Rename…', click: () => actions.rename(active) }, { label: 'Delete', click: () => actions.remove(active) });
	return [...choices, SEPARATOR, ...managing];
}
