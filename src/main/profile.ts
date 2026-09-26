// Imported before anything else in main: the store opens its file as soon as it is imported,
// so the profile's name and folder have to be settled first.
import { join } from 'node:path';
import { app } from 'electron';
import { productName, build } from '../../package.json';

// Run unpacked from out/main, Electron finds no package.json and calls itself Electron.
app.setName(productName);

// What Windows files the taskbar button and every notification under. The installer's shortcut
// carries the same id, and without it a notification comes from electron.app.Shep and shows no name.
if ( process.platform === 'win32' ) app.setAppUserModelId(build.appId);

const hasOwnUserData = process.argv.some(argument => argument.startsWith('--user-data-dir'));

// A run from the repository never opens the installed app's profile.
if ( !app.isPackaged && !hasOwnUserData ) app.setPath('userData', join(app.getPath('appData'), 'Shep-dev'));
