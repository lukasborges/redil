export interface PageClick {
	linkURL: string;
	linkText: string;
	srcURL: string;
	hasImageContents: boolean;
	selectionText: string;
	isEditable: boolean;
	inputFieldType?: string;
	misspelledWord: string;
	dictionarySuggestions: string[];
	editFlags: { canCut: boolean; canCopy: boolean; canPaste: boolean };
}

export interface PageActions {
	openInBrowser(url: string): void;
	copyText(text: string): void;
	copyImage(): void;
	cut(): void;
	copy(): void;
	paste(): void;
	replaceMisspelling(word: string): void;
	addToDictionary(word: string): void;
}

export interface PageMenuItem {
	label?: string;
	type?: 'separator';
	enabled?: boolean;
	accelerator?: string;
	click?: () => void;
}

const SEPARATOR: PageMenuItem = { type: 'separator' };
const MAX_SPELLING_SUGGESTIONS = 5;
const SEARCH_ENGINE = 'https://www.google.com/search?q=';

const holdsAWord = (text: string) => /\p{L}/u.test(text);

function searchItems(click: PageClick, actions: PageActions): PageMenuItem[] {
	if ( !click.selectionText || !holdsAWord(click.selectionText) ) return [];
	return [{ label: 'Search with Google', click: () => actions.openInBrowser(SEARCH_ENGINE + encodeURIComponent(click.selectionText)) }, SEPARATOR];
}

function spellingItems(click: PageClick, actions: PageActions): PageMenuItem[] {
	if ( !click.misspelledWord ) return [];
	const suggestions: PageMenuItem[] = click.dictionarySuggestions.slice(0, MAX_SPELLING_SUGGESTIONS)
		.map(word => ({ label: word, click: () => actions.replaceMisspelling(word) }));
	if ( !suggestions.length ) suggestions.push({ label: 'No Spelling Suggestions', enabled: false });
	return [...suggestions, SEPARATOR, { label: 'Add to Dictionary', click: () => actions.addToDictionary(click.misspelledWord) }, SEPARATOR];
}

function imageItems(click: PageClick, actions: PageActions): PageMenuItem[] {
	return [
		{ label: 'Copy Image', click: () => actions.copyImage() },
		{ label: 'Copy Image URL', click: () => actions.copyText(click.srcURL) }
	];
}

export function pageMenu(click: PageClick, actions: PageActions): PageMenuItem[] {
	if ( click.linkURL ) {
		const isEmailAddress = click.linkURL.startsWith('mailto:');
		const items: PageMenuItem[] = [
			{ label: isEmailAddress ? 'Copy Email Address' : 'Copy Link', click: () => actions.copyText(isEmailAddress ? click.linkText : click.linkURL) },
			{ label: 'Open Link in Browser', click: () => actions.openInBrowser(click.linkURL) }
		];
		if ( click.srcURL ) items.push(SEPARATOR, ...imageItems(click, actions));
		return items;
	}

	const isImageWorthCopying = click.hasImageContents && click.srcURL.length > 1;
	if ( isImageWorthCopying ) return imageItems(click, actions);

	const isTextField = click.isEditable || (!!click.inputFieldType && click.inputFieldType !== 'none');
	if ( isTextField ) {
		return [
			...spellingItems(click, actions),
			...searchItems(click, actions),
			{ label: 'Cut', accelerator: 'CommandOrControl+X', enabled: click.editFlags.canCut, click: () => actions.cut() },
			{ label: 'Copy', accelerator: 'CommandOrControl+C', enabled: click.editFlags.canCopy, click: () => actions.copy() },
			{ label: 'Paste', accelerator: 'CommandOrControl+V', enabled: click.editFlags.canPaste, click: () => actions.paste() }
		];
	}

	return [...searchItems(click, actions), { label: 'Copy', accelerator: 'CommandOrControl+C', enabled: click.editFlags.canCopy, click: () => actions.copy() }];
}
