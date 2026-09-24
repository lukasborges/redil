export const INVOKE_CHANNELS = [
	'app:getVersion',
	'services:list', 'services:activate', 'services:add', 'services:update', 'services:reorder', 'services:menu', 'services:record',
	'service:navigate', 'service:find', 'service:stopFind',
	'overlay:open', 'overlay:close'
] as const;
export const EVENT_CHANNELS = ['services:changed', 'services:certificate-error', 'services:hover', 'services:found', 'overlay:show'] as const;

export type InvokeChannel = (typeof INVOKE_CHANNELS)[number];
export type EventChannel = (typeof EVENT_CHANNELS)[number];
