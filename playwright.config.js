const { defineConfig } = require('@playwright/test');

// Spectron, which drove these tests until it was abandoned in 2022, is replaced
// by Playwright's Electron support. There are no browsers to install: the suite
// launches this app and nothing else.
module.exports = defineConfig({
	 testDir: './test'
	,testMatch: '**/*.spec.js'
	// Electron windows are real windows. Running files in parallel means several
	// instances fighting over the display, so the suite runs one at a time.
	,workers: 1
	,fullyParallel: false
	,timeout: 60000
	,reporter: process.env.CI ? 'list' : [['list']]
	,forbidOnly: !!process.env.CI
	,retries: process.env.CI ? 1 : 0
});
