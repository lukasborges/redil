// Loaded beside out/main/index.js, not through Playwright: Playwright's debugger
// sets navigator.webdriver, which Turnstile refuses whatever the agent says.
const { app } = require('electron');
const [, , mainScript, loginUrl, timeoutMs] = process.argv.filter(argument => !argument.startsWith('--'));

app.on('web-contents-created', (event, contents) => {
	contents.on('did-finish-load', () => {
		if ( contents.probed || !contents.getURL().startsWith(new URL(loginUrl).origin) ) return;
		contents.probed = true;
		contents.executeJavaScript(`(async () => {
			let key;
			for (const script of [...document.scripts].filter(s => s.src).slice(0, 40)) {
				const match = (await fetch(script.src).then(r => r.text(), () => '')).match(/0x4[A-Za-z0-9_-]{18,}/);
				if (match) { key = match[0]; break; }
			}
			for (let i = 0; i < 80 && !window.turnstile; i++) await new Promise(r => setTimeout(r, 250));
			if (!key || !window.turnstile) return 'no turnstile on the page';
			const box = document.body.appendChild(document.createElement('div'));
			return new Promise(resolve => {
				setTimeout(() => resolve('timeout'), ${Number(timeoutMs)});
				turnstile.render(box, { sitekey: key, callback: () => resolve('token'), 'error-callback': code => resolve('error ' + code) });
			});
		})()`).then(answer => { process.stdout.write('TURNSTILE ' + answer + '\n'); app.exit(0); });
	});
});

require(mainScript);
