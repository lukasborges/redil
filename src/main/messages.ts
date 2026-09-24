import { app } from 'electron';
import { messagesFor, type Messages } from '../shared/i18n/index.ts';
import { preferences } from './store.ts';

export function resolvedLanguage(): string {
	const { language } = preferences();
	return language === 'auto' ? app.getLocale() : language;
}

export function mainMessages(): Messages {
	return messagesFor(resolvedLanguage());
}
