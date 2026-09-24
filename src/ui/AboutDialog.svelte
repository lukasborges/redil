<script lang="ts">
	import type { Messages } from '../shared/i18n.ts';
	import logo from './lib/logo.svg';

	const { messages, onclose }: { messages: Messages; onclose: () => void } = $props();

	let about = $state<{ version: string; electron: string; chrome: string; homepage: string } | null>(null);
	$effect(() => { window.shep.invoke('app:about').then(value => { about = value as typeof about; }); });
</script>

<div class="dialog about" role="dialog" aria-label="Shep">
	<img src={logo} alt="" width="96" height="96" />
	<h2>Shep</h2>
	<p>{messages['about.body']}</p>
	{#if about}
		<p class="versions">{messages['about.version']} {about.version} · Electron {about.electron} · Chromium {about.chrome}</p>
		<p class="links"><a href={about.homepage} target="_blank" rel="noreferrer">{about.homepage.replace('https://', '')}</a> · {messages['about.licence']}</p>
	{/if}
	<footer><button type="button" class="primary" onclick={onclose}>{messages['dialog.close']}</button></footer>
</div>

<style>
	.about {
		align-items: center;
		text-align: center;
	}

	h2, p {
		margin: 0;
	}

	.versions, .links {
		color: var(--rx-muted);
		font-size: 12px;
	}

	a {
		color: var(--rx-accent);
	}

	footer {
		align-self: stretch;
	}
</style>
