// '•' is a title saying there is something without saying how much.
export type UnreadCount = number | '•';

export interface ServiceRecord {
	id: string;
	name: string;
	url: string;
	// persist:<type>_<id>, as Shep 0.10 named it: another name is another session, signed out.
	partition: string;
	workspace: string;
	enabled: boolean;
	notifications: boolean;
	muted: boolean;
	media: boolean;
	trust: boolean;
	zoomLevel: number;
	favicon: string;
}

export interface ServiceState {
	id: string;
	name: string;
	favicon: string;
	enabled: boolean;
	unread: UnreadCount;
	pageTitle: string;
	active: boolean;
}
