<script lang="ts">
	import { messagesFor } from '../shared/i18n.ts';
	import type { AppState } from '../shared/channels.ts';
	import ServiceDialog from './ServiceDialog.svelte';
	import WorkspaceDialog from './WorkspaceDialog.svelte';
	import Preferences from './Preferences.svelte';
	import AboutDialog from './AboutDialog.svelte';
	import UnreadReport from './UnreadReport.svelte';
	import PasswordDialog from './PasswordDialog.svelte';

	type Shown =
		| { dialog: 'add' }
		| { dialog: 'edit'; serviceId: string }
		| { dialog: 'workspace'; workspaceId: string | null }
		| { dialog: 'preferences' | 'about' | 'unreadReport' | 'lockPassword' };

	let language = $state(window.shep.locale);
	const messages = $derived(messagesFor(language));
	let shown = $state<Shown | null>(null);
	// a dialog opened from Preferences goes back to it
	let returnTo = $state<Shown | null>(null);
	let opening = $state(0);

	window.shep.invoke('app:state').then(state => { language = (state as AppState).language; });
	window.shep.on('app:state', state => { language = (state as AppState).language; });
	window.shep.on('overlay:show', dialog => {
		shown = dialog as Shown;
		returnTo = null;
		opening++;
	});

	function close() {
		if ( returnTo ) {
			shown = returnTo;
			returnTo = null;
			opening++;
			return;
		}
		shown = null;
		window.shep.invoke('overlay:close');
	}

	function openFromPreferences(dialog: 'about' | 'unreadReport' | 'lockPassword') {
		returnTo = { dialog: 'preferences' };
		shown = { dialog };
		opening++;
	}
</script>

<svelte:window onkeydown={event => { if ( event.key === 'Escape' && shown ) close(); }} />

{#if shown}
	<div class="backdrop" role="presentation" onclick={event => { if ( event.target === event.currentTarget ) close(); }}>
		{#key opening}
			{#if shown.dialog === 'workspace'}
				<WorkspaceDialog {messages} workspaceId={shown.workspaceId} onclose={close} />
			{:else if shown.dialog === 'preferences'}
				<Preferences {messages} onclose={close} onopen={openFromPreferences} />
			{:else if shown.dialog === 'about'}
				<AboutDialog {messages} onclose={close} />
			{:else if shown.dialog === 'unreadReport'}
				<UnreadReport {messages} onclose={close} />
			{:else if shown.dialog === 'lockPassword'}
				<PasswordDialog {messages} onclose={close} />
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
