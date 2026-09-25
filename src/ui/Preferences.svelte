<script lang="ts" module>
	export const SECTIONS = ['appearance', 'window', 'services', 'security', 'advanced'] as const;
	type Section = (typeof SECTIONS)[number];
	// kept across the remount a dialog opened from here causes on its way back
	let lastSection: Section = 'appearance';
</script>

<script lang="ts">
	import { fill, type Messages } from '../shared/i18n/index.ts';
	import { LANGUAGES, type Preferences } from '../shared/preferences.ts';
	import type { ServiceState } from '../shared/service.ts';
	import type { AppAction } from '../shared/channels.ts';
	import Row from './Row.svelte';
	import Switch from './Switch.svelte';

	const { messages, locale, onclose, onopen }: { messages: Messages; locale: string; onclose: () => void; onopen: (dialog: 'about' | 'unreadReport' | 'lockPassword') => void } = $props();

	const LANGUAGE_NAMES: Record<string, string> = {
		en: 'English', 'pt-BR': 'Português (Brasil)', es: 'Español', fr: 'Français', de: 'Deutsch',
		it: 'Italiano', ru: 'Русский', ja: '日本語', 'zh-CN': '简体中文', ko: '한국어'
	};

	let section = $state<Section>(lastSection);
	$effect(() => { lastSection = section; });
	let prefs = $state<Preferences | null>(null);
	let services = $state<ServiceState[]>([]);
	let dictionaries = $state<{ available: string[]; automatic: string[] }>({ available: [], automatic: [] });
	let needsRelaunch = $state(false);
	let hasLockPassword = $state(false);

	$effect(() => {
		window.shep.invoke('preferences:get').then(value => { prefs = value as Preferences; });
		window.shep.invoke('services:list').then(value => { services = value as ServiceState[]; });
		window.shep.invoke('spellcheck:languages').then(value => { dictionaries = value as typeof dictionaries; });
		window.shep.invoke('lock:hasPassword').then(value => { hasLockPassword = value === true; });
	});

	async function set<K extends keyof Preferences>(key: K, value: Preferences[K]) {
		if ( !prefs ) return;
		prefs[key] = value;
		if ( await window.shep.invoke('preferences:set', key, value) ) needsRelaunch = true;
	}

	const act = (action: AppAction) => window.shep.invoke('app:action', action);

	const displayNames = $derived(new Intl.DisplayNames([locale], { type: 'language', languageDisplay: 'standard' }));
	function dictionaryName(language: string): string {
		let name = language;
		// Chromium lists a few dictionaries under tags Intl does not know
		try { name = displayNames.of(language) ?? language; } catch { /* keep the tag */ }
		return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
	}
	const byName = (languages: string[]) => languages.map(language => ({ language, name: dictionaryName(language) })).sort((a, b) => a.name.localeCompare(b.name, locale));
	const addable = $derived(byName(dictionaries.available.filter(language => !prefs?.spellcheckLanguages.includes(language))));

	const addDictionary = (language: string) => { if ( prefs && language ) set('spellcheckLanguages', [...prefs.spellcheckLanguages, language]); };
	const removeDictionary = (language: string) => { if ( prefs ) set('spellcheckLanguages', prefs.spellcheckLanguages.filter(chosen => chosen !== language)); };
</script>

