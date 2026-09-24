import { contextBridge, ipcRenderer } from 'electron';
import { EVENT_CHANNELS, INVOKE_CHANNELS, type EventChannel, type InvokeChannel } from '../shared/channels.ts';
import type { ShepBridge } from './api.ts';

function assertExposed<T extends string>(allowed: readonly T[], channel: string): asserts channel is T {
	if ( !(allowed as readonly string[]).includes(channel) ) {
		throw new Error('This channel is not exposed to the renderer: ' + channel);
	}
}

const bridge: ShepBridge = {
	invoke(channel, ...args) {
		assertExposed<InvokeChannel>(INVOKE_CHANNELS, channel);
		return ipcRenderer.invoke(channel, ...args);
	},
	on(channel, listener) {
		assertExposed<EventChannel>(EVENT_CHANNELS, channel);
		const forward = (event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args);
		ipcRenderer.on(channel, forward);
		return () => { ipcRenderer.removeListener(channel, forward); };
	},
	locale: navigator.language
};

contextBridge.exposeInMainWorld('shep', bridge);
