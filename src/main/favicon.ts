export interface FaviconCandidate {
	dataUrl: string;
	width: number;
}

export const FAVICON_WIDTH_SHARP_AT_24PX_ON_2X = 48;

// Only what favicons arrive as. A format not read here counts as 0 wide, so it is
// chosen only when nothing else loads.
export function imageWidth(bytes: Uint8Array, type: string): number {
	if ( type === 'image/svg+xml' ) return Infinity;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const isPng = bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50;
	if ( isPng ) return view.getUint32(16);
	const isIco = bytes.length >= 6 && view.getUint16(0, true) === 0 && view.getUint16(2, true) === 1;
	if ( isIco ) {
		let widest = 0;
		const entries = view.getUint16(4, true);
		for ( let entry = 0; entry < entries && 6 + entry * 16 < bytes.length; entry++ ) {
			const byte = bytes[6 + entry * 16] ?? 0;
			widest = Math.max(widest, byte === 0 ? 256 : byte);
		}
		return widest;
	}
	const isGif = bytes.length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
	if ( isGif ) return view.getUint16(6, true);
	return 0;
}

// A data URL as the page wrote it can carry raw quotes and spaces, which break a CSS url().
export function asBase64DataUrl(url: string): string | null {
	const comma = url.indexOf(',');
	if ( comma < 0 ) return null;
	const header = url.slice(0, comma);
	if ( header.endsWith(';base64') ) return url;
	try {
		return header + ';base64,' + Buffer.from(decodeURIComponent(url.slice(comma + 1))).toString('base64');
	} catch {
		return null;
	}
}

export function dataUrlParts(url: string): { type: string; bytes: Uint8Array } | null {
	const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url);
	if ( !match?.[1] || match[3] === undefined ) return null;
	const bytes = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]));
	return { type: match[1], bytes };
}

export function pickFavicon(candidates: FaviconCandidate[]): string | null {
	if ( !candidates.length ) return null;
	const byWidth = (a: FaviconCandidate, b: FaviconCandidate) => a.width - b.width;
	const sharp = candidates.filter(candidate => candidate.width >= FAVICON_WIDTH_SHARP_AT_24PX_ON_2X).sort(byWidth);
	return (sharp[0] ?? [...candidates].sort(byWidth).at(-1))?.dataUrl ?? null;
}

// The icons a page's <link rel="icon"> tags name, as absolute addresses, then the /favicon.ico every site may have.
export function iconLinksFrom(html: string, pageUrl: string): string[] {
	const links: string[] = [];
	for ( const [tag] of html.matchAll(/<link\b[^>]*>/gi) ) {
		const rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase().split(/\s+/) ?? [];
		const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
		const target = href?.[1] ?? href?.[2] ?? href?.[3];
		if ( !target || !(rel.includes('icon') || rel.includes('apple-touch-icon')) ) continue;
		try { links.push(new URL(target.replaceAll('&amp;', '&'), pageUrl).href); } catch { /* not an address */ }
	}
	links.push(new URL('/favicon.ico', pageUrl).href);
	return [...new Set(links)];
}

const FAVICON_BYTES_LIMIT = 1024 * 1024;
const MAX_FAVICONS_ASKED = 8;

type Fetcher = (url: string) => Promise<Response>;

async function candidateFrom(url: string, fetchThroughService: Fetcher): Promise<FaviconCandidate | null> {
	if ( url.startsWith('data:image/') ) {
		const dataUrl = asBase64DataUrl(url);
		const parts = dataUrl ? dataUrlParts(dataUrl) : null;
		return dataUrl && parts ? { dataUrl, width: imageWidth(parts.bytes, parts.type) } : null;
	}
	if ( !/^https?:\/\//.test(url) ) return null;
	try {
		const response = await fetchThroughService(url);
		const type = (response.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
		const isImage = type.startsWith('image/') || type === 'application/octet-stream';
		if ( !response.ok || !isImage ) return null;
		const bytes = new Uint8Array(await response.arrayBuffer());
		if ( !bytes.length || bytes.length > FAVICON_BYTES_LIMIT ) return null;
		const servedType = type.startsWith('image/') ? type : 'image/x-icon';
		return { dataUrl: `data:${servedType};base64,${Buffer.from(bytes).toString('base64')}`, width: imageWidth(bytes, servedType) };
	} catch {
		return null;
	}
}

// Through the service's own session: some favicons need its cookies.
export async function faviconFor(urls: string[], fetchThroughService: Fetcher): Promise<string | null> {
	const candidates = await Promise.all(urls.slice(0, MAX_FAVICONS_ASKED).map(url => candidateFrom(url, fetchThroughService)));
	return pickFavicon(candidates.filter(candidate => candidate !== null));
}
