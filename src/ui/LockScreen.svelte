<script lang="ts">
	import type { Messages } from '../shared/i18n/index.ts';
	import mark from './lib/mark.svg';

	const { messages }: { messages: Messages } = $props();

	let password = $state('');
	let wrong = $state(false);
	let field = $state<HTMLInputElement>();

	$effect(() => { field?.focus(); });

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const unlocked = await window.shep.invoke('lock:unlock', password);
		wrong = unlocked !== true;
		if ( wrong ) {
			password = '';
			field?.focus();
		}
	}
</script>

<form class="lock" aria-label={messages['lock.title']} onsubmit={submit}>
	<img src={mark} alt="" width="112" height="112" />
	<h1>{messages['lock.title']}</h1>
	<input bind:this={field} bind:value={password} name="password" type="password" autocomplete="current-password"
		placeholder={messages['lock.password']} aria-label={messages['lock.password']} aria-invalid={wrong} />
	{#if wrong}<small role="alert">{messages['lock.wrong']}</small>{/if}
	<button type="submit" disabled={!password}>{messages['lock.unlock']}</button>
</form>

<style>
	.lock {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		background-color: var(--rx-chrome);
		color: var(--rx-on-chrome);
	}

	h1 {
		margin: 8px 0 6px;
		font-size: 20px;
		font-weight: 700;
	}

	input {
		width: 260px;
		height: 36px;
		padding: 0 12px;
		border: 0;
		border-radius: 8px;
		background-color: var(--rx-hover-on-chrome);
		color: inherit;
		font: inherit;
		text-align: center;
		outline: none;
	}

	input:focus {
		box-shadow: 0 0 0 2px var(--rx-on-chrome);
	}

	small {
		color: #FF9B9B;
	}

	button {
		height: 34px;
		padding: 0 22px;
		border: 0;
		border-radius: 8px;
		background-color: var(--rx-on-chrome);
		color: var(--rx-chrome);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
