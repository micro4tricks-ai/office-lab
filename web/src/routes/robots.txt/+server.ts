import { robots } from '#lib/seo.ts';

export const prerender = true;

export const GET = () => new Response(robots(), { headers: { 'content-type': 'text/plain' } });
