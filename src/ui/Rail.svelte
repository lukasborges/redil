<script lang="ts">
	import type { Messages } from '../shared/i18n.ts';
	import { services, activate } from './services.svelte.ts';
	import { initials } from './initials.ts';

	const { messages }: { messages: Messages } = $props();
</script>

<nav class="rail" aria-label="Services">
	{#each services.list as service (service.id)}
		<button class="service" class:active={service.active} class:disabled={!service.enabled} type="button"
			title={service.name} aria-label={service.name} aria-current={service.active ? 'page' : undefined}
			onclick={() => activate(service.id)}>
			{#if service.favicon}
				<img src={service.favicon} alt="" width="24" height="24" />
			{:else}
				<span class="initials">{initials(service.name)}</span>
			{/if}
		</button>
	{/each}
	<button class="add" type="button" title={messages['rail.add']} aria-label={messages['rail.add']}>+</button>
</nav>

<style>
	.rail {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		padding: 10px 0;
		background-color: var(--rx-chrome);
		overflow-y: auto;
	}

	.service, .add {
		display: grid;
		place-items: center;
		height: 52px;
		border: 0;
		background: none;
		color: var(--rx-on-chrome);
		cursor: pointer;
	}

	.service:hover, .add:hover {
		background-color: var(--rx-hover-on-chrome);
	}

	.service.active {
		background-color: var(--rx-hover-on-chrome);
		box-shadow: inset 3px 0 0 0 var(--rx-on-chrome);
	}

	.service.disabled img, .service.disabled .initials {
		filter: grayscale(1);
		opacity: 0.6;
	}

	.initials {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 7px;
		background-color: var(--rx-muted);
		color: #FFFFFF;
		font-size: 12px;
		font-weight: 600;
	}

	.add {
		font-size: 22px;
		line-height: 1;
	}
</style>
