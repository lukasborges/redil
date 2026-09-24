<script lang="ts">
	const { name = 'Shep' }: { name?: string } = $props();
</script>

<header class="titlebar">
	<span class="identity"><b>{name}</b></span>
</header>

<style>
	.titlebar {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--rx-chrome);
		color: var(--rx-on-chrome);
		/* the window buttons the system paints over one end */
		padding-left: env(titlebar-area-x, 0);
		padding-right: calc(100vw - env(titlebar-area-x, 0) - env(titlebar-area-width, 100vw));
		-webkit-app-region: drag;
		user-select: none;
		font-size: 13px;
	}
</style>
