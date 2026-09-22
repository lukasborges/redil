const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { repoRoot } = require('./helpers/launch');

// WhatsApp's snippet reads the unread counts out of the page's own IndexedDB
// rather than off the DOM, which is what makes it survive the site rebuilding
// its CSS -- the approach is ferdium-recipes' (MIT), the code is this fork's.
// None of it needs WhatsApp: the database is stubbed, and what is under test is
// which chats the snippet counts.

const catalogue = JSON.parse(fs.readFileSync(path.join(repoRoot, 'resources', 'services.json'), 'utf8'));
const snippet = catalogue.find(entry => entry.id === 'whatsapp').js_unread;

function run(chats, { name = 'model-storage' } = {}) {
	const counts = [];
	const timers = [];

	const request = { onsuccess: null, onerror: null, result: { onversionchange: null, close() {},
		transaction: () => ({ objectStore: () => ({ getAll() {
			const query = {};
			setTimeout(() => query.onsuccess && query.onsuccess({ target: { result: chats } }), 0);
			return query;
		} }) })
	} };

	const sandbox = {
		 rambox: { setUnreadCount: count => counts.push(count) }
		,indexedDB: {
			 databases: () => Promise.resolve([{ name: name }])
			,open: () => { setTimeout(() => request.onsuccess && request.onsuccess(), 0); return request; }
		}
		,setInterval: fn => { timers.push(fn); return timers.length; }
		,setTimeout: setTimeout
		,console: console
	};

	vm.createContext(sandbox);
	vm.runInContext(snippet, sandbox);

	// The first pass opens the database; the next one reads it.
	return new Promise(resolve => setTimeout(() => {
		timers.forEach(fn => fn());
		setTimeout(() => resolve(counts), 10);
	}, 10));
}

test('adds up the unread messages of the chats that are asking for attention', async () => {
	const counts = await run([
		 { unreadCount: 2 }
		,{ unreadCount: 3, muteExpiration: 0, isAutoMuted: false }
		,{ unreadCount: 9, archive: true }                       // archived
		,{ unreadCount: 4, muteExpiration: 1893456000 }          // muted
		,{ unreadCount: 7, isAutoMuted: true }                   // muted by the phone
		,{ unreadCount: 0 }
		,{ unreadCount: -1 }                                     // marked unread, no messages
	]);

	expect(counts.at(-1)).toBe(5);
});

test('says nothing when the database it knows is not there', async () => {
	// A WhatsApp that renames its storage stops answering rather than throwing,
	// and the page title takes the service over.
	expect(await run([{ unreadCount: 3 }], { name: 'something-else' })).toEqual([]);
});
