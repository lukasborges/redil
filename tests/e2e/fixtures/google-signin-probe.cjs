// Loaded beside out/main/index.js, not through Playwright, whose debugger sets navigator.webdriver.
const { app } = require('electron');
const [, , mainScript] = process.argv.filter(argument => !argument.startsWith('--'));

app.on('web-contents-created', (event, contents) => {
	contents.on('did-finish-load', async () => {
		if ( contents.probed || !contents.getURL().startsWith('https://accounts.google.com/') ) return;
		contents.probed = true;
		const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
		try {
			await wait(3000);
			await contents.executeJavaScript('document.querySelector("input[name=identifier]").focus()');
			await contents.insertText('shep.no.such.account.zq7@gmail.com');
			await contents.executeJavaScript('(document.querySelector("#identifierNext button") || document.querySelector("#identifierNext")).click()');
			await wait(8000);
			const text = await contents.executeJavaScript('document.body.innerText');
			const answer = /may not be secure/i.test(text) ? 'refused' : /find (this|your Google) account/i.test(text) ? 'accepted' : 'unknown: ' + text.slice(0, 120).replace(/\s+/g, ' ');
			process.stdout.write('GOOGLE ' + answer + '\n');
		} catch ( error ) {
			process.stdout.write('GOOGLE error ' + error.message + '\n');
		}
		app.exit(0);
	});
});

require(mainScript);
