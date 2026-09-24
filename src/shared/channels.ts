export const INVOKE_CHANNELS = ['app:getVersion', 'services:list', 'services:activate'] as const;
export const EVENT_CHANNELS = ['services:changed', 'services:certificate-error'] as const;

export type InvokeChannel = (typeof INVOKE_CHANNELS)[number];
export type EventChannel = (typeof EVENT_CHANNELS)[number];
