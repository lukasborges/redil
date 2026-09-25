<script lang="ts">
	import type { Messages } from '../shared/i18n/index.ts';
	import { WORKSPACE_ICONS, hueOf, type Workspace, type WorkspaceIcon } from '../shared/workspace.ts';
	import WorkspaceAvatar from './WorkspaceAvatar.svelte';

	const { messages, workspaceId, onclose }: { messages: Messages; workspaceId: string; onclose: () => void } = $props();

	let workspace = $state<Workspace | null>(null);
	$effect(() => { window.shep.invoke('workspaces:get', workspaceId).then(found => { workspace = found as Workspace | null; }); });

	async function choose(icon: WorkspaceIcon | null) {
		await window.shep.invoke('workspaces:setIcon', workspaceId, icon);
		onclose();
	}
</script>

<div class="dialog icons" role="dialog" aria-label={messages['dialog.workspaceIcon.title']}>
	<h2>{messages['dialog.workspaceIcon.title']}</h2>
	{#if workspace}
		<div class="grid" role="radiogroup" aria-label={messages['dialog.workspaceIcon.title']}>
			<button type="button" role="radio" aria-checked={!workspace.icon} aria-label={messages['dialog.workspaceIcon.initials']} title={messages['dialog.workspaceIcon.initials']} onclick={() => choose(null)}>
				<WorkspaceAvatar name={workspace.name} hue={workspace.hue} size={40} />
			</button>
			{#each WORKSPACE_ICONS as icon (icon)}
				<button type="button" role="radio" aria-checked={workspace.icon === icon} aria-label={icon} title={icon} onclick={() => choose(icon)}>
					<WorkspaceAvatar name={workspace.name} hue={hueOf(icon)} {icon} size={40} />
				</button>
			{/each}
		</div>
	{/if}
	<footer><button type="button" class="secondary" onclick={onclose}>{messages['dialog.cancel']}</button></footer>
</div>

<style>
	.icons {
		width: auto;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(6, 48px);
		gap: 8px;
	}

	.grid button {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		padding: 0;
		border: 2px solid transparent;
		border-radius: 12px;
		background: none;
		cursor: pointer;
	}

	.grid button:hover {
		background-color: color-mix(in srgb, var(--rx-ink) 6%, transparent);
	}

	.grid button[aria-checked='true'] {
		border-color: var(--rx-accent);
	}
</style>
