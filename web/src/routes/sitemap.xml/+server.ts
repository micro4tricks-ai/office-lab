import { sitemap } from '#lib/seo.ts';

export const prerender = true;

export const GET = () => new Response(sitemap(), { headers: { 'content-type': 'application/xml' } });
