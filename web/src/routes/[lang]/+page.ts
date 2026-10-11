import { LANGS } from '#lib/registry/types.ts';
import type { EntryGenerator } from './$types';

export const entries: EntryGenerator = () => LANGS.map((lang) => ({ lang }));
