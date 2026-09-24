<script lang="ts">
	import type { Messages } from '../shared/i18n/index.ts';
	import type { UnreadCount } from '../shared/service.ts';

	const { messages, onclose }: { messages: Messages; onclose: () => void } = $props();

	let rows = $state<{ name: string; pageTitle: string; unread: UnreadCount }[]>([]);
	$effect(() => { window.shep.invoke('services:report').then(value => { rows = value as typeof rows; }); });
</script>

<div class="dialog report" role="dialog" aria-label={messages['report.title']}>
	<h2>{messages['report.title']}</h2>
	<p>{messages['report.body']}</p>
	{#if rows.length}
		<table>
			<thead><tr><th>{messages['report.service']}</th><th>{messages['report.pageTitle']}</th><th>{messages['report.count']}</th></tr></thead>
			<tbody>
				{#each rows as row, index (index)}
					<tr><td>{row.name}</td><td class="title">{row.pageTitle || '—'}</td><td>{row.unread}</td></tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<p>{messages['report.empty']}</p>
	{/if}
	<footer><button type="button" class="primary" onclick={onclose}>{messages['dialog.close']}</button></footer>
</div>

<style>
	.report {
		width: min(620px, calc(100vw - 32px));
	}

	p {
		margin: 0;
		color: var(--rx-muted);
		font-size: 13px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
		table-layout: fixed;
	}

	th, td {
		padding: 6px 8px;
		border-bottom: 1px solid var(--rx-line);
		text-align: left;
	}

	th:last-child, td:last-child {
		width: 60px;
	}

	.title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--rx-muted);
	}
</style>
