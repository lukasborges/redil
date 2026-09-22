const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { repoRoot } = require('./helpers/launch');

// resources/services.json is read by the renderer over Ajax, so a mistake in it
// shows up as a service that silently will not load rather than as an error.
// None of this needs the app running.
const catalogue = JSON.parse(fs.readFileSync(path.join(repoRoot, 'resources', 'services.json'), 'utf8'));

const FIELDS = {
	 id: 'string', logo: 'string', name: 'string', description: 'string', url: 'string'
	,type: 'string', allow_popups: 'boolean', manual_notifications: 'boolean'
	,js_unread: 'string', userAgent: 'string', note: 'string'
	,titleBlink: 'boolean', custom_domain: 'boolean', media: 'boolean'
};

test('gives every entry the same fields with the same types', () => {
	for (const entry of catalogue) {
		const shape = Object.fromEntries(Object.keys(entry).map(key => [key, typeof entry[key]]));
		expect(shape, `entry ${entry.id}`).toEqual(FIELDS);
	}
});

test('keeps ids unique, since a configured service is stored under one', () => {
	const ids = catalogue.map(entry => entry.id);
	expect(ids.length - new Set(ids).size, 'duplicate ids').toBe(0);
});

test('ships an icon for every entry', () => {
	// A missing file is a broken image in the service list, and nothing warns.
	const missing = catalogue
		.filter(entry => !fs.existsSync(path.join(repoRoot, 'resources', 'icons', entry.logo)))
		.map(entry => `${entry.id} -> ${entry.logo}`);
	expect(missing).toEqual([]);
});

test('uses only the types the add window can show', () => {
	// doTypeFilter in MainController keeps records whose type is checked in the
	// Messaging or Email boxes, or custom. Any other type is simply invisible.
	const strays = catalogue.filter(entry => !['messaging', 'email'].includes(entry.type));
	expect(strays.map(entry => `${entry.id} -> ${entry.type}`)).toEqual([]);
});

test('gives every entry an https url or a custom domain template', () => {
	const bad = catalogue
		.filter(entry => !entry.url.startsWith('https://') && !entry.url.includes('___'))
		.map(entry => `${entry.id} -> ${entry.url}`);
	expect(bad).toEqual([]);
});

test('marks the services whose purpose is calls', () => {
	// The flag seeds a per-service permission in the Add window, so a mistake
	// here is a camera and a microphone handed out, or withheld, by accident.
	// Its type is covered by the shape test above, which every entry shares.
	const comMedia = catalogue.filter(entry => entry.media).map(entry => entry.id);
	expect(comMedia).toEqual(expect.arrayContaining(['googlemeet', 'zoom', 'teams', 'discord', 'slack', 'whatsapp']));
	// and nothing that has no call of its own
	expect(comMedia).not.toContain('gmail');
	expect(comMedia).not.toContain('chatgpt');
});
