#!/usr/bin/env node
'use strict';

/*
 * Every icon in the repository, from the SVGs in resources/logo.
 *
 * The masters are drawn to the GNOME app icon guidelines: the template's
 * square guide, 104 by 104 with a radius of 8 on a 128 canvas, flat colour,
 * no shadow, Adwaita colours. Everything below is
 * a rendering of one of them -- there is no icon in this tree that is drawn by
 * hand, and a change to the mark means running this and committing what it
 * writes.
 *
 * It needs inkscape and ImageMagick's convert on the PATH, which is why it is
 * not part of the build: it runs when the mark changes, which is rarely.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const logo = path.join(root, 'resources', 'logo');

const MASTER = path.join(logo, 'Logo.svg');
const UNREAD = path.join(logo, 'LogoUnread.svg');
const MARK = path.join(logo, 'Mark.svg');
const TRAY = path.join(logo, 'LogoTray.svg');
const TRAY_UNREAD = path.join(logo, 'LogoTrayUnread.svg');

// resources/logo keeps one of each size, which nothing loads: it is the place
// to take a mark from when something outside this tree needs one.
const GALLERY = [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024];

// what electron-builder reads for the Linux and Windows packages
const INSTALLER = [16, 24, 32, 48, 64, 96, 128, 256, 512];

// The window and dock icon, and the tray at the three densities Electron asks
// for. The tray is small: 24 is what a panel gives it. The tray PNGs are Linux's
// alone and monochrome, like everything else in a panel; Windows reads the ICOs.
const APP = [
	{ from: MASTER, to: 'resources/Icon.png', size: 256 },
	{ from: TRAY, to: 'resources/IconTray.png', size: 24 },
	{ from: TRAY, to: 'resources/IconTray@2x.png', size: 48 },
	{ from: TRAY, to: 'resources/IconTray@4x.png', size: 96 },
	{ from: TRAY_UNREAD, to: 'resources/IconTrayUnread.png', size: 24 },
	{ from: TRAY_UNREAD, to: 'resources/IconTrayUnread@2x.png', size: 48 },
	{ from: TRAY_UNREAD, to: 'resources/IconTrayUnread@4x.png', size: 96 },
	// the boxless mark, for the lock screen, which paints its own background
	{ from: MARK, to: 'resources/Mark.png', size: 256 }
];

// Windows reads one file with every size in it; these are the ones it uses.
const ICO_SIZES = [16, 32, 48, 64, 128, 256];
const ICOS = [
	{ from: MASTER, to: 'resources/Icon.ico' },
	{ from: UNREAD, to: 'resources/IconTrayUnread.ico' },
	{ from: MASTER, to: 'resources/installer/icon.ico' }
];

function render(from, to, size) {
	fs.mkdirSync(path.dirname(to), { recursive: true });
	execFileSync('inkscape', ['-w', String(size), '-h', String(size), from, '-o', to], { stdio: 'pipe' });
}

function main() {
	for (const size of GALLERY) render(MASTER, path.join(logo, `${size}x${size}.png`), size);
	render(MASTER, path.join(logo, 'Logo.png'), 1024);
	render(UNREAD, path.join(logo, 'Logo_unread.png'), 1024);

	for (const size of INSTALLER) {
		render(MASTER, path.join(root, 'resources', 'installer', 'icons', `${size}x${size}.png`), size);
	}

	for (const icon of APP) render(icon.from, path.join(root, icon.to), icon.size);

	// convert builds the multi-size ico out of one png per size
	const scratch = fs.mkdtempSync(path.join(require('os').tmpdir(), 'shep-icons-'));
	try {
		for (const ico of ICOS) {
			const frames = ICO_SIZES.map(size => {
				const frame = path.join(scratch, `${path.basename(ico.to)}-${size}.png`);
				render(ico.from, frame, size);
				return frame;
			});
			execFileSync('convert', [...frames, path.join(root, ico.to)], { stdio: 'pipe' });
		}
	} finally {
		fs.rmSync(scratch, { recursive: true, force: true });
	}

	const written = GALLERY.length + 2 + INSTALLER.length + APP.length + ICOS.length;
	console.log(`${written} files written from ${path.relative(root, logo)}`);
}

try {
	main();
} catch (error) {
	console.error(error.message);
	console.error('inkscape and ImageMagick have to be on the PATH for this one.');
	process.exitCode = 1;
}
