import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoomPercent } from '../../src/shared/zoom.ts';

test('shows the zoom as the percentage Chromium draws it at', () => {
	assert.deepEqual([0, 1, 1.25, -1].map(zoomPercent), [100, 120, 126, 83]);
});
