/**
 * Files handed from one page to the next (the Share menu → a tool or a chain). Kept in memory:
 * client-side navigation keeps this module alive, a reload empties it.
 */
let pending: File[] = [];

export function handOff(files: File[]) {
	pending = files;
}

/** The waiting files, once (the receiver owns them after this). */
export function takeHandoff(): File[] {
	const files = pending;
	pending = [];
	return files;
}
