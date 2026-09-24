import { en } from './en.ts';
import { ptBR } from './pt-BR.ts';
import { es } from './es.ts';
import { fr } from './fr.ts';
import { de } from './de.ts';
import { it } from './it.ts';
import { ru } from './ru.ts';
import { ja } from './ja.ts';
import { zhCN } from './zh-CN.ts';
import { ko } from './ko.ts';

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

export const CATALOGUES: Record<string, Messages> = { en, 'pt-BR': ptBR, es, fr, de, it, ru, ja, 'zh-CN': zhCN, ko };

// The exact locale, then its language, then another region of that language: pt-PT reads pt-BR before English.
export function messagesFor(locale: string): Messages {
	const language = locale.split('-')[0] ?? '';
	const sameLanguage = Object.keys(CATALOGUES).find(key => key.split('-')[0] === language);
	return CATALOGUES[locale] ?? CATALOGUES[language] ?? (sameLanguage ? CATALOGUES[sameLanguage] : undefined) ?? en;
}

// {name}-style placeholders, filled in; one without a value is left as written.
export function fill(message: string, values: Record<string, string | number>): string {
	return message.replace(/\{(\w+)\}/g, (whole, key: string) => key in values ? String(values[key]) : whole);
}
