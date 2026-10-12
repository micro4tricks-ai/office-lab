import { manifest } from '#lib/pwa.ts';
import { BASE } from '#lib/seo.ts';

export const prerender = true;

export const GET = () =>
	new Response(JSON.stringify(manifest(BASE), null, '\t'), { headers: { 'content-type': 'application/manifest+json' } });
