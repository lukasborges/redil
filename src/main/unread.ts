import type { UnreadCount } from '../shared/service.ts';

export type { UnreadCount };

const LEADING_TITLE_COUNT = /^\s*\(\s*(•|\d[\d.,+]*)\s*\)/;
const TITLE_COUNT_ANYWHERE = /\(\s*(•|\d[\d.,+]*)\s*\)/;

export function countFromTitle(title: string): UnreadCount {
	const match = LEADING_TITLE_COUNT.exec(title) ?? TITLE_COUNT_ANYWHERE.exec(title);
	if ( !match?.[1] ) return 0;
	if ( match[1] === '•' ) return '•';
	return parseInt((match[1].match(/\d+/g) ?? ['0']).join(''), 10);
}

export const isSomething = (count: UnreadCount) => count === '•' || count > 0;

export const TITLE_BLINK_GRACE_MS = 1500;

export function createBlinkGuard(report: (count: UnreadCount) => void, graceMs = TITLE_BLINK_GRACE_MS) {
	let current: UnreadCount = 0;
	let pendingDrop: ReturnType<typeof setTimeout> | null = null;

	const apply = (count: UnreadCount) => {
		current = count;
		report(count);
	};

	return {
		fromTitle(count: UnreadCount) {
			if ( pendingDrop ) clearTimeout(pendingDrop);
			pendingDrop = null;
			if ( !isSomething(count) && isSomething(current) ) {
				pendingDrop = setTimeout(() => { pendingDrop = null; apply(0); }, graceMs);
				return;
			}
			apply(count);
		},
		dispose() {
			if ( pendingDrop ) clearTimeout(pendingDrop);
		}
	};
}

export function totalUnread(counts: Iterable<UnreadCount>): number {
	let total = 0;
	for ( const count of counts ) if ( typeof count === 'number' ) total += count;
	return total;
}
