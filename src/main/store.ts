import Store from 'electron-store';
import type { ServiceRecord } from '../shared/service.ts';

interface Schema {
	services: ServiceRecord[];
	activeServiceId: string | null;
	// partition|permission → the answer the person gave once
	permissions: Record<string, boolean>;
	dontDisturb: boolean;
}

// shep.json, not config.json: Shep 0.10's config.json stays readable for the migration.
export const store = new Store<Schema>({
	name: 'shep',
	defaults: { services: [], activeServiceId: null, permissions: {}, dontDisturb: false }
});

export function updateService(id: string, changes: Partial<ServiceRecord>): void {
	store.set('services', store.get('services').map(service => service.id === id ? { ...service, ...changes } : service));
}
