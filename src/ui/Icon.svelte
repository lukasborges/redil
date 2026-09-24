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
		gear: 'M13.14 6.33L15.03 6.46L15.03 9.54L13.14 9.67L12.81 10.45L14.06 11.88L11.88 14.06L10.45 12.81L9.67 13.14L9.54 15.03L6.46 15.03L6.33 13.14L5.55 12.81L4.12 14.06L1.94 11.88L3.19 10.45L2.86 9.67L0.97 9.54L0.97 6.46L2.86 6.33L3.19 5.55L1.94 4.12L4.12 1.94L5.55 3.19L6.33 2.86L6.46 0.97L9.54 0.97L9.67 2.86L10.45 3.19L11.88 1.94L14.06 4.12L12.81 5.55ZM10.4 8a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0Z',
		bellOff: 'M4 11V7a4 4 0 0 1 8 0v4l1 1H3l1-1ZM6.5 13.5a1.5 1.5 0 0 0 3 0M2 2l12 12'
	} as const;

	const { name }: { name: keyof typeof PATHS } = $props();
</script>

<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
	<path d={PATHS[name]} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
</svg>
