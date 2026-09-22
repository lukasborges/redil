const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { launchRedil, closeRedil } = require('./helpers/launch');

// The lock window only opens when a master password is set, so it needs its own
// launch. main.js stores the password as an md5 hash of what was typed, and does
// not create the main window at all until the lock is cleared.
const PASSWORD = 'a-password-only-this-test-knows';
const hashed = crypto.createHash('md5').update(PASSWORD).digest('hex');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function windowMatching(app, fragment, timeout = 20000) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const found = app.windows().find(window => window.url().includes(fragment));
		if (found) return found;
		await sleep(100);
	}
	return null;
}

let redil;
let lockWindow;

test.beforeAll(async () => {
	redil = await launchRedil({ config: { master_password: hashed }, waitForApp: false });
	lockWindow = await windowMatching(redil.app, 'masterpassword.html');
	expect(lockWindow, 'the lock window never opened').not.toBeNull();
});

test.afterAll(async () => { await closeRedil(redil); });

test('opens the lock window with no node of its own', async () => {
	const reach = await lockWindow.evaluate(() => ({ require: typeof require, bridge: typeof window.redil }));
	expect(reach).toEqual({ require: 'undefined', bridge: 'object' });
});

test('starts with no application window behind the lock', async () => {
	expect(redil.app.windows().some(window => window.url().includes('index.html'))).toBe(false);
});

test('refuses the wrong password and stays locked', async () => {
	// The handler assigns event.returnValue twice and reads as though it always
	// answers false. Electron replies on the first assignment, so it does not.
	expect(await lockWindow.evaluate(() => redil.ipc.sendSync('validateMasterPassword', 'not-it'))).toBe(false);
	expect(lockWindow.isClosed()).toBe(false);
});

// Last, because clearing the lock is what the rest of the file depends on not
// having happened yet.
test('clears the lock for the right password and opens the app', async () => {
	// The reply races with the window being destroyed, so the effect is what is
	// asserted rather than the return value.
	await lockWindow
		.evaluate(password => redil.ipc.sendSync('validateMasterPassword', password), PASSWORD)
		.catch(() => {});

	const appWindow = await windowMatching(redil.app, 'index.html');
	expect(appWindow, 'the application window never opened after unlocking').not.toBeNull();
});
