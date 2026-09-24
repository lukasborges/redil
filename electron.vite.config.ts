import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	main: {
		build: {
			outDir: 'out/main',
			rollupOptions: { input: resolve('src/main/index.ts') }
		}
	},
	preload: {
		build: {
			outDir: 'out/preload',
			rollupOptions: { input: { ui: resolve('src/preload/ui.ts') } }
		}
	},
	renderer: {
		root: resolve('src/ui'),
		build: {
			outDir: resolve('out/ui'),
			rollupOptions: { input: resolve('src/ui/index.html') }
		},
		plugins: [svelte()]
	}
});
