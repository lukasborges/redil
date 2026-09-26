#!/usr/bin/env node
'use strict';

/*
 * Runs the end-to-end suite where its windows will not take the focus, and passes the rest of
 * the command line through untouched. On Linux that is a virtual X display, which xvfb-run
 * gives them; Windows has nothing of the sort, so they open on the desktop.
 *
 * With --network first, the tests that load real sites run too.
 */

const { spawnSync } = require('child_process');

const argv = process.argv.slice(2);
const network = argv[0] === '--network';
const command = network ? argv.slice(1) : argv;
const environment = network ? { ...process.env, SHEP_NETWORK: '1' } : process.env;

// cmd.exe is what resolves playwright to the shim npm put on the PATH.
const plainly = () => spawnSync(command[0], command.slice(1), { stdio: 'inherit', env: environment, shell: process.platform === 'win32' });

// ozone-platform-hint=auto picks Wayland while XDG_SESSION_TYPE says wayland, even with no WAYLAND_DISPLAY.
function onAVirtualDisplay() {
	const display = { ...environment, XDG_SESSION_TYPE: 'x11' };
	delete display.WAYLAND_DISPLAY;
	return spawnSync('xvfb-run', ['--auto-servernum', '--server-args=-screen 0 1280x1024x24', ...command], { stdio: 'inherit', env: display });
}

function run() {
	if (process.platform !== 'linux') return plainly();
	const attempt = onAVirtualDisplay();
	if (attempt.error?.code !== 'ENOENT') return attempt;
	console.error('xvfb-run is not installed, so the windows open on this desktop (Fedora: dnf install xorg-x11-server-Xvfb)');
	return plainly();
}

const { status, error } = run();
if (error) {
	console.error(error.message);
	process.exit(1);
}
process.exit(status ?? 1);
