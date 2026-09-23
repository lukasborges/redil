const { test, expect } = require('@playwright/test');
const { launchRedil, closeRedil } = require('./helpers/launch');

// The dark theme is nothing but different values for the tokens in
// resources/css/redil-modern.css, switched by one media query. What drives that
// query is nativeTheme.themeSource, which electron/main.js sets from the `theme`
// preference -- so this checks the whole chain, preference to painted colour.

async function paleta(theme) {
	const redil = await launchRedil({ config: { theme: theme } });
	try {
		return await redil.window.evaluate(() => {
			const raiz = getComputedStyle(document.documentElement);
			return {
				 escuro: matchMedia('(prefers-color-scheme: dark)').matches
				,ink: raiz.getPropertyValue('--rx-ink').trim()
				,surface: raiz.getPropertyValue('--rx-surface').trim()
			};
		});
	} finally {
		await closeRedil(redil);
	}
}

test('paints light when the preference says light', async () => {
	expect(await paleta('light')).toEqual({ escuro: false, ink: '#12222E', surface: '#FFFFFF' });
});

test('paints dark when the preference says dark', async () => {
	expect(await paleta('dark')).toEqual({ escuro: true, ink: '#EDEDEF', surface: '#1E1E21' });
});

test('leaves the choice to the desktop when the preference says system', async () => {
	// Whatever the machine running the suite answers, the tokens have to agree
	// with it: that pairing is the thing that breaks if the query is mistyped.
	const { escuro, ink } = await paleta('system');
	expect(ink).toBe(escuro ? '#EDEDEF' : '#12222E');
});
