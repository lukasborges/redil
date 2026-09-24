import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { launchShep, closeShep, repoRoot, type Shep } from './helpers/launch.ts';

let shep: Shep;

test.beforeAll(async () => { shep = await launchShep(); });
test.afterAll(async () => { await closeShep(shep); });

test('opens one window titled Shep, with the welcome page', async () => {
	expect(shep.app.windows()).toHaveLength(1);
	expect(await shep.window.title()).toBe('Shep');
	await expect(shep.window.locator('.welcome h1')).toHaveText('Welcome to Shep');
});

test('names itself Shep and reports the version in package.json, not Electron\'s', async () => {
	const { version } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { version: string };
	expect(await shep.app.evaluate(({ app }) => app.getName())).toBe('Shep');
	expect(await shep.window.evaluate(() => window.shep.invoke('app:getVersion'))).toBe(version);
});

test('runs the renderer isolated, without node', async () => {
	const reach = await shep.window.evaluate(() => ({
		require: typeof (window as unknown as { require?: unknown }).require,
		process: typeof (window as unknown as { process?: unknown }).process
	}));
	expect(reach).toEqual({ require: 'undefined', process: 'undefined' });
});

test('refuses a channel the preload does not expose', async () => {
	const refused = await shep.window.evaluate(async () => {
		try {
			await window.shep.invoke('app:quit' as never);
			return 'called';
		} catch ( error ) {
			return String(error);
		}
	});
	expect(refused).toContain('not exposed to the renderer: app:quit');
});

test('uses the profile it was given, not the developer\'s', async () => {
	expect(await shep.app.evaluate(({ app }) => app.getPath('userData'))).toBe(shep.userDataDir);
});
