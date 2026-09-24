<script lang="ts">
	const { checked, label, onchange }: { checked: boolean; label: string; onchange: (checked: boolean) => void } = $props();
</script>

<button class="switch" type="button" role="switch" aria-checked={checked} aria-label={label} onclick={() => onchange(!checked)}>
	<span class="knob"></span>
</button>

<style>
	.switch {
		position: relative;
		flex: 0 0 auto;
		width: 44px;
		height: 24px;
		padding: 0;
		border: 0;
		border-radius: 12px;
		background-color: color-mix(in srgb, var(--rx-ink) 22%, transparent);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.switch[aria-checked='true'] {
		background-color: var(--rx-accent);
	}

	.knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background-color: #FFFFFF;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
		transition: transform 0.15s ease;
	}

	.switch[aria-checked='true'] .knob {
		transform: translateX(20px);
	}
</style>
