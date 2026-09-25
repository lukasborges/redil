export const CHROMIUM_ZOOM_FACTOR_PER_LEVEL = 1.2;

export function zoomPercent(level: number): number {
	return Math.round(100 * Math.pow(CHROMIUM_ZOOM_FACTOR_PER_LEVEL, level));
}
