<script lang="ts">
	import type { Messages } from '../shared/i18n/index.ts';
	import type { ServiceRecord } from '../shared/service.ts';
	import { normalizeUrl } from '../shared/address.ts';
	import type { AppState } from '../shared/channels.ts';

	const { messages, serviceId, onclose }: { messages: Messages; serviceId: string | null; onclose: () => void } = $props();

	let address = $state('');
	let name = $state('');
	let workspace = $state('');
	let appNow = $state<AppState | null>(null);
	let touched = $state(false);
	let addressField = $state<HTMLInputElement>();

	const isValid = $derived(normalizeUrl(address) !== null);

	$effect(() => {
		addressField?.focus();
		window.shep.invoke('app:state').then(current => {
			appNow = current as AppState;
			if ( !serviceId ) workspace = appNow.activeWorkspace ?? '';
		});
		if ( !serviceId ) return;
		window.shep.invoke('services:record', serviceId).then(record => {
			const service = record as ServiceRecord | null;
			if ( !service ) return;
			address = service.url;
			name = service.name;
			workspace = service.workspace;
			addressField?.select();
		});
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		touched = true;
		if ( !isValid ) return;
		if ( serviceId ) await window.shep.invoke('services:update', serviceId, address, name, workspace);
		else await window.shep.invoke('services:add', address, name, workspace);
		onclose();
	}
</script>

<form class="dialog" aria-label={serviceId ? messages['dialog.edit.title'] : messages['dialog.add.title']} onsubmit={submit}>
	<h2>{serviceId ? messages['dialog.edit.title'] : messages['dialog.add.title']}</h2>

	<label>
		<span>{messages['dialog.address']}</span>
		<input bind:this={addressField} bind:value={address} name="address" type="text" inputmode="url" autocomplete="off" spellcheck="false"
			placeholder={messages['dialog.address.placeholder']} aria-invalid={touched && !isValid} />
		{#if touched && !isValid}<small role="alert">{messages['dialog.address.invalid']}</small>{/if}
	</label>

	<label>
		<span>{messages['dialog.name']}</span>
		<input bind:value={name} name="name" type="text" autocomplete="off" placeholder={messages['dialog.name.placeholder']} />
	</label>

	{#if appNow?.workspaces.length}
		<label>
			<span>{messages['dialog.workspace']}</span>
			<select bind:value={workspace} name="workspace">
				{#each appNow.workspaces as option (option.id)}<option value={option.id}>{option.name}</option>{/each}
				<option value="">{messages['dialog.workspace.every']}</option>
			</select>
		</label>
	{/if}

	<footer>
		<button type="button" class="secondary" onclick={onclose}>{messages['dialog.cancel']}</button>
		<button type="submit" class="primary">{serviceId ? messages['dialog.save'] : messages['dialog.add']}</button>
	</footer>
</form>
