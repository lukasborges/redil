import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { countFromTitle, createBlinkGuard, totalUnread, TITLE_BLINK_GRACE_MS, type UnreadCount } from '../../src/main/unread.ts';

test('reads the count in the shapes services write it in the title', () => {
	const titles = ['(3) WhatsApp', 'Inbox (12) - someone@gmail.com - Gmail', '(1.234) Feed', '(99+) Chat', '(•) Chat', 'Discord', '(Draft) Notes'];
	assert.deepEqual(titles.map(countFromTitle), [3, 12, 1234, 99, '•', 0, 0]);
});

test('believes a drop to nothing only once it has lasted, since some services blink their title', () => {
	mock.timers.enable({ apis: ['setTimeout'] });
	const reported: UnreadCount[] = [];
	const guard = createBlinkGuard(count => reported.push(count));

	guard.fromTitle(4);
	guard.fromTitle(0);
	mock.timers.tick(TITLE_BLINK_GRACE_MS - 1);
	guard.fromTitle(4);
	mock.timers.tick(TITLE_BLINK_GRACE_MS * 2);
	assert.deepEqual(reported, [4, 4]);

	guard.fromTitle(0);
	mock.timers.tick(TITLE_BLINK_GRACE_MS);
	assert.deepEqual(reported, [4, 4, 0]);
	mock.timers.reset();
});

test('leaves a service that only says there is something out of the total', () => {
	assert.equal(totalUnread([3, '•', 0, 12]), 15);
});
