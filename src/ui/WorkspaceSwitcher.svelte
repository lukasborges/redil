<script lang="ts">
	import type { Messages } from '../shared/i18n/index.ts';
	import { appState, showWorkspaceMenu } from './services.svelte.ts';
	import WorkspaceAvatar from './WorkspaceAvatar.svelte';

	const { messages }: { messages: Messages } = $props();

	const active = $derived(appState.workspaces.find(workspace => workspace.id === appState.activeWorkspace));
	const label = $derived(active ? active.name : messages['rail.allServices']);
</script>

<button class="switcher" type="button" title={label} aria-label="{messages['rail.workspaces']}: {label}" onclick={showWorkspaceMenu}>
	{#if active}
		<WorkspaceAvatar name={active.name} hue={active.hue} icon={active.icon ?? null} onRail />
	{:else}
		<svg class="all" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
			<rect x="8" y="8" width="6" height="6" rx="1.5" /><rect x="16" y="8" width="6" height="6" rx="1.5" />
			<rect x="8" y="16" width="6" height="6" rx="1.5" /><rect x="16" y="16" width="6" height="6" rx="1.5" />
		</svg>
	{/if}
	{#if appState.unreadElsewhere}<span class="dot" title={messages['rail.unreadElsewhere']}></span>{/if}
</button>

<style>
	.switcher {
		position: relative;
		display: grid;
		place-items: center;
		flex: 0 0 52px;
		margin-bottom: 6px;
		border: 0;
		border-bottom: 1px solid var(--rx-hover-on-chrome);
		background: none;
		cursor: pointer;
	}

	.all {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 9px;
		background-color: var(--rx-hover-on-chrome);
		fill: var(--rx-on-chrome);
	}

	.switcher:hover :global(.avatar), .switcher:hover .all {
		filter: brightness(1.15);
	}

	.dot {
		position: absolute;
		top: 8px;
		left: calc(50% + 12px);
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background-color: var(--rx-alert);
		box-shadow: 0 0 0 2px var(--rx-chrome);
	}
</style>
