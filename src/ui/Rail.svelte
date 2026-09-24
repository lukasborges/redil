<script lang="ts">
	import type { Messages } from '../shared/i18n.ts';

	const { messages }: { messages: Messages } = $props();
</script>

<nav class="rail" aria-label="Services">
	<button class="add" type="button" title={messages['rail.add']} aria-label={messages['rail.add']}>+</button>
</nav>

<style>
	.rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 10px 0;
		background-color: var(--rx-chrome);
	}

	.add {
		width: 40px;
		height: 40px;
		border: 0;
		border-radius: var(--rx-radius);
		background: none;
		color: var(--rx-on-chrome);
		font-size: 22px;
		line-height: 1;
		cursor: pointer;
	}

	.add:hover {
		background-color: var(--rx-hover-on-chrome);
	}
</style>
