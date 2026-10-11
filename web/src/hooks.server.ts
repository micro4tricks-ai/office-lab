import type { Handle } from '@sveltejs/kit/hooks';

// Prerender time: put the right lang/dir on <html> so RTL is correct before JS runs.
export const handle: Handle = ({ event, resolve }) => {
	const lang = event.params.lang === 'en' ? 'en' : 'ar';
	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%lang%', lang).replace('%dir%', lang === 'ar' ? 'rtl' : 'ltr')
	});
};
