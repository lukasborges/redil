<script lang="ts">
	import { messagesFor } from '../shared/i18n/index.ts';
	import type { AppState } from '../shared/channels.ts';
	import ServiceDialog from './ServiceDialog.svelte';
	import WorkspaceDialog from './WorkspaceDialog.svelte';
	import WorkspaceIconDialog from './WorkspaceIconDialog.svelte';
	import Preferences from './Preferences.svelte';
	import AboutDialog from './AboutDialog.svelte';
	import UnreadReport from './UnreadReport.svelte';
	import PasswordDialog from './PasswordDialog.svelte';
	import LockScreen from './LockScreen.svelte';
	import ScreenPicker from './ScreenPicker.svelte';

	type Shown =
		| { dialog: 'add' }
		| { dialog: 'edit'; serviceId: string }
		| { dialog: 'workspace'; workspaceId: string | null }
		| { dialog: 'workspaceIcon'; workspaceId: string }
		| { dialog: 'preferences' | 'about' | 'unreadReport' | 'lock' }
		| { dialog: 'lockPassword'; thenLock?: boolean }
		| { dialog: 'screenPicker'; sources: { id: string; name: string; thumbnail: string }[] };

	// neither is dismissed by Escape or a click beside it: the lock has to be unlocked, and the picker answered
	const isDismissible = (dialog: Shown) => dialog.dialog !== 'lock' && dialog.dialog !== 'screenPicker';

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

<svelte:window onkeydown={event => { if ( event.key === 'Escape' && shown && isDismissible(shown) ) close(); }} />

{#if shown}
	<div class="backdrop" role="presentation" onclick={event => { if ( event.target === event.currentTarget && shown && isDismissible(shown) ) close(); }}>
		{#key opening}
			{#if shown.dialog === 'workspace'}
				<WorkspaceDialog {messages} workspaceId={shown.workspaceId} onclose={close} />
			{:else if shown.dialog === 'workspaceIcon'}
				<WorkspaceIconDialog {messages} workspaceId={shown.workspaceId} onclose={close} />
			{:else if shown.dialog === 'preferences'}
				<Preferences {messages} onclose={close} onopen={openFromPreferences} />
			{:else if shown.dialog === 'about'}
				<AboutDialog {messages} onclose={close} />
			{:else if shown.dialog === 'unreadReport'}
				<UnreadReport {messages} onclose={close} />
			{:else if shown.dialog === 'lockPassword'}
				<PasswordDialog {messages} onclose={close} thenLock={shown.thenLock ?? false} />
			{:else if shown.dialog === 'lock'}
				<LockScreen {messages} />
			{:else if shown.dialog === 'screenPicker'}
				<ScreenPicker {messages} sources={shown.sources} />
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
