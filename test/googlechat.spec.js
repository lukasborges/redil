const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { repoRoot } = require('./helpers/launch');

// Google Chat prints the unread count beside each sidebar section, which is
// what the snippet reads -- the selector is ferdium-recipes' (MIT). The
// favicon it swaps on new messages is kept as a yes or no for when that count
// is not there. The document is stubbed; what is under test is which answer wins.

const catalogue = JSON.parse(fs.readFileSync(path.join(repoRoot, 'resources', 'services.json'), 'utf8'));
const snippet = catalogue.find(entry => entry.id === 'hangoutschat').js_unread;

function run({ direct, spaces, favicon = false }) {
	const counts = [];
	let tick;
	const sections = { 1: direct, 2: spaces };
	const sandbox = {
		 rambox: { setUnreadCount: count => counts.push(count) }
		,document: { querySelector(selector) {
			const section = selector.match(/data-section-type="(\d)"/);
			if ( section ) return sections[section[1]] === undefined ? null : { textContent: String(sections[section[1]]) };
			return favicon && selector.includes('favicon_chat_new_notif_') ? {} : null;
		} }
		,setInterval: fn => { tick = fn; }
	};
	vm.createContext(sandbox);
	vm.runInContext(snippet, sandbox);
	tick();
	return counts.at(-1);
}

test('counts the unread direct messages', () => {
	expect(run({ direct: 3, spaces: 5 })).toBe(3);
});

test('marks unread spaces with a dot, because only direct messages are counted', () => {
	expect(run({ direct: undefined, spaces: 2 })).toBe('•');
});

test('falls back to the favicon when no section shows a count', () => {
	expect(run({ favicon: true })).toBe('•');
	expect(run({})).toBe(0);
});