<div class="preferences" role="dialog" aria-label={messages['prefs.title']}>
	<nav aria-label={messages['prefs.title']}>
		<h2>{messages['prefs.title']}</h2>
		{#each SECTIONS as name (name)}
			<button type="button" class:current={section === name} aria-current={section === name ? 'page' : undefined} onclick={() => { section = name; }}>{messages[`prefs.${name}`]}</button>
		{/each}
	</nav>

	<section>
		{#if prefs}
			<div class="group">
				{#if section === 'appearance'}
					<Row title={messages['prefs.theme']}>
						<select value={prefs.theme} onchange={event => set('theme', event.currentTarget.value as Preferences['theme'])}>
							<option value="system">{messages['prefs.theme.system']}</option>
							<option value="light">{messages['prefs.theme.light']}</option>
							<option value="dark">{messages['prefs.theme.dark']}</option>
						</select>
					</Row>
					<Row title={messages['prefs.language']}>
						<select value={prefs.language} onchange={event => set('language', event.currentTarget.value as Preferences['language'])}>
							{#each LANGUAGES as language (language)}
								<option value={language}>{language === 'auto' ? messages['prefs.language.auto'] : LANGUAGE_NAMES[language]}</option>
							{/each}
						</select>
					</Row>
				{:else if section === 'window'}
					<Row title={messages['prefs.closeBehaviour']}>
						<select value={prefs.closeBehaviour} onchange={event => set('closeBehaviour', event.currentTarget.value as Preferences['closeBehaviour'])}>
							<option value="tray">{messages['prefs.closeBehaviour.tray']}</option>
							<option value="quit">{messages['prefs.closeBehaviour.quit']}</option>
						</select>
					</Row>
					<Row title={messages['prefs.trayIcon']}><Switch label={messages['prefs.trayIcon']} checked={prefs.trayIcon} onchange={on => set('trayIcon', on)} /></Row>
					<Row title={messages['prefs.startMinimized']}><Switch label={messages['prefs.startMinimized']} checked={prefs.startMinimized} onchange={on => set('startMinimized', on)} /></Row>
					<Row title={messages['prefs.startWithSystem']}><Switch label={messages['prefs.startWithSystem']} checked={prefs.startWithSystem} onchange={on => set('startWithSystem', on)} /></Row>
					<Row title={messages['prefs.alwaysOnTop']}><Switch label={messages['prefs.alwaysOnTop']} checked={prefs.alwaysOnTop} onchange={on => set('alwaysOnTop', on)} /></Row>
				{:else if section === 'services'}
					<Row title={messages['prefs.openOnStart']}>
						<select value={prefs.openOnStart} onchange={event => set('openOnStart', event.currentTarget.value)}>
							<option value="last">{messages['prefs.openOnStart.last']}</option>
							<option value="welcome">{messages['prefs.openOnStart.welcome']}</option>
							{#each services as service (service.id)}<option value={service.id}>{service.name}</option>{/each}
						</select>
					</Row>
					<Row title={messages['prefs.spellcheck']} hint={messages['prefs.relaunch']}><Switch label={messages['prefs.spellcheck']} checked={prefs.spellcheck} onchange={on => set('spellcheck', on)} /></Row>
					{#if prefs.spellcheck && dictionaries.available.length}
						{@const chosen = prefs.spellcheckLanguages.filter(language => dictionaries.available.includes(language))}
						<Row title={messages['prefs.spellcheckLanguages']} hint={chosen.length
							? messages['prefs.spellcheckLanguages.picked']
							: fill(messages['prefs.spellcheckLanguages.automatic'], { languages: dictionaries.automatic.map(dictionaryName).join(', ') })}>
							<select name="addDictionary" value="" onchange={event => { addDictionary(event.currentTarget.value); event.currentTarget.value = ''; }}>
								<option value="" disabled>{messages['prefs.spellcheckLanguages.add']}</option>
								{#each addable as { language, name } (language)}<option value={language}>{name}</option>{/each}
							</select>
						</Row>
						{#if chosen.length}
							<ul class="dictionaries">
								{#each chosen as language (language)}
									<li>
										{dictionaryName(language)}
										<button type="button" aria-label={fill(messages['prefs.spellcheckLanguages.remove'], { language: dictionaryName(language) })} onclick={() => removeDictionary(language)}>×</button>
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
				{:else if section === 'security'}
					<Row title={messages['prefs.lockPassword']} hint={messages['prefs.lockPassword.hint']}>
						<button type="button" class="secondary" onclick={() => onopen('lockPassword')}>{hasLockPassword ? messages['prefs.lockPassword.change'] : messages['prefs.lockPassword.set']}</button>
					</Row>
					{#if hasLockPassword}
						<Row title={messages['prefs.lockOnStart']}><Switch label={messages['prefs.lockOnStart']} checked={prefs.lockOnStart} onchange={on => set('lockOnStart', on)} /></Row>
					{/if}
				{:else if section === 'advanced'}
					<Row title={messages['prefs.proxy']}><Switch label={messages['prefs.proxy']} checked={prefs.proxyEnabled} onchange={on => set('proxyEnabled', on)} /></Row>
					{#if prefs.proxyEnabled}
						<Row title={messages['prefs.proxyHost']}><input name="proxyHost" type="text" value={prefs.proxyHost} onchange={event => set('proxyHost', event.currentTarget.value)} /></Row>
						<Row title={messages['prefs.proxyPort']}><input name="proxyPort" type="number" min="1" max="65535" value={prefs.proxyPort} onchange={event => set('proxyPort', Number(event.currentTarget.value))} /></Row>
					{/if}
					<Row title={messages['prefs.userAgent']} hint={messages['prefs.userAgent.hint']}><input name="userAgent" type="text" value={prefs.userAgent} onchange={event => set('userAgent', event.currentTarget.value)} /></Row>
					<Row title={messages['prefs.hardwareAcceleration']} hint={messages['prefs.relaunch']}><Switch label={messages['prefs.hardwareAcceleration']} checked={prefs.hardwareAcceleration} onchange={on => set('hardwareAcceleration', on)} /></Row>
				{/if}
			</div>

			{#if section === 'advanced'}
				<div class="actions">
					<button type="button" class="secondary" onclick={() => onopen('about')}>{messages['prefs.about']}</button>
					<button type="button" class="secondary" onclick={() => act('checkForUpdates')}>{messages['prefs.checkForUpdates']}</button>
					<button type="button" class="secondary" onclick={() => act('reportIssue')}>{messages['prefs.reportIssue']}</button>
					<button type="button" class="secondary" onclick={() => onopen('unreadReport')}>{messages['prefs.unreadReport']}</button>
					<button type="button" class="secondary" onclick={() => act('clearCache')}>{messages['prefs.clearCache']}</button>
					<button type="button" class="destructive" onclick={() => act('removeAllServices')}>{messages['prefs.removeAllServices']}</button>
				</div>
			{/if}

			{#if needsRelaunch}
				<div class="relaunch" role="status">
					<span>{messages['prefs.relaunch']}</span>
					<button type="button" class="primary" onclick={() => act('relaunch')}>{messages['prefs.relaunchNow']}</button>
				</div>
			{/if}
		{/if}
		<footer><button type="button" class="secondary" onclick={onclose}>{messages['dialog.close']}</button></footer>
	</section>
</div>

<style>
	.preferences {
		display: grid;
		grid-template-columns: 180px 1fr;
		width: min(720px, calc(100vw - 32px));
		height: min(520px, calc(100vh - 32px));
		overflow: hidden;
		border-radius: 12px;
		background-color: var(--rx-raised);
		color: var(--rx-ink);
		box-shadow: 0 0 0 1px var(--rx-line), 0 8px 32px var(--rx-shadow);
	}

	nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 16px 10px;
		background-color: color-mix(in srgb, var(--rx-ink) 4%, var(--rx-raised));
		border-right: 1px solid var(--rx-line);
	}

	h2 {
		margin: 0 8px 12px;
		font-size: 16px;
		font-weight: 700;
	}

	nav button {
		padding: 8px 10px;
		border: 0;
		border-radius: 8px;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	nav button:hover, nav button.current {
		background-color: color-mix(in srgb, var(--rx-ink) 8%, transparent);
	}

	nav button.current {
		font-weight: 600;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-height: 0;
		padding: 20px;
		overflow-y: auto;
	}

	.group {
		border: 1px solid var(--rx-line);
		border-radius: 12px;
		background-color: var(--rx-field);
	}

	select, input[type='text'], input[type='number'] {
		height: 32px;
		padding: 0 8px;
		border: 1px solid var(--rx-line);
		border-radius: 8px;
		background-color: var(--rx-raised);
		color: inherit;
		font: inherit;
	}

	input[type='text'] {
		width: 240px;
	}

	input[type='number'] {
		width: 96px;
	}

	/* a dictionary's name can run long, and the select would grow to it */
	select[name='addDictionary'] {
		width: 200px;
	}

	.dictionaries {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		padding: 0 14px 12px;
		list-style: none;
	}

	.dictionaries li {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 28px;
		padding: 0 4px 0 10px;
		border-radius: 14px;
		background-color: color-mix(in srgb, var(--rx-ink) 8%, transparent);
		font-size: 13px;
	}

	.dictionaries button {
		width: 22px;
		height: 22px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--rx-muted);
		font: inherit;
		font-size: 15px;
		line-height: 1;
		cursor: pointer;
	}

	.dictionaries button:hover {
		background-color: color-mix(in srgb, var(--rx-ink) 12%, transparent);
		color: inherit;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.relaunch {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 14px;
		border-radius: 10px;
		background-color: color-mix(in srgb, var(--rx-accent) 14%, transparent);
	}

	footer {
		display: flex;
		justify-content: flex-end;
		margin-top: auto;
	}

	button.secondary, button.primary, button.destructive {
		height: 32px;
		padding: 0 14px;
		border: 0;
		border-radius: 8px;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.secondary { background-color: color-mix(in srgb, var(--rx-ink) 8%, transparent); color: inherit; }
	.primary { background-color: var(--rx-accent); color: var(--rx-on-accent); }
	.destructive { background-color: color-mix(in srgb, var(--rx-alert) 14%, transparent); color: var(--rx-alert); }
</style>
