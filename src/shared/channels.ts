import type { ActiveWorkspace, Workspace } from './workspace.ts';

export const INVOKE_CHANNELS = [
	'app:getVersion',
	'services:list', 'services:activate', 'services:add', 'services:update', 'services:reorder', 'services:menu', 'services:record',
	'service:navigate', 'service:find', 'service:stopFind',
	'overlay:open', 'overlay:close',
	'app:state', 'app:setDontDisturb',
	'workspaces:menu', 'workspaces:save', 'workspaces:get',
	'preferences:get', 'preferences:set', 'app:action', 'spellcheck:languages',
	'lock:hasPassword', 'lock:setPassword', 'app:about', 'services:report'
] as const;

export const APP_ACTIONS = ['reportIssue', 'clearCache', 'removeAllServices', 'checkForUpdates', 'relaunch'] as const;
export type AppAction = (typeof APP_ACTIONS)[number];
export const EVENT_CHANNELS = ['services:changed', 'services:certificate-error', 'services:hover', 'services:found', 'overlay:show', 'app:state', 'titlebar:find'] as const;

export interface AppState {
	dontDisturb: boolean;
	workspaces: Workspace[];
	activeWorkspace: ActiveWorkspace;
	unreadElsewhere: boolean;
	// resolved: the desktop's when the preference is 'auto'
	language: string;
}

export type InvokeChannel = (typeof INVOKE_CHANNELS)[number];
export type EventChannel = (typeof EVENT_CHANNELS)[number];
