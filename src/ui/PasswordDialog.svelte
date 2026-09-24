<script lang="ts">
	import type { Messages } from '../shared/i18n.ts';

	const { messages, onclose, thenLock = false }: { messages: Messages; onclose: () => void; thenLock?: boolean } = $props();

	let password = $state('');
	let repeated = $state('');
	let hasOne = $state(false);
	let field = $state<HTMLInputElement>();
	const matches = $derived(password !== '' && password === repeated);

	$effect(() => {
		field?.focus();
		window.shep.invoke('lock:hasPassword').then(value => { hasOne = value === true; });
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if ( !matches ) return;
		await window.shep.invoke('lock:setPassword', password, thenLock);
		if ( !thenLock ) onclose();
	}

	async function remove() {
		await window.shep.invoke('lock:setPassword', '');
		onclose();
	}
</script>

<form class="dialog" aria-label={messages['password.title']} onsubmit={submit}>
	<h2>{messages['password.title']}</h2>
	<label><span>{messages['password.new']}</span><input bind:this={field} bind:value={password} name="password" type="password" autocomplete="new-password" /></label>
	<label>
		<span>{messages['password.repeat']}</span>
		<input bind:value={repeated} name="repeated" type="password" autocomplete="new-password" aria-invalid={repeated !== '' && !matches} />
		{#if repeated !== '' && !matches}<small role="alert">{messages['password.mismatch']}</small>{/if}
	</label>
	<footer>
		{#if hasOne}<button type="button" class="secondary remove" onclick={remove}>{messages['password.remove']}</button>{/if}
		<button type="button" class="secondary" onclick={onclose}>{messages['dialog.cancel']}</button>
		<button type="submit" class="primary" disabled={!matches}>{messages['dialog.save']}</button>
	</footer>
</form>

<style>
	.remove {
		margin-right: auto;
	}
</style>
