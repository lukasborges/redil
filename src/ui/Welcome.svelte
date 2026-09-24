<script lang="ts">
	import type { Messages } from '../shared/i18n.ts';
	import logo from './lib/logo.svg';

	const { messages }: { messages: Messages } = $props();
</script>

<section class="welcome">
	<img src={logo} alt="" width="96" height="96" />
	<h1>{messages['welcome.title']}</h1>
	<p>{messages['welcome.body']}</p>
</section>

<style>
	.welcome {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		text-align: center;
	}

	h1 {
		margin: 16px 0 6px;
		font-size: 22px;
		font-weight: 700;
	}

	p {
		margin: 0;
		color: var(--rx-muted);
	}
</style>
