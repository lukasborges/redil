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
const MASTER_UNREAD = path.join(logo, 'LogoUnread.svg');
const LINUX_TRAY = path.join(logo, 'LogoTray.svg');
const LINUX_TRAY_UNREAD = path.join(logo, 'LogoTrayUnread.svg');

// resources/logo keeps one of each size, which nothing loads: it is the place
// to take a mark from when something outside this tree needs one.
const GALLERY = [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024];

// what electron-builder reads for the Linux packages
const INSTALLER = [16, 24, 32, 48, 64, 96, 128, 256, 512];

// and for the Windows one, which wants them in a single .ico: the sizes Windows picks between
const ICO = [16, 24, 32, 48, 64, 128, 256];

// The window and dock icon, and the tray at the three densities Electron asks
// for. The tray is small: 24 is what a panel gives it, 16 what Windows' notification
// area and a Mac's menu bar do, and Windows takes the coloured mark rather than the symbolic one.
const APP = [
	{ from: MASTER, to: 'resources/Icon.png', size: 256 },
	{ from: LINUX_TRAY, to: 'resources/IconTray.png', size: 24 },
	{ from: LINUX_TRAY, to: 'resources/IconTray@2x.png', size: 48 },
	{ from: LINUX_TRAY, to: 'resources/IconTray@4x.png', size: 96 },
	{ from: LINUX_TRAY_UNREAD, to: 'resources/IconTrayUnread.png', size: 24 },
	{ from: LINUX_TRAY_UNREAD, to: 'resources/IconTrayUnread@2x.png', size: 48 },
	{ from: LINUX_TRAY_UNREAD, to: 'resources/IconTrayUnread@4x.png', size: 96 },
	{ from: LINUX_TRAY, to: 'resources/IconTrayMac.png', size: 16 },
	{ from: LINUX_TRAY, to: 'resources/IconTrayMac@2x.png', size: 32 },
	{ from: LINUX_TRAY, to: 'resources/IconTrayMac@4x.png', size: 64 },
	{ from: LINUX_TRAY_UNREAD, to: 'resources/IconTrayMacUnread.png', size: 16 },
	{ from: LINUX_TRAY_UNREAD, to: 'resources/IconTrayMacUnread@2x.png', size: 32 },
	{ from: LINUX_TRAY_UNREAD, to: 'resources/IconTrayMacUnread@4x.png', size: 64 },
	{ from: MASTER, to: 'resources/IconTrayColour.png', size: 16 },
	{ from: MASTER, to: 'resources/IconTrayColour@2x.png', size: 32 },
	{ from: MASTER, to: 'resources/IconTrayColour@4x.png', size: 64 },
	{ from: MASTER_UNREAD, to: 'resources/IconTrayColourUnread.png', size: 16 },
	{ from: MASTER_UNREAD, to: 'resources/IconTrayColourUnread@2x.png', size: 32 },
	{ from: MASTER_UNREAD, to: 'resources/IconTrayColourUnread@4x.png', size: 64 }
];

function render(from, to, size) {
	fs.mkdirSync(path.dirname(to), { recursive: true });
	execFileSync('inkscape', ['-w', String(size), '-h', String(size), from, '-o', to], { stdio: 'pipe' });
}

// Inkscape writes no .ico, so the PNGs it has just written are packed into one here.
// Every entry is a whole PNG, which is what Windows has read since Vista; a 256 is
// written as a 0, the only width the byte cannot hold.
function pack(to, sizes, file) {
	const images = sizes.map(size => fs.readFileSync(file(size)));
	const header = Buffer.alloc(6);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(images.length, 4);

	let offset = header.length + images.length * 16;
	const directory = images.map((png, index) => {
		const entry = Buffer.alloc(16);
		entry[0] = entry[1] = sizes[index] % 256;
		entry.writeUInt16LE(1, 4);
		entry.writeUInt16LE(32, 6);
		entry.writeUInt32LE(png.length, 8);
		entry.writeUInt32LE(offset, 12);
		offset += png.length;
		return entry;
	});

	fs.writeFileSync(to, Buffer.concat([header, ...directory, ...images]));
}

function main() {
	for (const size of GALLERY) render(MASTER, path.join(logo, `${size}x${size}.png`), size);
	render(MASTER, path.join(logo, 'Logo.png'), 1024);

	const installer = size => path.join(root, 'resources', 'installer', 'icons', `${size}x${size}.png`);
	for (const size of INSTALLER) render(MASTER, installer(size), size);

	pack(path.join(root, 'resources', 'installer', 'icon.ico'), ICO, installer);

	for (const icon of APP) render(icon.from, path.join(root, icon.to), icon.size);

	const written = GALLERY.length + 1 + INSTALLER.length + 1 + APP.length;
	console.log(`${written} files written from ${path.relative(root, logo)}`);
}

try {
	main();
} catch (error) {
	console.error(error.message);
	console.error('inkscape has to be on the PATH for this one.');
	process.exitCode = 1;
}
