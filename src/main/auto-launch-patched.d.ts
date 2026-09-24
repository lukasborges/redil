declare module 'auto-launch-patched' {
	export default class AutoLaunch {
		constructor(options: { name: string; path?: string; isHidden?: boolean });
		enable(): Promise<void>;
		disable(): Promise<void>;
	}
}
