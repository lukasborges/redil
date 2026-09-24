const en = {
	'welcome.title': 'Welcome to Shep',
	'welcome.body': 'Add a service with the + in the bar on the left.',
	'rail.add': 'Add a service'
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

const catalogues: Record<string, Messages> = { en };

export function messagesFor(locale: string): Messages {
	return catalogues[locale] ?? catalogues[locale.split('-')[0] ?? ''] ?? en;
}
