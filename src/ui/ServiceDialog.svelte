<script lang="ts">
	import type { Messages } from '../shared/i18n/index.ts';
	import type { ServiceRecord } from '../shared/service.ts';
	import { normalizeUrl } from '../shared/address.ts';
	import type { AppState } from '../shared/channels.ts';
	import { CATALOGUE, CATALOGUE_GROUPS, matchCatalogue, type CatalogueEntry } from '../shared/catalogue.ts';
	import { initials } from './initials.ts';

	const { messages, serviceId, onclose }: { messages: Messages; serviceId: string | null; onclose: () => void } = $props();

	let address = $state('');
	let name = $state('');
	let workspace = $state('');
	let appNow = $state<AppState | null>(null);
	let touched = $state(false);
	let addressField = $state<HTMLInputElement>();

	const isValid = $derived(normalizeUrl(address) !== null);

	const isAdding = $derived(serviceId === null);
	let form = $state<HTMLFormElement>();
	const icons = $state<Record<string, string>>({});
	const catalogueGroups = $derived.by(() => {
		if ( !isAdding ) return [];
		const matches = matchCatalogue(address);
		return CATALOGUE_GROUPS.map(group => ({ group, entries: matches.filter(entry => entry.group === group) })).filter(({ entries }) => entries.length);
	});

	$effect(() => {
		if ( !isAdding ) return;
		for ( const { url } of CATALOGUE ) {
			window.shep.invoke('catalogue:icon', url).then(icon => { if ( typeof icon === 'string' ) icons[url] = icon; });
		}
	});

	function pick(entry: CatalogueEntry) {
		address = entry.url;
		name = entry.name;
	}

	function pickAndAdd(entry: CatalogueEntry) {
		pick(entry);
		form?.requestSubmit();
	}

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

<form bind:this={form} class="dialog" class:adding={isAdding} aria-label={serviceId ? messages['dialog.edit.title'] : messages['dialog.add.title']} onsubmit={submit}>
	<h2>{serviceId ? messages['dialog.edit.title'] : messages['dialog.add.title']}</h2>

	<label>
		<span>{messages['dialog.address']}</span>
		<input bind:this={addressField} bind:value={address} name="address" type="text" inputmode="url" autocomplete="off" spellcheck="false"
			placeholder={isAdding ? messages['dialog.address.search'] : messages['dialog.address.placeholder']} aria-invalid={touched && !isValid} />
		{#if touched && !isValid}<small role="alert">{messages['dialog.address.invalid']}</small>{/if}
	</label>

	{#if catalogueGroups.length}
		<div class="catalogue" role="group" aria-label={messages['dialog.catalogue']}>
			{#each catalogueGroups as { group, entries } (group)}
				<h3>{messages[`dialog.catalogue.${group}`]}</h3>
				<div class="entries">
					{#each entries as entry (entry.url)}
						<button type="button" class="entry" title={entry.name} aria-pressed={address === entry.url} onclick={() => pick(entry)} ondblclick={() => pickAndAdd(entry)}>
							{#if icons[entry.url]}
								<img src={icons[entry.url]} alt="" width="24" height="24" />
							{:else}
								<span class="initials" aria-hidden="true">{initials(entry.name)}</span>
							{/if}
							<span class="name">{entry.name}</span>
						</button>
					{/each}
				</div>
			{/each}
		</div>
	{/if}

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

<style>
	.dialog.adding {
		width: min(560px, calc(100vw - 32px));
	}

	.catalogue {
		max-height: min(280px, calc(100vh - 360px));
		margin: -4px -6px 0;
		padding: 0 6px;
		overflow-y: auto;
	}

	h3 {
		margin: 10px 0 6px;
		color: var(--rx-muted);
		font-size: 12px;
		font-weight: 600;
	}

	h3:first-child {
		margin-top: 0;
	}

	.entries {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 4px;
	}

	.entry {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		min-width: 0;
		padding: 10px 4px 8px;
		border: 0;
		border-radius: 8px;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.entry:hover {
		background-color: color-mix(in srgb, var(--rx-ink) 6%, transparent);
	}

	.entry[aria-pressed='true'] {
		background-color: color-mix(in srgb, var(--rx-accent) 18%, transparent);
	}

	.entry img, .initials {
		width: 24px;
		height: 24px;
		border-radius: 6px;
		object-fit: contain;
	}

	.initials {
		display: grid;
		place-items: center;
		background-color: color-mix(in srgb, var(--rx-ink) 10%, transparent);
		font-size: 10px;
		font-weight: 700;
	}

	.name {
		max-width: 100%;
		overflow: hidden;
		font-size: 12px;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
