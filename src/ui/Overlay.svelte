<script lang="ts">
	import { messagesFor } from '../shared/i18n.ts';
	import ServiceDialog from './ServiceDialog.svelte';
	import WorkspaceDialog from './WorkspaceDialog.svelte';

	type Shown = { dialog: 'add' } | { dialog: 'edit'; serviceId: string } | { dialog: 'workspace'; workspaceId: string | null };

	const messages = messagesFor(window.shep.locale);
	let shown = $state<Shown | null>(null);
	let opening = $state(0);

	window.shep.on('overlay:show', dialog => {
		shown = dialog as Shown;
		opening++;
	});

	function close() {
		shown = null;
		window.shep.invoke('overlay:close');
	}
</script>

<svelte:window onkeydown={event => { if ( event.key === 'Escape' && shown ) close(); }} />

{#if shown}
	<div class="backdrop" role="presentation" onclick={event => { if ( event.target === event.currentTarget ) close(); }}>
		{#key opening}
			{#if shown.dialog === 'workspace'}
				<WorkspaceDialog {messages} workspaceId={shown.workspaceId} onclose={close} />
			{:else}
				<ServiceDialog {messages} serviceId={shown.dialog === 'edit' ? shown.serviceId : null} onclose={close} />
			{/if}
		{/key}
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background-color: var(--rx-backdrop);
	}
</style>
