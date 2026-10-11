import { error } from '@sveltejs/kit';
import { isLang } from '#lib/i18n/index.ts';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = ({ params }) => {
	if (!isLang(params.lang)) error(404);
	return { lang: params.lang };
};
