/** Time fields for the media tools: "75", "1:15", "01:01:15.5", Arabic digits and commas are fine. */
export function parseTime(text: string): number | null {
	const s = text
		.trim()
		.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
		.replace(/[٫,]/g, '.')
		.replace(/[؛：]/g, ':');
	if (!s) return null;
	if (!/^\d+(\.\d+)?$|^\d+(:\d{1,2}){1,2}(\.\d+)?$/.test(s)) return NaN;
	return s.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
}

/** 83.5 → "1:23.5" (for file names and messages). */
export function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds - m * 60;
	const ss = (Math.round(s * 10) / 10).toString();
	return `${m}:${s < 10 ? '0' : ''}${ss}`;
}

/** The base name and extension of a file name. */
export function splitName(name: string): [string, string] {
	const dot = name.lastIndexOf('.');
	return dot > 0 ? [name.slice(0, dot), name.slice(dot + 1).toLowerCase()] : [name, ''];
}
