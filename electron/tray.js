const path = require('path');
const electron = require('electron');
const app = electron.app;
// Module to create tray icon
const Tray = electron.Tray;

var appIcon = null;

// toggleWindow is passed in rather than reached by injecting `ipc.send(...)`
// into the renderer, which is what this did until contextIsolation removed the
// global it relied on. The handler it used to reach only ever drove the window.
exports.create = function(win, config, toggleWindow) {
	if (process.platform === 'darwin' || appIcon || config.get('window_display_behavior') === 'show_taskbar' ) return;

	const icon = process.platform === 'linux' || process.platform === 'darwin' ? 'IconTray.png' : 'Icon.ico';
	const iconPath = path.join(__dirname, `../resources/${icon}`);

	const contextMenu = electron.Menu.buildFromTemplate([
		{
			 label: 'Show/Hide Window'
			,click() {
				toggleWindow(false);
			}
		},
		{
			type: 'separator'
		},
		{
			 label: 'Quit'
			,click() {
				app.quit();
			}
		}
	]);

	appIcon = new Tray(iconPath);
	appIcon.setToolTip('Redil');
	appIcon.setContextMenu(contextMenu);

	switch (process.platform) {
		case 'darwin':
			break;
		case 'linux':
		case 'freebsd':
		case 'sunos':
			// Double click is not supported and Click its only supported when app indicator is not used.
			// Read more here (Platform limitations): https://github.com/electron/electron/blob/master/docs/api/tray.md
			appIcon.on('click', function() {
				toggleWindow(false);
			});
			break;
		case 'win32':
			appIcon.on('double-click', function() {
				toggleWindow(false);
			});
			break;
		default:
			break;
	}
};

exports.destroy = function() {
	if (appIcon) appIcon.destroy();
	appIcon = null;
};

exports.setBadge = function(messageCount, showUnreadTray) {
	if (process.platform === 'darwin' || !appIcon) return;

	let icon;
	messageCount = parseInt(messageCount);
	if (process.platform === 'linux') {
		icon = messageCount > 0 && showUnreadTray ? 'IconTrayUnread.png' : 'IconTray.png';
	} else {
		icon = messageCount > 0 && showUnreadTray ? 'IconTrayUnread.ico' : 'Icon.ico';
	}

	const iconPath = path.join(__dirname, `../resources/${icon}`);
	appIcon.setImage(electron.nativeImage.createFromPath(iconPath));
};
