import type { Navigation, ServiceState } from '../shared/service.ts';
import type { AppState } from '../shared/channels.ts';

export const appState = $state<AppState>({ dontDisturb: false, workspaces: [], activeWorkspace: null, unreadElsewhere: false, language: '' });

export const services = $state<{ list: ServiceState[]; hover: string; found: { active: number; matches: number } | null }>({
	list: [],
	hover: '',
	found: null
});

export function activeService(): ServiceState | undefined {
	return services.list.find(service => service.active);
}

export async function loadServices(): Promise<void> {
	Object.assign(appState, await window.shep.invoke('app:state') as AppState);
	window.shep.on('app:state', state => { Object.assign(appState, state as AppState); });
	services.list = await window.shep.invoke('services:list') as ServiceState[];
	window.shep.on('services:changed', list => { services.list = list as ServiceState[]; });
	window.shep.on('services:hover', (id, url) => { if ( id === activeService()?.id ) services.hover = String(url ?? ''); });
	window.shep.on('services:found', (id, active, matches) => {
		if ( id === activeService()?.id ) services.found = { active: Number(active), matches: Number(matches) };
	});
}

export const activate = (id: string) => window.shep.invoke('services:activate', id);
export const showServiceMenu = (id: string) => window.shep.invoke('services:menu', id);
export const reorder = (ids: string[]) => window.shep.invoke('services:reorder', ids);
export const openAddDialog = () => window.shep.invoke('overlay:open', { dialog: 'add' });
export const navigate = (id: string, where: Navigation) => window.shep.invoke('service:navigate', id, where);
export const resetZoom = (id: string) => window.shep.invoke('service:resetZoom', id);
export const find = (id: string, query: string, forward: boolean) => window.shep.invoke('service:find', id, query, forward);
export const stopFind = (id: string) => window.shep.invoke('service:stopFind', id);
export const setDontDisturb = (on: boolean) => window.shep.invoke('app:setDontDisturb', on);
export const showWorkspaceMenu = () => window.shep.invoke('workspaces:menu');
export const openPreferences = () => window.shep.invoke('overlay:open', { dialog: 'preferences' });
export const lockApp = () => window.shep.invoke('app:lock');
