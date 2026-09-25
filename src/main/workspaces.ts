import { dialog, Menu, type BrowserWindow } from 'electron';
import { WORKSPACE_ICONS, hueOf, workspaceForNumber, type ActiveWorkspace, type Workspace, type WorkspaceIcon } from '../shared/workspace.ts';
import { store } from './store.ts';
import { workspaceMenu } from './workspacemenu.ts';
import type { ServiceHost } from './services.ts';
import { mainMessages } from './messages.ts';
import { fill } from '../shared/i18n/index.ts';

export class Workspaces {
	constructor(
		private readonly window: BrowserWindow,
		private readonly services: ServiceHost,
		private readonly askForName: (id: string | null) => void,
		private readonly askForIcon: (id: string) => void
	) {}

	list(): Workspace[] {
		return store.get('workspaces');
	}

	choose(workspace: ActiveWorkspace): void {
		this.services.showWorkspace(workspace);
	}

	chooseNumber(index: number): void {
		const workspace = workspaceForNumber(index, this.list());
		if ( workspace !== undefined ) this.choose(workspace);
	}

	// A new workspace takes an icon at random, and becomes the one on screen.
	save(id: string | null, name: string): void {
		const trimmed = name.trim();
		if ( !trimmed ) return;
		if ( id ) {
			store.set('workspaces', this.list().map(workspace => workspace.id === id ? { ...workspace, name: trimmed } : workspace));
			this.services.showWorkspace(store.get('activeWorkspace'));
			return;
		}
		const icon = WORKSPACE_ICONS[Math.floor(Math.random() * WORKSPACE_ICONS.length)] ?? 'briefcase';
		const created: Workspace = { id: 'w' + Date.now().toString(36), name: trimmed, icon, hue: hueOf(icon) };
		store.set('workspaces', [...this.list(), created]);
		this.choose(created.id);
	}

	// The initials keep the hue the workspace had.
	setIcon(id: string, icon: WorkspaceIcon | null): void {
		store.set('workspaces', this.list().map(workspace => workspace.id !== id ? workspace
			: { ...workspace, icon, hue: icon ? hueOf(icon) : workspace.hue }));
		this.services.showWorkspace(store.get('activeWorkspace'));
	}

	// Its services stay, in no workspace, which puts them in every one.
	async remove(id: string): Promise<void> {
		const workspace = this.list().find(candidate => candidate.id === id);
		if ( !workspace ) return;
		const messages = mainMessages();
		const { response } = await dialog.showMessageBox(this.window, {
			type: 'question', buttons: [messages['deleteWorkspace.confirm'], messages['dialog.cancel']], defaultId: 1, cancelId: 1,
			message: fill(messages['deleteWorkspace.message'], { name: workspace.name }), detail: messages['deleteWorkspace.detail']
		});
		if ( response !== 0 ) return;
		store.set('services', store.get('services').map(service => service.workspace === id ? { ...service, workspace: '' } : service));
		store.set('workspaces', this.list().filter(candidate => candidate.id !== id));
		this.choose(null);
	}

	showMenu(): void {
		const items = workspaceMenu(this.list(), store.get('activeWorkspace'), {
			choose: workspace => this.choose(workspace),
			create: () => this.askForName(null),
			rename: id => this.askForName(id),
			changeIcon: id => this.askForIcon(id),
			remove: id => { this.remove(id); }
		}, mainMessages());
		Menu.buildFromTemplate(items).popup({ window: this.window });
	}
}
