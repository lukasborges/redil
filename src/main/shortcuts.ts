export interface KeyInput {
	type: string;
	key: string;
	control: boolean;
	shift: boolean;
	alt: boolean;
	meta: boolean;
	code?: string;
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

export function shortcutFor(input: KeyInput, platform: NodeJS.Platform): ShortcutAction | null {
	if ( input.type !== 'keyDown' ) return null;
	return platform === 'darwin' ? onMac(input) : elsewhere(input);
}

function elsewhere({ key, control, shift, alt, meta }: KeyInput): ShortcutAction | null {
	if ( meta ) return null;
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

// Command stands where Control does elsewhere. Option turns a key into another character, so what is pressed with
// it is read from where the key sits; and Option or Command with an arrow moves the caret, so history is on the
// brackets, as in Safari.
function onMac({ key, code = '', control, shift, alt, meta }: KeyInput): ShortcutAction | null {
	const lower = key.length === 1 ? key.toLowerCase() : key;
	const letter = code.startsWith('Key') ? code.slice(3).toLowerCase() : lower;
	const digit = code.startsWith('Digit') ? code.slice(5) : key;

	if ( control && !meta && !alt && key === 'Tab' ) return { action: 'cycle', step: shift ? -1 : 1 };
	if ( alt && shift && !control && !meta && letter === 'd' ) return { action: 'dontDisturb' };
	if ( alt && shift && !control && !meta && letter === 'l' ) return { action: 'lock' };
	if ( control && meta && !alt && !shift && letter === 'f' ) return { action: 'fullscreen' };
	if ( !meta || control ) return null;

	if ( alt && !shift && DIGIT.test(digit) ) return { action: 'workspace', index: Number(digit) - 1 };
	if ( alt && !shift && letter === 'i' ) return { action: 'developerTools' };
	if ( alt ) return null;
	if ( !shift && DIGIT.test(key) ) return { action: 'service', index: Number(key) - 1 };
	if ( key === '[' || key === ']' ) return { action: 'history', direction: key === '[' ? 'back' : 'forward' };
	if ( key === '{' || key === '}' ) return { action: 'cycle', step: key === '{' ? -1 : 1 };
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
