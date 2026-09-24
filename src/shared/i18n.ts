const en = {
	'welcome.title': 'Welcome to Shep',
	'welcome.body': 'Add a service with the + in the bar on the left.',
	'rail.add': 'Add a service',
	'rail.dontDisturb': "Don't Disturb",
	'rail.dontDisturb.on': "Don't Disturb is on",
	'titlebar.back': 'Back',
	'titlebar.forward': 'Forward',
	'titlebar.reload': 'Reload',
	'titlebar.find': 'Find in page',
	'find.placeholder': 'Find in page',
	'find.previous': 'Previous match',
	'find.next': 'Next match',
	'find.none': 'No matches',
	'dialog.add.title': 'Add a Service',
	'dialog.edit.title': 'Edit Service',
	'dialog.address': 'Address',
	'dialog.address.placeholder': 'web.whatsapp.com',
	'dialog.address.invalid': 'Type the address of the service, such as web.whatsapp.com',
	'dialog.name': 'Name',
	'dialog.name.placeholder': 'Taken from the address when left empty',
	'dialog.cancel': 'Cancel',
	'dialog.add': 'Add',
	'dialog.save': 'Save'
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

const catalogues: Record<string, Messages> = { en };

export function messagesFor(locale: string): Messages {
	return catalogues[locale] ?? catalogues[locale.split('-')[0] ?? ''] ?? en;
}
