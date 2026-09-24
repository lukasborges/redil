const { test, expect } = require('@playwright/test');
const path = require('path');
const { launchShep, closeShep, repoRoot } = require('./helpers/launch');

const FIXTURE = 'file://' + path.join(repoRoot, 'test', 'fixtures', 'service.html');
const SMALL = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>');
const LARGE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>');
const UNREACHABLE = 'file://' + path.join(repoRoot, 'test', 'fixtures', 'missing-favicon.png');

let shep;

const addService = (id, type, logo) => shep.window.evaluate(({ id, type, logo, url }) => {
	Ext.getStore('Services').add({ id, type, logo, name: type, url, enabled: true, notifications: false, muted: true });
	Ext.cq1('app-main').insert(Ext.cq1('app-main').items.length, { xtype: 'webview', id: 'tab_' + id, record: Ext.getStore('Services').getById(id), tabConfig: {} });
}, { id, type, logo, url: FIXTURE });

const reportFavicons = (id, favicons) => shep.window.evaluate(({ id, favicons }) => Ext.getCmp('tab_' + id).wearLargestFavicon(favicons), { id, favicons });

const railIcon = id => shep.window.evaluate(id => Ext.getCmp('tab_' + id).tab.icon, id);

test.beforeAll(async () => {
	shep = await launchShep();
	await addService(9201, 'github', 'github.png');
	await addService(9202, 'github', 'github.png');
	await addService(9203, 'slack', 'slack.png');
});

test.afterAll(async () => {
	await closeShep(shep);
});

test('shows the catalogue icon until the page reports a favicon', async () => {
	expect(await railIcon(9201)).toBe('resources/icons/github.png');
});

test('wears the largest favicon the page lists, since the rail draws them at 30px', async () => {
	await reportFavicons(9201, [SMALL, LARGE]);
	await expect.poll(() => railIcon(9201)).toBe(LARGE);
});

test('skips a favicon that fails to load, as one behind the service\'s cookies does', async () => {
	await reportFavicons(9202, [UNREACHABLE, SMALL]);
	await expect.poll(() => railIcon(9202)).toBe(SMALL);
});

test('keeps the icon it wears when none of the favicons the page lists loads', async () => {
	await reportFavicons(9202, [UNREACHABLE]);
	await new Promise(resolve => setTimeout(resolve, 500));
	expect(await railIcon(9202)).toBe(SMALL);
});

test('leaves Slack\'s icon to IconLoader, which sets the workspace picture', async () => {
	await reportFavicons(9203, [LARGE]);
	await new Promise(resolve => setTimeout(resolve, 500));
	expect(await railIcon(9203)).toBe('resources/icons/slack.png');
});
