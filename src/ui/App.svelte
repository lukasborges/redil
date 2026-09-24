<script lang="ts">
	import { messagesFor } from '../shared/i18n/index.ts';
	import { activeService, appState, loadServices } from './services.svelte.ts';
	import TitleBar from './TitleBar.svelte';
	import Rail from './Rail.svelte';
	import Welcome from './Welcome.svelte';

	const messages = $derived(messagesFor(appState.language || window.shep.locale));
	loadServices();
</script>

<div class="shell">
	<TitleBar {messages} />
	<div class="body">
		<Rail {messages} />
		<main class="content">
			{#if !activeService()}
				<Welcome {messages} />
			{/if}
		</main>
	</div>
</div>

<style>
	.shell {
		display: grid;
		grid-template-rows: var(--rx-titlebar-height) 1fr;
		height: 100%;
	}

	.body {
		display: grid;
		grid-template-columns: var(--rx-rail-width) 1fr;
		min-height: 0;
	}

	.content {
		position: relative;
		min-width: 0;
	}
</style>
