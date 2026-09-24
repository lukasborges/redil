<script lang="ts">
	import type { Messages } from '../shared/i18n.ts';
	import type { ServiceRecord } from '../shared/service.ts';
	import { normalizeUrl } from '../shared/address.ts';

	const { messages, serviceId, onclose }: { messages: Messages; serviceId: string | null; onclose: () => void } = $props();

	let address = $state('');
	let name = $state('');
	let touched = $state(false);
	let addressField = $state<HTMLInputElement>();

	const isValid = $derived(normalizeUrl(address) !== null);

	$effect(() => {
		addressField?.focus();
		if ( !serviceId ) return;
		window.shep.invoke('services:record', serviceId).then(record => {
			const service = record as ServiceRecord | null;
			if ( !service ) return;
			address = service.url;
			name = service.name;
			addressField?.select();
		});
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		touched = true;
		if ( !isValid ) return;
		if ( serviceId ) await window.shep.invoke('services:update', serviceId, address, name);
		else await window.shep.invoke('services:add', address, name);
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

	<footer>
		<button type="button" class="secondary" onclick={onclose}>{messages['dialog.cancel']}</button>
		<button type="submit" class="primary">{serviceId ? messages['dialog.save'] : messages['dialog.add']}</button>
	</footer>
</form>

<style>
	.dialog {
		display: flex;
		flex-direction: column;
		gap: 14px;
		width: min(420px, calc(100vw - 32px));
		padding: 20px;
		border-radius: 12px;
		background-color: var(--rx-raised);
		color: var(--rx-ink);
		box-shadow: 0 0 0 1px var(--rx-line), 0 8px 32px var(--rx-shadow);
	}

	h2 {
		margin: 0 0 4px;
		font-size: 16px;
		font-weight: 700;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
	}

	input {
		height: 34px;
		padding: 0 10px;
		border: 1px solid var(--rx-line);
		border-radius: 8px;
		background-color: var(--rx-field);
		color: inherit;
		font: inherit;
		font-weight: 400;
		outline: none;
	}

	input:focus {
		border-color: var(--rx-accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--rx-accent) 25%, transparent);
	}

	input[aria-invalid='true'] {
		border-color: var(--rx-alert);
	}

	small {
		color: var(--rx-alert);
		font-weight: 400;
	}

	footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 6px;
	}

	footer button {
		height: 32px;
		padding: 0 16px;
		border: 0;
		border-radius: 8px;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.secondary {
		background-color: color-mix(in srgb, var(--rx-ink) 8%, transparent);
		color: inherit;
	}

	.primary {
		background-color: var(--rx-accent);
		color: var(--rx-on-accent);
	}
</style>
