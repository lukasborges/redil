import { join } from 'node:path';
import { WebContentsView, type BrowserWindow } from 'electron';

export type OverlayDialog =
	| { dialog: 'add' }
	| { dialog: 'edit'; serviceId: string }
	| { dialog: 'workspace'; workspaceId: string | null };

// Dialogs live in a view of their own because a WebContentsView paints over the
// window's own page, so a dialog drawn there would sit behind the service.
export class Overlay {
	private view: WebContentsView | null = null;
	private loaded: Promise<void> | null = null;

	constructor(private readonly window: BrowserWindow, private readonly onClose: () => void, private readonly onCreate: (contents: Electron.WebContents) => void) {
		window.on('resize', () => this.fit());
	}

	async open(dialog: OverlayDialog): Promise<void> {
		const view = this.ensure();
		await this.loaded;
		this.window.contentView.addChildView(view);
		this.fit();
		view.setVisible(true);
		view.webContents.focus();
		view.webContents.send('overlay:show', dialog);
	}

	close(): void {
		this.view?.setVisible(false);
		this.onClose();
	}

	contents() {
		return this.view?.webContents;
	}

	private fit(): void {
		const [width = 0, height = 0] = this.window.getContentSize();
		this.view?.setBounds({ x: 0, y: 0, width, height });
	}

	private ensure(): WebContentsView {
		if ( this.view ) return this.view;
		const view = new WebContentsView({
			webPreferences: { preload: join(__dirname, '../preload/ui.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
		});
		view.setBackgroundColor('#00000000');
		view.setVisible(false);
		this.onCreate(view.webContents);
		const address = process.env.ELECTRON_RENDERER_URL;
		this.loaded = (address ? view.webContents.loadURL(address + '#overlay') : view.webContents.loadFile(join(__dirname, '../ui/index.html'), { hash: 'overlay' })).then(() => {});
		this.view = view;
		return view;
	}
}
