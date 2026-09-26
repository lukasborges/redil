import { desktopCapturer, type Session } from 'electron';

export interface PickedSource {
	id: string;
	name: string;
	thumbnail: string;
}

const THUMBNAIL = { width: 320, height: 180 };

// On Wayland the portal's own dialog opens as soon as sources are asked for, and its answer is the one stream
// already chosen; on X11 nothing asks, so the app's picker does.
const theSystemPicks = () => process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY;

export function answerScreenSharing(session: Session, pick: (sources: PickedSource[]) => Promise<string | null>): void {
	session.setDisplayMediaRequestHandler(async (request, answer) => {
		// No arguments is how a request is refused; an empty object makes Electron throw and takes the app down.
		const refuse = () => (answer as (streams?: Electron.Streams) => void)();
		const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: THUMBNAIL });
		// an empty list is also what a cancelled portal dialog looks like
		if ( !sources.length ) return refuse();
		if ( theSystemPicks() ) return answer({ video: sources[0] });
		const chosen = await pick(sources.map(source => ({ id: source.id, name: source.name, thumbnail: source.thumbnail.toDataURL() })));
		const source = sources.find(candidate => candidate.id === chosen);
		if ( source ) answer({ video: source });
		else refuse();
	},
	// A Mac from 15 on has a picker of its own, and asks for the screen recording permission as it opens it.
	{ useSystemPicker: true });
}
