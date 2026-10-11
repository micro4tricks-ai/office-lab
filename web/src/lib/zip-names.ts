/**
 * A ZIP entry name that stays inside the archive's folder when extracted ("zip-slip" guard):
 * no "..", ".", empty or absolute segments, no drive letters, backslashes or control characters.
 * "a/../../etc/x" → "a/etc/x", "C:\\evil\\x.png" → "C_/evil/x.png".
 */
export function safeEntryName(name: string): string {
	const parts = name
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u001f]/g, '')
		.split(/[\\/]+/)
		.map((p) => p.replace(/:/g, '_').trim())
		.filter((p) => p && p !== '.' && p !== '..');
	return parts.join('/') || 'file';
}
