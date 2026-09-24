import { Menu, clipboard, shell, type WebContents } from 'electron';
import { pageMenu } from './pagemenu.ts';
import { mainMessages } from './messages.ts';

export function attachPageMenu(contents: WebContents): void {
	contents.on('context-menu', (event, params) => {
		const items = pageMenu(params, {
			openInBrowser: url => { shell.openExternal(url); },
			copyText: text => clipboard.writeText(text),
			copyImage: () => contents.copyImageAt(params.x, params.y),
			cut: () => contents.cut(),
			copy: () => contents.copy(),
			paste: () => contents.paste(),
			replaceMisspelling: word => contents.replaceMisspelling(word),
			addToDictionary: word => { contents.session.addWordToSpellCheckerDictionary(word); }
		}, mainMessages());
		if ( items.length ) Menu.buildFromTemplate(items).popup();
	});
}
