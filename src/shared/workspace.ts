import type { UnreadCount } from './service.ts';

export interface Workspace {
	id: string;
	name: string;
	hue: WorkspaceHue;
}

export const WORKSPACE_HUES = ['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'brown'] as const;
export type WorkspaceHue = (typeof WORKSPACE_HUES)[number];

// null is All Services: no filter, not a workspace.
export type ActiveWorkspace = string | null;

// A service in no workspace ('') belongs to every one.
export function isShownIn(serviceWorkspace: string, active: ActiveWorkspace): boolean {
	return active === null || serviceWorkspace === '' || serviceWorkspace === active;
}

// Ctrl+Alt and a number: the workspaces in order, then All Services right after the last.
export function workspaceForNumber(index: number, workspaces: readonly Workspace[]): ActiveWorkspace | undefined {
	if ( index < workspaces.length ) return workspaces[index]?.id;
	if ( index === workspaces.length ) return null;
	return undefined;
}

export function hasUnreadElsewhere(services: readonly { workspace: string; unread: UnreadCount }[], active: ActiveWorkspace): boolean {
	return active !== null && services.some(service => !isShownIn(service.workspace, active) && (service.unread === '•' || service.unread > 0));
}
