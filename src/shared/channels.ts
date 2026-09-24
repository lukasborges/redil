export const INVOKE_CHANNELS = ['app:getVersion'] as const;
export const EVENT_CHANNELS = [] as const;

export type InvokeChannel = (typeof INVOKE_CHANNELS)[number];
export type EventChannel = (typeof EVENT_CHANNELS)[number];
