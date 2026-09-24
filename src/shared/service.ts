// '•' is a title saying there is something without saying how much.
export type UnreadCount = number | '•';

export interface ServiceRecord {
	id: string;
	name: string;
	url: string;
	// persist:service-<id>: another name is another session, signed out, and the Ext app's were persist:<type>_<id>.
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
	canGoBack: boolean;
	canGoForward: boolean;
	loading: boolean;
	workspace: string;
	shown: boolean;
}
