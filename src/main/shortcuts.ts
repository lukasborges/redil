export interface KeyInput {
	type: string;
	key: string;
	control: boolean;
	shift: boolean;
	alt: boolean;
	meta: boolean;
	isAutoRepeat?: boolean;
}

export type ShortcutAction =
	| { action: 'service'; index: number }
	| { action: 'workspace'; index: number }
	| { action: 'cycle'; step: 1 | -1 }
	| { action: 'find' }
	| { action: 'reload'; ignoringCache: boolean }
	| { action: 'zoom'; step: 1 | -1 | 0 }
	| { action: 'history'; direction: 'back' | 'forward' }
	| { action: 'fullscreen' }
	| { action: 'developerTools' }
	| { action: 'preferences' }
	| { action: 'addService' }
	| { action: 'dontDisturb' }
	| { action: 'lock' }
	| { action: 'quit' };

const DIGIT = /^[1-9]$/;

export function shortcutFor(input: KeyInput): ShortcutAction | null {
	if ( input.type !== 'keyDown' || input.meta ) return null;
	const { key, control, shift, alt } = input;
	const lower = key.length === 1 ? key.toLowerCase() : key;

	if ( control && alt && !shift && DIGIT.test(key) ) return { action: 'workspace', index: Number(key) - 1 };
	if ( control && !alt && !shift && DIGIT.test(key) ) return { action: 'service', index: Number(key) - 1 };
	if ( control && !alt && (key === 'Tab' || key === 'PageDown' || key === 'PageUp') ) {
		const backwards = key === 'PageUp' || (key === 'Tab' && shift);
		return { action: 'cycle', step: backwards ? -1 : 1 };
	}
	if ( alt && !control && !shift && (key === 'ArrowLeft' || key === 'ArrowRight') ) {
		return { action: 'history', direction: key === 'ArrowLeft' ? 'back' : 'forward' };
	}
	if ( alt && shift && !control && lower === 'd' ) return { action: 'dontDisturb' };
	if ( alt && shift && !control && lower === 'l' ) return { action: 'lock' };
	if ( key === 'F11' && !control && !alt && !shift ) return { action: 'fullscreen' };
	if ( key === 'F5' && !alt ) return { action: 'reload', ignoringCache: control };
	if ( !control || alt ) return null;

	if ( shift && lower === 'i' ) return { action: 'developerTools' };
	if ( lower === 'r' ) return { action: 'reload', ignoringCache: shift };
	if ( shift ) return lower === '+' ? { action: 'zoom', step: 1 } : null;
	switch ( lower ) {
		case 'f': return { action: 'find' };
		case '=': case '+': return { action: 'zoom', step: 1 };
		case '-': return { action: 'zoom', step: -1 };
		case '0': return { action: 'zoom', step: 0 };
		case ',': return { action: 'preferences' };
		case 'n': return { action: 'addService' };
		case 'q': return { action: 'quit' };
		default: return null;
	}
}
