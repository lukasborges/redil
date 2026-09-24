export function initials(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	const [first = '?', second] = words;
	return (second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2)).toUpperCase();
}
