import Store from 'electron-store';
import type { ServiceRecord } from '../shared/service.ts';
import type { ActiveWorkspace, Workspace } from '../shared/workspace.ts';
import { DEFAULT_PREFERENCES, type Preferences } from '../shared/preferences.ts';

interface Schema {
	services: ServiceRecord[];
	activeServiceId: string | null;
	// partition|permission → the answer the person gave once
	permissions: Record<string, boolean>;
	dontDisturb: boolean;
	workspaces: Workspace[];
	activeWorkspace: ActiveWorkspace;
	preferences: Preferences;
	lockPasswordHash: string;
}

// shep.json, not config.json: Shep 0.10's config.json stays readable for the migration.
export const store = new Store<Schema>({
	name: 'shep',
	defaults: {
		services: [], activeServiceId: null, permissions: {}, dontDisturb: false, workspaces: [], activeWorkspace: null,
		preferences: DEFAULT_PREFERENCES, lockPasswordHash: ''
	}
});

export function updateService(id: string, changes: Partial<ServiceRecord>): void {
	store.set('services', store.get('services').map(service => service.id === id ? { ...service, ...changes } : service));
}

// Defaults under what was saved, so a preference added in a later version has a value.
export function preferences(): Preferences {
	return { ...DEFAULT_PREFERENCES, ...store.get('preferences') };
}
