import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspaceMenu, type WorkspaceMenuActions } from '../../src/main/workspacemenu.ts';
import { en } from '../../src/shared/i18n/en.ts';

const noop = () => {};
const actions: WorkspaceMenuActions = { choose: noop, create: noop, rename: noop, changeIcon: noop, remove: noop };
const workspaces = [{ id: 'w1', name: 'Work', hue: 'blue' as const }, { id: 'w2', name: 'Personal', hue: 'green' as const }];
const describe = (active: string | null) => workspaceMenu(workspaces, active, actions, en)
	.map(item => item.type === 'separator' ? '---' : `${item.label}${item.checked ? ' ✓' : ''}${item.accelerator ? ' ' + item.accelerator : ''}`);

test('lists the workspaces with their shortcuts, then All Services, then what can be done to them', () => {
	assert.deepEqual(describe('w2'), ['Work CommandOrControl+Alt+1', 'Personal ✓ CommandOrControl+Alt+2', 'All Services CommandOrControl+Alt+3', '---', 'New Workspace…', 'Rename…', 'Change Icon…', 'Delete']);
});

test('offers nothing to rename or delete under All Services, which is not a workspace', () => {
	assert.deepEqual(describe(null), ['Work CommandOrControl+Alt+1', 'Personal CommandOrControl+Alt+2', 'All Services ✓ CommandOrControl+Alt+3', '---', 'New Workspace…']);
});
