const os = require('os');
const path = require('path');
const fs = require('fs');
const { _electron } = require('playwright');

const repoRoot = path.resolve(__dirname, '..', '..');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Running unpacked makes isDev true, so main.js opens the DevTools and the app
// has two windows. Which one firstWindow() returns is a race, so the app window
// is found by its URL instead. A window reports about:blank until it navigates,
// hence the polling rather than a single look.
async function findAppWindow(app, timeout) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const found = app.windows().find(window => window.url().includes('index.html'));
		if (found) return found;
		await sleep(100);
	}
	throw new Error('The window loading index.html never appeared; windows were: '
		+ JSON.stringify(app.windows().map(window => window.url())));
}

// Every launch gets its own userData directory. Without it a test run reads the
// developer's own configuration, opens whatever services they have configured
// and talks to the network, so what the suite asserts depends on the machine it
// runs on. Electron reads --user-data-dir itself; main.js is not involved.
async function launchRedil(extraArgs = []) {
	const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'redil-test-'));

	const app = await _electron.launch({
		args: [path.join(repoRoot, 'electron', 'main.js'), `--user-data-dir=${userDataDir}`, ...extraArgs],
		cwd: repoRoot
	});

	const window = await findAppWindow(app, 30000);
	// The Ext application boots from the generated bootstrap.js, so the document
	// is there well before the viewport is.
	await window.waitForFunction(
		() => typeof Ext !== 'undefined' && Ext.ComponentQuery.query('app-main').length > 0,
		null,
		{ timeout: 30000 }
	);

	return { app, window, userDataDir };
}

async function closeRedil(context) {
	if (!context) return;
	await context.app.close();
	fs.rmSync(context.userDataDir, { recursive: true, force: true });
}

module.exports = { launchRedil, closeRedil, repoRoot };
