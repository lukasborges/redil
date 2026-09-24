<script lang="ts">
	import type { Snippet } from 'svelte';

	const { title, hint = '', children }: { title: string; hint?: string; children: Snippet } = $props();
</script>

<div class="row">
	<div class="text">
		<span class="title">{title}</span>
		{#if hint}<span class="hint">{hint}</span>{/if}
	</div>
	<div class="control">{@render children()}</div>
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 52px;
		padding: 8px 14px;
	}

	.row + :global(.row) {
		border-top: 1px solid var(--rx-line);
	}

	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.title {
		font-size: 14px;
	}

	.hint {
		color: var(--rx-muted);
		font-size: 12px;
	}

	.control {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		gap: 8px;
	}
</style>
