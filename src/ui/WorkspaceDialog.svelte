<script lang="ts">
	import type { Messages } from '../shared/i18n.ts';
	import type { Workspace } from '../shared/workspace.ts';

	const { messages, workspaceId, onclose }: { messages: Messages; workspaceId: string | null; onclose: () => void } = $props();

	let name = $state('');
	let field = $state<HTMLInputElement>();
	const title = $derived(workspaceId ? messages['dialog.renameWorkspace.title'] : messages['dialog.newWorkspace.title']);

	$effect(() => {
		field?.focus();
		if ( !workspaceId ) return;
		window.shep.invoke('workspaces:get', workspaceId).then(found => {
			name = (found as Workspace | null)?.name ?? '';
			field?.select();
		});
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if ( !name.trim() ) return;
		await window.shep.invoke('workspaces:save', workspaceId, name);
		onclose();
	}
</script>

<form class="dialog" aria-label={title} onsubmit={submit}>
	<h2>{title}</h2>
	<label>
		<span>{messages['dialog.name']}</span>
		<input bind:this={field} bind:value={name} name="name" type="text" autocomplete="off" placeholder={messages['dialog.workspaceName.placeholder']} />
	</label>
	<footer>
		<button type="button" class="secondary" onclick={onclose}>{messages['dialog.cancel']}</button>
		<button type="submit" class="primary" disabled={!name.trim()}>{workspaceId ? messages['dialog.save'] : messages['dialog.add']}</button>
	</footer>
</form>
