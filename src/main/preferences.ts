import { nativeTheme, type BrowserWindow, type Session } from 'electron';
import { acceptPreference, RELAUNCH_PREFERENCES, type Preferences } from '../shared/preferences.ts';
import { preferences, store } from './store.ts';

type Applier = (value: never) => void;

export class PreferenceHost {
	private readonly sessions = new Set<Session>();
	private readonly appliers: Partial<Record<keyof Preferences, Applier>>;

	constructor(window: BrowserWindow, private readonly changed: () => void) {
		this.appliers = {
			theme: ((theme: Preferences['theme']) => { nativeTheme.themeSource = theme; }) as Applier,
			alwaysOnTop: ((on: boolean) => window.setAlwaysOnTop(on)) as Applier,
			proxyEnabled: (() => this.sessions.forEach(session => this.applyProxy(session))) as Applier,
			proxyHost: (() => this.sessions.forEach(session => this.applyProxy(session))) as Applier,
			proxyPort: (() => this.sessions.forEach(session => this.applyProxy(session))) as Applier
		};
		window.setAlwaysOnTop(preferences().alwaysOnTop);
	}

	get(): Preferences {
		return preferences();
	}

	// true when it takes a relaunch to apply
	set<K extends keyof Preferences>(key: K, value: unknown): boolean {
		const accepted = acceptPreference(key, value);
		if ( accepted === null ) return false;
		store.set('preferences', { ...preferences(), [key]: accepted });
		(this.appliers[key] as ((value: Preferences[K]) => void) | undefined)?.(accepted);
		this.changed();
		return RELAUNCH_PREFERENCES.includes(key);
	}

	// Every service keeps its own session, so each one needs the proxy set.
	followProxy(session: Session): void {
		this.sessions.add(session);
		this.applyProxy(session);
	}

	private applyProxy(session: Session): void {
		const { proxyEnabled, proxyHost, proxyPort } = preferences();
		session.setProxy(proxyEnabled && proxyHost ? { proxyRules: `${proxyHost}:${proxyPort}` } : { mode: 'system' }).catch(() => {});
	}
}

export function applyThemeBeforeTheWindow(): void {
	nativeTheme.themeSource = preferences().theme;
}
