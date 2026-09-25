import entries from '../../resources/catalogue.json' with { type: 'json' };

export const CATALOGUE_GROUPS = ['messaging', 'work', 'mail', 'tasks', 'assistants', 'support', 'music'] as const;
export type CatalogueGroup = (typeof CATALOGUE_GROUPS)[number];

export interface CatalogueEntry {
	name: string;
	url: string;
	group: CatalogueGroup;
	// for a site whose signed-out page shows only its sign-in's icon
	icon?: string;
}

// Addresses to start from, nothing more: a service added from here is the same as one typed in.
export const CATALOGUE = entries as readonly CatalogueEntry[];

const folded = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

// By name or by address, so both "outlook" and "office.com" find it.
export function matchCatalogue(query: string, catalogue: readonly CatalogueEntry[] = CATALOGUE): CatalogueEntry[] {
	const wanted = folded(query).replace(/^https?:\/\//, '');
	if ( !wanted ) return [...catalogue];
	return catalogue.filter(entry => folded(entry.name).includes(wanted) || folded(entry.url).replace(/^https?:\/\//, '').includes(wanted));
}
