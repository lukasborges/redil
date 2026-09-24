import { dialog, type BrowserWindow, type Session } from 'electron';
import { store } from './store.ts';
import type { ServiceRecord } from '../shared/service.ts';
import { mainMessages } from './messages.ts';
import { fill, type MessageKey } from '../shared/i18n/index.ts';

const SILENT_PERMISSIONS = ['fullscreen', 'pointerLock', 'clipboard-sanitized-write', 'background-sync'];
const ASKED_PERMISSIONS: Record<string, MessageKey> = {
	'media': 'permission.camera',
	'display-capture': 'permission.screen'
};
// Granted with the camera, or the display sleeps in the middle of a call.
const CALL_PERMISSIONS = ['screen-wake-lock'];

const rememberedKey = (partition: string, permission: string) => partition + '|' + permission;

function remembered(partition: string, permission: string): boolean | undefined {
	return store.get('permissions')[rememberedKey(partition, permission)];
}

async function ask(window: BrowserWindow, service: ServiceRecord, permission: string): Promise<boolean> {
	const messages = mainMessages();
	const { response } = await dialog.showMessageBox(window, {
		type: 'question',
		buttons: [messages['permission.allow'], messages['permission.block']],
		defaultId: 1,
		cancelId: 1,
		title: messages['permission.title'],
		message: fill(messages[ASKED_PERMISSIONS[permission] ?? 'permission.camera'], { name: service.name }),
		detail: messages['permission.detail']
	});
	const allowed = response === 0;
	store.set('permissions', { ...store.get('permissions'), [rememberedKey(service.partition, permission)]: allowed });
	return allowed;
}

export function applyPermissionPolicy(session: Session, window: BrowserWindow, current: () => ServiceRecord): void {
	session.setPermissionRequestHandler((contents, permission, callback) => {
		const service = current();
		if ( permission === 'notifications' ) return callback(service.notifications);
		if ( SILENT_PERMISSIONS.includes(permission) ) return callback(true);
		if ( CALL_PERMISSIONS.includes(permission) ) return callback(service.media);
		if ( ASKED_PERMISSIONS[permission] ) {
			if ( service.media ) return callback(true);
			const answer = remembered(service.partition, permission);
			if ( answer !== undefined ) return callback(answer);
			ask(window, service, permission).then(callback, () => callback(false));
			return;
		}
		callback(false);
	});

	// navigator.permissions.query never reaches the request handler
	session.setPermissionCheckHandler((contents, permission) => {
		const service = current();
		if ( permission === 'notifications' ) return service.notifications;
		if ( SILENT_PERMISSIONS.includes(permission) ) return true;
		if ( CALL_PERMISSIONS.includes(permission) ) return service.media;
		if ( ASKED_PERMISSIONS[permission] ) return service.media || remembered(service.partition, permission) === true;
		return false;
	});
}
