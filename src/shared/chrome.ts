export const TITLE_BAR_HEIGHT = 32;

// The rail and the title bar, which the system's window buttons are painted over,
// so main needs the same values as the stylesheet.
export const CHROME_COLOURS = {
	light: { chrome: '#24506F', onChrome: '#E8F1F8' },
	dark: { chrome: '#2A2A2E', onChrome: '#D0D0D6' }
} as const;

export type ColourScheme = keyof typeof CHROME_COLOURS;
