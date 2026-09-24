import type { Messages } from '../shared/i18n/index.ts';

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

function searchItems(click: PageClick, actions: PageActions, messages: Messages): PageMenuItem[] {
	if ( !click.selectionText || !holdsAWord(click.selectionText) ) return [];
	return [{ label: messages['menu.search'], click: () => actions.openInBrowser(SEARCH_ENGINE + encodeURIComponent(click.selectionText)) }, SEPARATOR];
}

function spellingItems(click: PageClick, actions: PageActions, messages: Messages): PageMenuItem[] {
	if ( !click.misspelledWord ) return [];
	const suggestions: PageMenuItem[] = click.dictionarySuggestions.slice(0, MAX_SPELLING_SUGGESTIONS)
		.map(word => ({ label: word, click: () => actions.replaceMisspelling(word) }));
	if ( !suggestions.length ) suggestions.push({ label: messages['menu.noSuggestions'], enabled: false });
	return [...suggestions, SEPARATOR, { label: messages['menu.addToDictionary'], click: () => actions.addToDictionary(click.misspelledWord) }, SEPARATOR];
}

function imageItems(click: PageClick, actions: PageActions, messages: Messages): PageMenuItem[] {
	return [
		{ label: messages['menu.copyImage'], click: () => actions.copyImage() },
		{ label: messages['menu.copyImageUrl'], click: () => actions.copyText(click.srcURL) }
	];
}

export function pageMenu(click: PageClick, actions: PageActions, messages: Messages): PageMenuItem[] {
	if ( click.linkURL ) {
		const isEmailAddress = click.linkURL.startsWith('mailto:');
		const items: PageMenuItem[] = [
			{ label: isEmailAddress ? messages['menu.copyEmail'] : messages['menu.copyLink'], click: () => actions.copyText(isEmailAddress ? click.linkText : click.linkURL) },
			{ label: messages['menu.openInBrowser'], click: () => actions.openInBrowser(click.linkURL) }
		];
		if ( click.srcURL ) items.push(SEPARATOR, ...imageItems(click, actions, messages));
		return items;
	}

	const isImageWorthCopying = click.hasImageContents && click.srcURL.length > 1;
	if ( isImageWorthCopying ) return imageItems(click, actions, messages);

	const isTextField = click.isEditable || (!!click.inputFieldType && click.inputFieldType !== 'none');
	if ( isTextField ) {
		return [
			...spellingItems(click, actions, messages),
			...searchItems(click, actions, messages),
			{ label: messages['menu.cut'], accelerator: 'CommandOrControl+X', enabled: click.editFlags.canCut, click: () => actions.cut() },
			{ label: messages['menu.copy'], accelerator: 'CommandOrControl+C', enabled: click.editFlags.canCopy, click: () => actions.copy() },
			{ label: messages['menu.paste'], accelerator: 'CommandOrControl+V', enabled: click.editFlags.canPaste, click: () => actions.paste() }
		];
	}

	return [...searchItems(click, actions, messages), { label: messages['menu.copy'], accelerator: 'CommandOrControl+C', enabled: click.editFlags.canCopy, click: () => actions.copy() }];
}
