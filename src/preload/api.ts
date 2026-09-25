import type { EventChannel, InvokeChannel } from '../shared/channels.ts';

export interface ShepBridge {
	invoke(channel: InvokeChannel, ...args: unknown[]): Promise<unknown>;
	// undefined, not void: the bridge clones what a listener returns, and a Svelte proxy cannot be cloned
	on(channel: EventChannel, listener: (...args: unknown[]) => undefined): () => void;
	readonly locale: string;
}

declare global {
	interface Window {
		shep: ShepBridge;
	}
}
