<script lang="ts">
	import type { WorkspaceHue, WorkspaceIcon } from '../shared/workspace.ts';
	import { WORKSPACE_ICON_NODES } from './workspaceIcons.ts';
	import { initials } from './initials.ts';

	const { name, hue, icon = null, size = 34, onRail = false }: { name: string; hue: WorkspaceHue; icon?: WorkspaceIcon | null; size?: number; onRail?: boolean } = $props();

	const glyph = $derived(Math.round(size * 0.55));
</script>

<span class="avatar" style:width="{size}px" style:height="{size}px" style:--hue="var(--rx-{onRail ? 'rail-' : ''}hue-{hue})" style:--tint="var(--rx-tint-{hue})">
	{#if icon}
		<svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			{#each WORKSPACE_ICON_NODES[icon] as [tag, attributes], index (index)}
				<svelte:element this={tag} {...attributes} />
			{/each}
		</svg>
	{:else}
		<span class="initials" style:font-size="{Math.round(size * 0.36)}px">{initials(name)}</span>
	{/if}
</span>

<style>
	.avatar {
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		border-radius: 27%;
		background-color: var(--tint);
		color: var(--hue);
	}

	.initials {
		font-weight: 700;
	}
</style>
