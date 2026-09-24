<script lang="ts">
	import type { Messages } from '../shared/i18n.ts';
	import { services, activeService, navigate, find, stopFind } from './services.svelte.ts';
	import { initials } from './initials.ts';
	import Icon from './Icon.svelte';

	const { messages }: { messages: Messages } = $props();

	const service = $derived(activeService());
	// the page's own count is already on the rail
	const pageTitle = $derived((service?.pageTitle ?? '').replace(/^\s*\([^)]*\)\s*/, ''));
	const detail = $derived(services.hover || (pageTitle !== service?.name ? pageTitle : ''));

	let finding = $state(false);
	let query = $state('');
	let field = $state<HTMLInputElement>();

	window.shep.on('titlebar:find', () => { if ( service ) openFind(); });

	function openFind() {
		finding = true;
		queueMicrotask(() => field?.select());
	}

	function closeFind() {
		finding = false;
		query = '';
		services.found = null;
		if ( service ) stopFind(service.id);
	}

	function search(forward = true) {
		if ( service ) find(service.id, query, forward);
	}

	function onKey(event: KeyboardEvent) {
		if ( event.key === 'Escape' ) closeFind();
		if ( event.key === 'Enter' ) search(!event.shiftKey);
	}
</script>

<header class="titlebar">
	{#if service}
		<div class="group start">
			<button type="button" title={messages['titlebar.back']} aria-label={messages['titlebar.back']} disabled={!service.canGoBack} onclick={() => navigate(service.id, 'back')}><Icon name="back" /></button>
			<button type="button" title={messages['titlebar.forward']} aria-label={messages['titlebar.forward']} disabled={!service.canGoForward} onclick={() => navigate(service.id, 'forward')}><Icon name="forward" /></button>
			<button type="button" title={messages['titlebar.reload']} aria-label={messages['titlebar.reload']} class:loading={service.loading} onclick={() => navigate(service.id, 'reload')}><Icon name="reload" /></button>
		</div>
	{/if}

	<div class="identity">
		{#if service}
			{#if service.favicon}<img src={service.favicon} alt="" width="16" height="16" />{:else}<span class="initials">{initials(service.name)}</span>{/if}
			<b>{service.name}</b>
			{#if detail}<span class="detail">{detail}</span>{/if}
		{:else}
			<b>Shep</b>
		{/if}
	</div>

	{#if service}
		<div class="group end">
			{#if finding}
				<input bind:this={field} bind:value={query} type="search" placeholder={messages['find.placeholder']} aria-label={messages['find.placeholder']}
					oninput={() => search()} onkeydown={onKey} />
				<span class="matches">{#if query && services.found}{services.found.matches ? `${services.found.active}/${services.found.matches}` : messages['find.none']}{/if}</span>
				<button type="button" title={messages['find.previous']} aria-label={messages['find.previous']} onclick={() => search(false)}><Icon name="up" /></button>
				<button type="button" title={messages['find.next']} aria-label={messages['find.next']} onclick={() => search(true)}><Icon name="down" /></button>
				<button type="button" title={messages['dialog.cancel']} aria-label={messages['dialog.cancel']} onclick={closeFind}><Icon name="close" /></button>
			{:else}
				<button type="button" title={messages['titlebar.find']} aria-label={messages['titlebar.find']} onclick={openFind}><Icon name="find" /></button>
			{/if}
		</div>
	{/if}
</header>

<style>
	.titlebar {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		background-color: var(--rx-chrome);
		color: var(--rx-on-chrome);
		/* the window buttons the system paints over one end */
		padding-left: max(8px, env(titlebar-area-x, 0px));
		padding-right: max(8px, calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw)));
		-webkit-app-region: drag;
		user-select: none;
		font-size: 13px;
	}

	.group {
		display: flex;
		align-items: center;
		gap: 2px;
		-webkit-app-region: no-drag;
	}

	.group.end {
		margin-left: auto;
	}

	button {
		display: grid;
		place-items: center;
		width: 28px;
		height: 24px;
		border: 0;
		border-radius: var(--rx-radius);
		background: none;
		color: inherit;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		background-color: var(--rx-hover-on-chrome);
	}

	button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	button.loading :global(svg) {
		animation: turn 1s linear infinite;
	}

	@keyframes turn {
		to { transform: rotate(360deg); }
	}

	/* centred on the window, not on the space the buttons leave */
	.identity {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 50vw;
		white-space: nowrap;
		pointer-events: none;
	}

	.identity img, .identity .initials {
		flex: 0 0 16px;
		width: 16px;
		height: 16px;
	}

	.identity .initials {
		display: grid;
		place-items: center;
		border-radius: 4px;
		background-color: var(--rx-muted);
		color: #FFFFFF;
		font-size: 8px;
		font-weight: 700;
	}

	.detail {
		overflow: hidden;
		text-overflow: ellipsis;
		opacity: 0.7;
	}

	input {
		width: 200px;
		height: 22px;
		padding: 0 8px;
		border: 0;
		border-radius: var(--rx-radius);
		background-color: var(--rx-hover-on-chrome);
		color: inherit;
		font: inherit;
		outline: none;
	}

	.matches {
		min-width: 48px;
		text-align: center;
		opacity: 0.7;
	}
</style>
