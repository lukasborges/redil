import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: '**/*.spec.ts',
	// Electron windows are real windows, and several at once fight over the display.
	workers: 1,
	fullyParallel: false,
	timeout: 60000,
	reporter: 'list',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0
});
