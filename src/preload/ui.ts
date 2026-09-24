import { contextBridge, ipcRenderer } from 'electron';
import { INVOKE_CHANNELS, type InvokeChannel } from '../shared/channels.ts';
import type { ShepBridge } from './api.ts';

function assertExposed(channel: string): asserts channel is InvokeChannel {
	if ( !(INVOKE_CHANNELS as readonly string[]).includes(channel) ) {
		throw new Error('This channel is not exposed to the renderer: ' + channel);
	}
}

const bridge: ShepBridge = {
	invoke(channel, ...args) {
		assertExposed(channel);
		return ipcRenderer.invoke(channel, ...args);
	},
	locale: navigator.language
};

contextBridge.exposeInMainWorld('shep', bridge);
