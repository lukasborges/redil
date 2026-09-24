export const THEMES = ['system', 'light', 'dark'] as const;
export const LANGUAGES = ['auto', 'en', 'pt-BR', 'es', 'fr', 'de', 'it', 'ru', 'ja', 'zh-CN', 'ko'] as const;
export const CLOSE_BEHAVIOURS = ['tray', 'quit'] as const;

export interface Preferences {
	theme: (typeof THEMES)[number];
	language: (typeof LANGUAGES)[number];
	startMinimized: boolean;
	closeBehaviour: (typeof CLOSE_BEHAVIOURS)[number];
	trayIcon: boolean;
	alwaysOnTop: boolean;
	startWithSystem: boolean;
	// 'welcome', 'last', or a service id
	openOnStart: string;
	spellcheck: boolean;
	// empty works them out from the app's and the desktop's language
	spellcheckLanguages: string[];
	lockOnStart: boolean;
	proxyEnabled: boolean;
	proxyHost: string;
	proxyPort: number;
	userAgent: string;
	hardwareAcceleration: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
	theme: 'system',
	language: 'auto',
	startMinimized: false,
	closeBehaviour: 'tray',
	trayIcon: true,
	alwaysOnTop: false,
	startWithSystem: false,
	openOnStart: 'last',
	spellcheck: true,
	spellcheckLanguages: [],
	lockOnStart: false,
	proxyEnabled: false,
	proxyHost: '',
	proxyPort: 8080,
	userAgent: '',
	hardwareAcceleration: true
};

// Preferences a change of which takes a relaunch to apply.
export const RELAUNCH_PREFERENCES: readonly (keyof Preferences)[] = ['hardwareAcceleration', 'spellcheck'];

const MAX_PORT = 65535;

// A value from the renderer, or from a hand-edited file, as the type it has to be; null when it is not one.
export function acceptPreference<K extends keyof Preferences>(key: K, value: unknown): Preferences[K] | null {
	const fallback = DEFAULT_PREFERENCES[key];
	const oneOf = (allowed: readonly string[]) => typeof value === 'string' && allowed.includes(value) ? value : null;
	switch ( key ) {
		case 'theme': return oneOf(THEMES) as Preferences[K] | null;
		case 'language': return oneOf(LANGUAGES) as Preferences[K] | null;
		case 'closeBehaviour': return oneOf(CLOSE_BEHAVIOURS) as Preferences[K] | null;
		case 'proxyPort': {
			const port = Number(value);
			return Number.isInteger(port) && port > 0 && port <= MAX_PORT ? port as Preferences[K] : null;
		}
		case 'spellcheckLanguages':
			return Array.isArray(value) && value.every(item => typeof item === 'string') ? value as Preferences[K] : null;
		default:
			if ( typeof fallback === 'boolean' ) return typeof value === 'boolean' ? value as Preferences[K] : null;
			if ( typeof fallback === 'string' ) return typeof value === 'string' ? value.trim() as Preferences[K] : null;
			return null;
	}
}
