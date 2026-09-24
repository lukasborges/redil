import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serviceMenu, zoomPercent, type ServiceMenuActions, type ServiceMenuState } from '../../src/main/servicemenu.ts';
import { en } from '../../src/shared/i18n/en.ts';

const noop = () => {};
const moved: string[] = [];
const actions: ServiceMenuActions = { back: noop, forward: noop, reload: noop, zoomIn: noop, zoomOut: noop, resetZoom: noop, toggleNotifications: noop, toggleSound: noop, toggleEnabled: noop, edit: noop, moveToWorkspace: id => moved.push(id), remove: noop, developerTools: noop };
const running: ServiceMenuState = { enabled: true, canGoBack: true, canGoForward: false, notifications: true, sound: false, zoomLevel: 1, workspaces: [], workspace: '' };
const labels = (state: ServiceMenuState) => serviceMenu(state, actions, en).map(item => item.type === 'separator' ? '---' : item.label);

test('groups the page, the switches, the service and the developer tools', () => {
	assert.deepEqual(labels(running), ['Back', 'Forward', 'Reload', '---', 'Zoom In', 'Zoom Out', 'Actual Size (120%)', '---', 'Notifications', 'Sound', 'Enabled', '---', 'Edit…', 'Remove…', '---', 'Developer Tools']);
});

test('ticks the switches from the service and greys out what the page cannot do', () => {
	const items = serviceMenu(running, actions, en);
	const byLabel = (label: string) => items.find(item => item.label === label);
	assert.equal(byLabel('Forward')?.enabled, false);
	assert.equal(byLabel('Notifications')?.checked, true);
	assert.equal(byLabel('Sound')?.checked, false);
});

test('keeps only what can be done to a disabled service, which has no page', () => {
	assert.deepEqual(labels({ ...running, enabled: false }), ['Notifications', 'Sound', 'Enabled', '---', 'Edit…', 'Remove…']);
});

test('shows the zoom as the percentage Chromium draws it at', () => {
	assert.deepEqual([0, 1, 1.25, -1].map(zoomPercent), [100, 120, 126, 83]);
});

test('moves a service to a workspace, or to none, once there are workspaces', () => {
	const withWorkspaces = { ...running, workspaces: [{ id: 'w1', name: 'Work' }], workspace: 'w1' };
	const submenu = serviceMenu(withWorkspaces, actions, en).find(item => item.label === 'Move to Workspace')?.submenu ?? [];
	assert.deepEqual(submenu.map(item => item.type === 'separator' ? '---' : `${item.label}${item.checked ? ' ✓' : ''}`), ['None', '---', 'Work ✓']);
	submenu[0]?.click?.();
	assert.deepEqual(moved, ['']);
	assert.equal(labels(running).includes('Move to Workspace'), false);
});
