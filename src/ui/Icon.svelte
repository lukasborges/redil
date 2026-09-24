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
		add: 'M8 3v10M3 8h10',
		bell: 'M4 11V7a4 4 0 0 1 8 0v4l1 1H3l1-1ZM6.5 13.5a1.5 1.5 0 0 0 3 0',
		lock: 'M4.5 7V5a3.5 3.5 0 0 1 7 0v2M3.5 7h9v6.5h-9Z',
		gear: 'M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4',
		bellOff: 'M4 11V7a4 4 0 0 1 8 0v4l1 1H3l1-1ZM6.5 13.5a1.5 1.5 0 0 0 3 0M2 2l12 12'
	} as const;

	const { name }: { name: keyof typeof PATHS } = $props();
</script>

<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
	<path d={PATHS[name]} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
</svg>
