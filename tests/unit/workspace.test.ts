import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasUnreadElsewhere, isShownIn, workspaceForNumber, type Workspace } from '../../src/shared/workspace.ts';

const work: Workspace = { id: 'w1', name: 'Work', hue: 'blue' };
const home: Workspace = { id: 'w2', name: 'Personal', hue: 'green' };

test('shows a workspace\'s services and the ones in no workspace, and everything under All Services', () => {
	assert.equal(isShownIn('w1', 'w1'), true);
	assert.equal(isShownIn('w2', 'w1'), false);
	assert.equal(isShownIn('', 'w1'), true);
	assert.equal(isShownIn('w2', null), true);
});

test('numbers the workspaces in order and gives All Services the number after the last', () => {
	assert.equal(workspaceForNumber(0, [work, home]), 'w1');
	assert.equal(workspaceForNumber(1, [work, home]), 'w2');
	assert.equal(workspaceForNumber(2, [work, home]), null);
	assert.equal(workspaceForNumber(3, [work, home]), undefined);
});

test('marks unread in a workspace not on screen, which is never the case under All Services', () => {
	const services = [{ workspace: 'w1', unread: 0 }, { workspace: 'w2', unread: 4 }];
	assert.equal(hasUnreadElsewhere(services, 'w1'), true);
	assert.equal(hasUnreadElsewhere(services, 'w2'), false);
	assert.equal(hasUnreadElsewhere(services, null), false);
	assert.equal(hasUnreadElsewhere([{ workspace: 'w2', unread: '•' }], 'w1'), true);
});
