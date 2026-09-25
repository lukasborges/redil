import { session } from 'electron';
import { faviconFor, iconLinksFrom } from './favicon.ts';
import { CATALOGUE, type CatalogueEntry } from '../shared/catalogue.ts';

const PAGE_BYTES_READ = 256 * 1024;
const FETCHES_AT_ONCE = 6;

const icons = new Map<string, Promise<string | null>>();
let running = 0;
const waiting: (() => void)[] = [];

async function inTurn<T>(work: () => Promise<T>): Promise<T> {
	if ( running >= FETCHES_AT_ONCE ) await new Promise<void>(resolve => waiting.push(resolve));
	running++;
	try {
		return await work();
	} finally {
		running--;
		waiting.shift()?.();
	}
}

async function fetchIcon({ url, icon }: CatalogueEntry): Promise<string | null> {
	// A session of its own: the catalogue is shown before any service's cookies are its business.
	const catalogueSession = session.fromPartition('persist:catalogue');
	try {
		if ( icon ) return await faviconFor([icon], link => catalogueSession.fetch(link));
		const response = await catalogueSession.fetch(url);
		const page = response.ok ? (await response.text()).slice(0, PAGE_BYTES_READ) : '';
		return await faviconFor(iconLinksFrom(page, response.url || url), link => catalogueSession.fetch(link));
	} catch {
		return null;
	}
}

// Only for an address the catalogue has, since the renderer names it.
export function catalogueIcon(url: string): Promise<string | null> {
	const entry = CATALOGUE.find(candidate => candidate.url === url);
	if ( !entry ) return Promise.resolve(null);
	let icon = icons.get(url);
	if ( !icon ) {
		icon = inTurn(() => fetchIcon(entry));
		icons.set(url, icon);
	}
	return icon;
}
