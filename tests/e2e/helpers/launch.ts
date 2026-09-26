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
export async function launchShep({ store }: { store?: Record<string, unknown> } = {}): Promise<Shep> {
	const userDataDir = mkdtempSync(join(tmpdir(), 'shep-next-test-'));
	if ( store ) writeFileSync(join(userDataDir, 'shep.json'), JSON.stringify(store));

	const app = await _electron.launch({
		// Every expectation here is written in English, and with no language of its own the app would
		// speak the desktop's: the suite passes on a Portuguese machine only because of this.
		args: [join(repoRoot, 'out', 'main', 'index.js'), `--user-data-dir=${userDataDir}`, '--lang=en-US'],
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

export function serviceRecord(id: string, url: string, overrides: Record<string, unknown> = {}) {
	return {
		id, name: 'Service ' + id, url, partition: `persist:service-${id}`, workspace: '', enabled: true,
		notifications: false, muted: true, media: false, trust: false, zoomLevel: 0, favicon: '', ...overrides
	};
}

// Runs in the page of the service whose address starts with urlPrefix. A navigation without
// userGesture is one Chromium's back button skips, as it does in Chrome.
export function inService<T>(shep: Shep, urlPrefix: string, expression: string, { userGesture = false } = {}): Promise<T> {
	return shep.app.evaluate(async ({ webContents }, { urlPrefix, expression, userGesture }) => {
		const contents = webContents.getAllWebContents().find(candidate => candidate.getURL().startsWith(urlPrefix));
		if ( !contents ) throw new Error('No page at ' + urlPrefix);
		return contents.executeJavaScript(expression, userGesture);
	}, { urlPrefix, expression, userGesture }) as Promise<T>;
}

// the modifier the app's own keys are on, Command on a Mac and Control elsewhere
export const COMMAND = process.platform === 'darwin' ? 'meta' : 'control';
