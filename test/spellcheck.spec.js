const { test, expect } = require('@playwright/test');
const path = require('path');
const { launchRedil, closeRedil, repoRoot } = require('./helpers/launch');

// Chromium does the checking; what this fork decides is whether it is on and in
// which languages. Both are preferences read in the main process, so the
// languages are asked of the session rather than of the page. Whether a given
// webContents checks at all is not readable back -- getLastWebPreferences does
// not carry `spellcheck` -- so that half is asserted where this app writes it,
// on the webview tag.

const FIXTURE = 'file://' + path.join(repoRoot, 'test', 'fixtures', 'service.html');

async function languagesOf(config) {
	const redil = await launchRedil({ config: config });
	try {
		return await redil.app.evaluate(({ webContents }) => webContents.getAllWebContents()
			.filter(contents => contents.getType() === 'window')
			.map(contents => contents.session.getSpellCheckerLanguages())[0]);
	} finally {
		await closeRedil(redil);
	}
}

test('checks spelling in the languages the preference names', async () => {
	expect(await languagesOf({ spellcheck: true, spellcheck_languages: ['pt-BR', 'en-US'] }))
		.toEqual(['pt-BR', 'en-US']);
});

test('works the languages out when the preference names none', async () => {
	// Whatever this machine answers, every entry has to be one Chromium ships a
	// dictionary for: setSpellCheckerLanguages throws on anything else, so an
	// empty list here would mean the guess never ran.
	const languages = await languagesOf({ spellcheck: true, spellcheck_languages: [] });

	expect(languages.length).toBeGreaterThan(0);
});

test('turns the checker off in a service when the preference says so', async () => {
	const redil = await launchRedil({ config: { spellcheck: false } });
	try {
		const attribute = await redil.window.evaluate(url => {
			const record = Ext.getStore('Services').add({ id: 9301, type: 'custom', name: 'Spelling',
				url: url, align: 'left', enabled: true, notifications: false, muted: true })[0];

			Ext.cq1('app-main').insert(1, { xtype: 'webview', id: 'tab_9301', title: '', src: url,
				type: 'custom', enabled: true, record: record, tabConfig: { service: record } });

			return Ext.getCmp('tab_9301').getWebView().getAttribute('webpreferences');
		}, FIXTURE);

		expect(attribute).toContain('spellcheck=no');
	} finally {
		await closeRedil(redil);
	}
});
