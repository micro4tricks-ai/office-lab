import { LANGS } from '#lib/registry/types.ts';
import type { EntryGenerator } from './$types';

// Not linked from anywhere (the Share menu opens it), so list it for prerendering.
export const entries: EntryGenerator = () => LANGS.map((lang) => ({ lang }));
