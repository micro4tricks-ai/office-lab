import { error } from '@sveltejs/kit';
import { tools, toolById } from '#lib/registry/tools.ts';
import { LANGS } from '#lib/registry/types.ts';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () =>
	LANGS.flatMap((lang) => tools.map((t) => ({ lang, tool: t.id })));

export const load: PageLoad = ({ params }) => {
	if (!toolById(params.tool)) error(404);
	return { toolId: params.tool };
};
