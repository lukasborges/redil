<script lang="ts">
	// Symbolic, 16px, drawn in currentColor like GNOME's own.
	const PATHS = {
		back: 'M10 3 5 8l5 5',
		forward: 'm6 3 5 5-5 5',
		reload: 'M13 8a5 5 0 1 1-1.5-3.5M13 2v3h-3',
		find: 'M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM11 11l3 3',
		up: 'M3 10 8 5l5 5',
		down: 'M3 6l5 5 5-5',
		close: 'M4 4l8 8M12 4l-8 8',
		add: 'M8 3v10M3 8h10'
	} as const;

	const { name }: { name: keyof typeof PATHS } = $props();
</script>

<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
	<path d={PATHS[name]} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
</svg>
