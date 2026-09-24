import type { EventChannel, InvokeChannel } from '../shared/channels.ts';

export interface ShepBridge {
	invoke(channel: InvokeChannel, ...args: unknown[]): Promise<unknown>;
	on(channel: EventChannel, listener: (...args: unknown[]) => void): () => void;
	readonly locale: string;
}

declare global {
	interface Window {
		shep: ShepBridge;
	}
}
