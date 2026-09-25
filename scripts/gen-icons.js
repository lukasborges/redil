#!/usr/bin/env node
'use strict';

/*
 * There is no icon in this tree that is drawn by hand: a change to the mark
 * means running this and committing what it writes.
 *
 * It needs inkscape on the PATH, which is why it is
 * not part of the build: it runs when the mark changes, which is rarely.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const logo = path.join(root, 'resources', 'logo');

const MASTER = path.join(logo, 'Logo.svg');
const LINUX_TRAY = path.join(logo, 'LogoTray.svg');
const LINUX_TRAY_UNREAD = path.join(logo, 'LogoTrayUnread.svg');

// resources/logo keeps one of each size, which nothing loads: it is the place
// to take a mark from when something outside this tree needs one.
const GALLERY = [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024];

// what electron-builder reads for the Linux packages
const INSTALLER = [16, 24, 32, 48, 64, 96, 128, 256, 512];

// The window and dock icon, and the tray at the three densities Electron asks
// for. The tray is small: 24 is what a panel gives it.
const APP = [
	{ from: MASTER, to: 'resources/Icon.png', size: 256 },
	{ from: LINUX_TRAY, to: 'resources/IconTray.png', size: 24 },
	{ from: LINUX_TRAY, to: 'resources/IconTray@2x.png', size: 48 },
	{ from: LINUX_TRAY, to: 'resources/IconTray@4x.png', size: 96 },
	{ from: LINUX_TRAY_UNREAD, to: 'resources/IconTrayUnread.png', size: 24 },
	{ from: LINUX_TRAY_UNREAD, to: 'resources/IconTrayUnread@2x.png', size: 48 },
	{ from: LINUX_TRAY_UNREAD, to: 'resources/IconTrayUnread@4x.png', size: 96 }
];

function render(from, to, size) {
	fs.mkdirSync(path.dirname(to), { recursive: true });
	execFileSync('inkscape', ['-w', String(size), '-h', String(size), from, '-o', to], { stdio: 'pipe' });
}

function main() {
	for (const size of GALLERY) render(MASTER, path.join(logo, `${size}x${size}.png`), size);
	render(MASTER, path.join(logo, 'Logo.png'), 1024);

	for (const size of INSTALLER) {
		render(MASTER, path.join(root, 'resources', 'installer', 'icons', `${size}x${size}.png`), size);
	}

	for (const icon of APP) render(icon.from, path.join(root, icon.to), icon.size);

	const written = GALLERY.length + 1 + INSTALLER.length + APP.length;
	console.log(`${written} files written from ${path.relative(root, logo)}`);
}

try {
	main();
} catch (error) {
	console.error(error.message);
	console.error('inkscape has to be on the PATH for this one.');
	process.exitCode = 1;
}
