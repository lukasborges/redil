'use strict';

const { Menu, clipboard, shell } = require('electron');

// Rebuilt from vendor/electron-contextmenu-wrapper, whose upstream was archived
// and which drew the menu inside the renderer over @electron/remote. Electron
// reports the click here first, so the menu is built where the webContents
// already is and nothing has to cross back.
//
// Two differences from the package this replaces, both deliberate. It pointed
// cut, copy and paste at getCurrentWindow(), so a click inside a service acted
// on the host window rather than on the service; here the target is whichever
// webContents reported the click. And it copied an image by drawing it into a
// canvas and writing the data URL, which only worked when the server allowed
// the cross origin read; Electron copies the image itself.

// A selection is only worth offering to search when it holds letters. The
// original carried a hand written Unicode letter class to decide this.
const holdsAWord = text => /\p{L}/u.test(text);

// At most 25 characters, cut on a word boundary, as the original did.
function truncate(text) {
	const match = text.match(/^.{0,25}[\S]*/);
	const shortened = match[0].replace(/\s$/, '');
	return match[0].length < text.length ? shortened + '…' : shortened;
}

function searchItems(contents, params) {
	const selection = params.selectionText;
	if ( !selection || !holdsAWord(selection) ) return [];

	const items = [];
	if ( process.platform === 'darwin' ) {
		items.push({
			 label: 'Look Up "' + truncate(selection) + '"'
			,click: () => contents.showDefinitionForSelection()
		});
	}
	items.push({
		 label: 'Search with Google'
		,click: () => shell.openExternal('https://google.com/search?q=' + encodeURIComponent(selection))
	});
	items.push({ type: 'separator' });
	return items;
}

function imageItems(contents, params) {
	return [
		 { label: 'Copy Image', click: () => contents.copyImageAt(params.x, params.y) }
		,{ label: 'Copy Image URL', click: () => clipboard.writeText(params.srcURL) }
	];
}

function editItem(label, accelerator, enabled, action) {
	return { label: label, accelerator: accelerator, enabled: enabled, click: action };
}

function template(contents, params) {
	if ( params.linkURL ) {
		const isEmailAddress = params.linkURL.startsWith('mailto:');
		const items = [
			{
				 label: isEmailAddress ? 'Copy Email Address' : 'Copy Link'
				// Omit the mailto: portion of the link; we just want the address
				,click: () => clipboard.writeText(isEmailAddress ? params.linkText : params.linkURL)
			}
			,{ label: 'Open Link', click: () => shell.openExternal(params.linkURL) }
		];
		if ( params.srcURL ) items.push({ type: 'separator' }, ...imageItems(contents, params));
		return items;
	}

	if ( params.hasImageContents && params.srcURL && params.srcURL.length > 1 ) {
		return imageItems(contents, params);
	}

	if ( params.isEditable || (params.inputFieldType && params.inputFieldType !== 'none') ) {
		return [
			 ...searchItems(contents, params)
			,editItem('Cut', 'CommandOrControl+X', params.editFlags.canCut, () => contents.cut())
			,editItem('Copy', 'CommandOrControl+C', params.editFlags.canCopy, () => contents.copy())
			,editItem('Paste', 'CommandOrControl+V', params.editFlags.canPaste, () => contents.paste())
		];
	}

	return [
		 ...searchItems(contents, params)
		,editItem('Copy', 'CommandOrControl+C', params.editFlags.canCopy, () => contents.copy())
	];
}

const attach = contents => contents.on('context-menu', (event, params) => {
	const items = template(contents, params);
	if ( items.length ) Menu.buildFromTemplate(items).popup();
});

module.exports = { attach, template };
