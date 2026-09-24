import type { ActiveWorkspace, Workspace } from './workspace.ts';

export const INVOKE_CHANNELS = [
	'app:getVersion',
	'services:list', 'services:activate', 'services:add', 'services:update', 'services:reorder', 'services:menu', 'services:record',
	'service:navigate', 'service:find', 'service:stopFind',
	'overlay:open', 'overlay:close',
	'app:state', 'app:setDontDisturb',
	'workspaces:menu', 'workspaces:save', 'workspaces:get'
] as const;
export const EVENT_CHANNELS = ['services:changed', 'services:certificate-error', 'services:hover', 'services:found', 'overlay:show', 'app:state', 'titlebar:find'] as const;

export interface AppState {
	dontDisturb: boolean;
	workspaces: Workspace[];
	activeWorkspace: ActiveWorkspace;
	unreadElsewhere: boolean;
}

export type InvokeChannel = (typeof INVOKE_CHANNELS)[number];
export type EventChannel = (typeof EVENT_CHANNELS)[number];
