import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron, type ElectronApplication, type Page } from 'playwright';

export const repoRoot = resolve(__dirname, '..', '..', '..');

export interface Shep {
	app: ElectronApplication;
	window: Page;
	userDataDir: string;
}

// A profile of its own per launch, or the run would read the developer's services and talk to the network.
export async function launchShep({ config }: { config?: Record<string, unknown> } = {}): Promise<Shep> {
	const userDataDir = mkdtempSync(join(tmpdir(), 'shep-next-test-'));
	if ( config ) writeFileSync(join(userDataDir, 'config.json'), JSON.stringify(config));

	const app = await _electron.launch({
		args: [join(repoRoot, 'out', 'main', 'index.js'), `--user-data-dir=${userDataDir}`],
		cwd: repoRoot,
		// Playwright emulates a light prefers-color-scheme unless told not to, which races the app's own theme
		colorScheme: null
	});
	const window = await app.firstWindow();
	await window.waitForSelector('.shell');
	return { app, window, userDataDir };
}

export async function closeShep(shep: Shep | undefined): Promise<void> {
	if ( !shep ) return;
	await shep.app.close();
	rmSync(shep.userDataDir, { recursive: true, force: true });
}
