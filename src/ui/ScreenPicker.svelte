<script lang="ts">
	import type { Messages } from '../shared/i18n.ts';

	type Source = { id: string; name: string; thumbnail: string };
	const { messages, sources }: { messages: Messages; sources: Source[] } = $props();

	let chosen = $derived<string | null>(sources[0]?.id ?? null);

	const answer = (id: string | null) => window.shep.invoke('screenShare:pick', id);
</script>

<div class="dialog picker" role="dialog" aria-label={messages['share.title']}>
	<h2>{messages['share.title']}</h2>
	<p>{messages['share.body']}</p>
	<div class="sources" role="radiogroup" aria-label={messages['share.title']}>
		{#each sources as source (source.id)}
			<button type="button" role="radio" aria-checked={chosen === source.id} class:chosen={chosen === source.id}
				onclick={() => { chosen = source.id; }} ondblclick={() => answer(source.id)}>
				<img src={source.thumbnail} alt="" />
				<span>{source.name}</span>
			</button>
		{/each}
	</div>
	<footer>
		<button type="button" class="secondary" onclick={() => answer(null)}>{messages['share.cancel']}</button>
		<button type="button" class="primary" disabled={!chosen} onclick={() => answer(chosen)}>{messages['share.share']}</button>
	</footer>
</div>

<style>
	.picker {
		width: min(720px, calc(100vw - 32px));
	}

	p {
		margin: 0;
		color: var(--rx-muted);
	}

	.sources {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 10px;
		max-height: 50vh;
		overflow-y: auto;
	}

	.sources button {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px;
		border: 2px solid transparent;
		border-radius: 10px;
		background-color: color-mix(in srgb, var(--rx-ink) 5%, transparent);
		color: inherit;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}

	.sources button.chosen {
		border-color: var(--rx-accent);
	}

	.sources img {
		width: 100%;
		aspect-ratio: 16 / 9;
		object-fit: contain;
		background-color: #000000;
		border-radius: 6px;
	}

	.sources span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
