<script lang="ts">
	import type { Messages } from '../shared/i18n.ts';
	import type { ServiceState } from '../shared/service.ts';
	import { services, appState, activate, openAddDialog, reorder, setDontDisturb, showServiceMenu } from './services.svelte.ts';
	import { initials } from './initials.ts';
	import Icon from './Icon.svelte';

	const { messages }: { messages: Messages } = $props();

	const MAX_SHOWN_COUNT = 99;

	let dragged = $state<string | null>(null);
	let preview = $state<ServiceState[] | null>(null);
	const shown = $derived(preview ?? services.list);

	function badge(service: ServiceState): string {
		if ( service.unread === '•' ) return '•';
		if ( service.unread <= 0 ) return '';
		return service.unread > MAX_SHOWN_COUNT ? MAX_SHOWN_COUNT + '+' : String(service.unread);
	}

	function dragOver(event: DragEvent, over: string) {
		if ( !dragged || dragged === over ) return;
		event.preventDefault();
		const list = [...(preview ?? services.list)];
		const from = list.findIndex(service => service.id === dragged);
		const to = list.findIndex(service => service.id === over);
		const [moved] = list.splice(from, 1);
		if ( moved ) list.splice(to, 0, moved);
		preview = list;
	}

	function drop() {
		if ( preview ) reorder(preview.map(service => service.id));
		dragged = null;
		preview = null;
	}
</script>

<nav class="rail" aria-label="Services">
	{#each shown as service (service.id)}
		<button class="service" class:active={service.active} class:disabled={!service.enabled} class:dragged={dragged === service.id}
			type="button" draggable="true" title={service.name} aria-label={service.name} aria-current={service.active ? 'page' : undefined}
			onclick={() => activate(service.id)}
			oncontextmenu={event => { event.preventDefault(); showServiceMenu(service.id); }}
			ondragstart={() => { dragged = service.id; }}
			ondragover={event => dragOver(event, service.id)}
			ondrop={drop}
			ondragend={drop}>
			<span class="icon">
				{#if service.favicon}
					<img src={service.favicon} alt="" width="24" height="24" draggable="false" />
				{:else}
					<span class="initials">{initials(service.name)}</span>
				{/if}
				{#if badge(service)}
					<span class="badge" class:dot={service.unread === '•'} aria-label="{service.unread} unread">{service.unread === '•' ? '' : badge(service)}</span>
				{/if}
			</span>
		</button>
	{/each}
	<button class="add" type="button" title={messages['rail.add']} aria-label={messages['rail.add']} onclick={openAddDialog}>
		<Icon name="add" />
	</button>

	<div class="foot">
		<button class="tool" class:on={appState.dontDisturb} type="button" aria-pressed={appState.dontDisturb}
			title={appState.dontDisturb ? messages['rail.dontDisturb.on'] : messages['rail.dontDisturb']} aria-label={messages['rail.dontDisturb']}
			onclick={() => setDontDisturb(!appState.dontDisturb)}>
			<Icon name={appState.dontDisturb ? 'bellOff' : 'bell'} />
		</button>
	</div>
</nav>

<style>
	.rail {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		padding: 10px 0;
		background-color: var(--rx-chrome);
		overflow-y: auto;
		scrollbar-width: none;
	}

	.service, .add {
		display: grid;
		place-items: center;
		flex: 0 0 52px;
		border: 0;
		background: none;
		color: var(--rx-on-chrome);
		cursor: pointer;
	}

	.service:hover, .add:hover {
		background-color: var(--rx-hover-on-chrome);
	}

	.service.active {
		background-color: var(--rx-hover-on-chrome);
		box-shadow: inset 3px 0 0 0 var(--rx-on-chrome);
	}

	.service.dragged {
		opacity: 0.4;
	}

	.icon {
		position: relative;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
	}

	.service:not(.active):not(:hover) .icon {
		opacity: 0.82;
	}

	.service.disabled .icon {
		filter: grayscale(1);
		opacity: 0.5;
	}

	.initials {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 7px;
		background-color: var(--rx-muted);
		color: #FFFFFF;
		font-size: 12px;
		font-weight: 600;
	}

	/* On the icon's corner, overlapping it by a few pixels as an app's badge does. */
	.badge {
		position: absolute;
		top: -6px;
		left: 20px;
		box-sizing: border-box;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 8px;
		background-color: var(--rx-alert);
		box-shadow: 0 0 0 2px var(--rx-chrome);
		color: #FFFFFF;
		font-size: 10px;
		font-weight: 700;
		line-height: 16px;
		text-align: center;
	}

	.foot {
		display: flex;
		flex-direction: column;
		margin-top: auto;
		padding-top: 8px;
	}

	.tool {
		display: grid;
		place-items: center;
		height: 40px;
		border: 0;
		background: none;
		color: var(--rx-on-chrome);
		cursor: pointer;
	}

	.tool:hover {
		background-color: var(--rx-hover-on-chrome);
	}

	/* Adwaita yellow 2 */
	.tool.on {
		color: #F8E45C;
	}

	.badge.dot {
		top: -2px;
		left: 22px;
		min-width: 10px;
		width: 10px;
		height: 10px;
		padding: 0;
	}
</style>
