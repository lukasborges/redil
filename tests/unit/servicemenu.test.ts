import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serviceMenu, type ServiceMenuActions, type ServiceMenuState } from '../../src/main/servicemenu.ts';
import { en } from '../../src/shared/i18n/en.ts';

const noop = () => {};
const moved: string[] = [];
const actions: ServiceMenuActions = { reload: noop, toggleNotifications: noop, toggleSound: noop, toggleEnabled: noop, edit: noop, moveToWorkspace: id => moved.push(id), remove: noop, developerTools: noop };
const running: ServiceMenuState = { enabled: true, notifications: true, sound: false, workspaces: [], workspace: '' };
const labels = (state: ServiceMenuState) => serviceMenu(state, actions, en).map(item => item.type === 'separator' ? '---' : item.label);

test('groups the page, the switches, the service and the developer tools, leaving history and zoom to the title bar', () => {
	assert.deepEqual(labels(running), ['Reload', '---', 'Notifications', 'Sound', 'Enabled', '---', 'Edit…', 'Remove…', '---', 'Developer Tools']);
});

test('ticks the switches from the service', () => {
	const items = serviceMenu(running, actions, en);
	const byLabel = (label: string) => items.find(item => item.label === label);
	assert.equal(byLabel('Notifications')?.checked, true);
	assert.equal(byLabel('Sound')?.checked, false);
});

test('keeps only what can be done to a disabled service, which has no page', () => {
	assert.deepEqual(labels({ ...running, enabled: false }), ['Notifications', 'Sound', 'Enabled', '---', 'Edit…', 'Remove…']);
});

test('moves a service to a workspace, or to all of them, in one radio group with the current one ticked', () => {
	const withWorkspaces = { ...running, workspaces: [{ id: 'w1', name: 'Work' }], workspace: 'w1' };
	const submenu = serviceMenu(withWorkspaces, actions, en).find(item => item.label === 'Move to Workspace')?.submenu ?? [];
	assert.deepEqual(submenu.map(item => `${item.label}${item.checked ? ' ✓' : ''}`), ['Work ✓', 'All Workspaces']);
	assert.equal(submenu.some(item => item.type === 'separator'), false);
	submenu[1]?.click?.();
	assert.deepEqual(moved, ['']);
	assert.equal(labels(running).includes('Move to Workspace'), false);
});
