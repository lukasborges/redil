import type { ServiceState } from '../shared/service.ts';

export const services = $state<{ list: ServiceState[] }>({ list: [] });

export function activeService(): ServiceState | undefined {
	return services.list.find(service => service.active);
}

export async function loadServices(): Promise<void> {
	services.list = await window.shep.invoke('services:list') as ServiceState[];
	window.shep.on('services:changed', list => { services.list = list as ServiceState[]; });
}

export function activate(id: string): void {
	window.shep.invoke('services:activate', id);
}
