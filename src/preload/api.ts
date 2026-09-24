import type { InvokeChannel } from '../shared/channels.ts';

export interface ShepBridge {
	invoke(channel: InvokeChannel, ...args: unknown[]): Promise<unknown>;
	readonly locale: string;
}

declare global {
	interface Window {
		shep: ShepBridge;
	}
}
