const { test, expect } = require('@playwright/test');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { _electron } = require('playwright');
const { repoRoot } = require('./helpers/launch');

test.skip(process.platform !== 'linux', 'appData follows XDG_CONFIG_HOME on Linux only');

function pastaComRedil() {
	const appData = fs.mkdtempSync(path.join(os.tmpdir(), 'shep-rename-'));
	fs.mkdirSync(path.join(appData, 'Redil'));
	fs.writeFileSync(path.join(appData, 'Redil', 'config.json'), JSON.stringify({ theme: 'dark', default_service: 'redilTab' }));
	return appData;
}

async function abrirSemUserDataDir(appData, args = []) {
	const app = await _electron.launch({
		args: [repoRoot, ...args], // not electron/main.js, or Electron never reads package.json and names itself Electron
		cwd: repoRoot,
		env: { ...process.env, XDG_CONFIG_HOME: appData }
	});
	await esperarMainJsRodar(app);
	return app;
}

async function esperarMainJsRodar(app) {
	await app.evaluate(({ app }) => app.getPath('userData'));
}

test('moves the Redil folder to Shep on the first launch, configuration and all', async () => {
	const appData = pastaComRedil();
	const app = await abrirSemUserDataDir(appData);
	try {
		expect(fs.existsSync(path.join(appData, 'Redil'))).toBe(false);
		const config = JSON.parse(fs.readFileSync(path.join(appData, 'Shep', 'config.json'), 'utf8'));
		expect(config.theme).toBe('dark');
		expect(config.default_service).toBe('shepTab');
	} finally {
		await app.close();
		fs.rmSync(appData, { recursive: true, force: true });
	}
});

test('leaves the Redil folder alone when a user data folder was asked for', async () => {
	const appData = pastaComRedil();
	const propria = path.join(appData, 'own');
	const app = await abrirSemUserDataDir(appData, [`--user-data-dir=${propria}`]);
	try {
		expect(fs.existsSync(path.join(appData, 'Redil', 'config.json'))).toBe(true);
		expect(fs.existsSync(path.join(appData, 'Shep'))).toBe(false);
	} finally {
		await app.close();
		fs.rmSync(appData, { recursive: true, force: true });
	}
});
