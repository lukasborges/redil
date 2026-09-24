import type { ServiceState } from '../shared/service.ts';

export const services = $state<{ list: ServiceState[]; hover: string; found: { active: number; matches: number } | null }>({
	list: [],
	hover: '',
	found: null
});

export function activeService(): ServiceState | undefined {
	return services.list.find(service => service.active);
}

export async function loadServices(): Promise<void> {
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
export const navigate = (id: string, where: 'back' | 'forward' | 'reload') => window.shep.invoke('service:navigate', id, where);
export const find = (id: string, query: string, forward: boolean) => window.shep.invoke('service:find', id, query, forward);
export const stopFind = (id: string) => window.shep.invoke('service:stopFind', id);
