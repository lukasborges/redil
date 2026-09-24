import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspaceMenu, type WorkspaceMenuActions } from '../../src/main/workspacemenu.ts';

const noop = () => {};
const actions: WorkspaceMenuActions = { choose: noop, create: noop, rename: noop, remove: noop };
const workspaces = [{ id: 'w1', name: 'Work', hue: 'blue' as const }, { id: 'w2', name: 'Personal', hue: 'green' as const }];
const describe = (active: string | null) => workspaceMenu(workspaces, active, actions)
	.map(item => item.type === 'separator' ? '---' : `${item.label}${item.checked ? ' ✓' : ''}${item.accelerator ? ' ' + item.accelerator : ''}`);

test('lists the workspaces with their shortcuts, then All Services, then what can be done to them', () => {
	assert.deepEqual(describe('w2'), ['Work Ctrl+Alt+1', 'Personal ✓ Ctrl+Alt+2', 'All Services Ctrl+Alt+3', '---', 'New Workspace…', 'Rename…', 'Delete']);
});

test('offers nothing to rename or delete under All Services, which is not a workspace', () => {
	assert.deepEqual(describe(null), ['Work Ctrl+Alt+1', 'Personal Ctrl+Alt+2', 'All Services ✓ Ctrl+Alt+3', '---', 'New Workspace…']);
});
