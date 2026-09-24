const MAX_AUTOMATIC_LANGUAGES = 3;
const LAST_RESORT = 'en-US';

// A candidate such as pt_BR.UTF-8 or pt-BR as a dictionary this build has: the exact one, or one for the same language.
function dictionaryFor(candidate: string, available: readonly string[]): string | undefined {
	const tag = candidate.split('.')[0]?.replace('_', '-') ?? '';
	if ( !tag || tag === 'C' || tag === 'POSIX' ) return undefined;
	const exact = available.find(language => language.toLowerCase() === tag.toLowerCase());
	if ( exact ) return exact;
	const base = tag.split('-')[0]?.toLowerCase();
	return available.find(language => language.split('-')[0]?.toLowerCase() === base);
}

// The ones picked in Preferences, or else worked out: the app's language, the desktop's, LANG, then English.
export function spellingLanguages(chosen: readonly string[], available: readonly string[], candidates: readonly string[]): string[] {
	const picked = chosen.filter(language => available.includes(language));
	if ( picked.length ) return picked;
	const worked: string[] = [];
	for ( const candidate of [...candidates, LAST_RESORT] ) {
		const dictionary = dictionaryFor(candidate, available);
		if ( dictionary && !worked.includes(dictionary) ) worked.push(dictionary);
		if ( worked.length === MAX_AUTOMATIC_LANGUAGES ) break;
	}
	return worked;
}
