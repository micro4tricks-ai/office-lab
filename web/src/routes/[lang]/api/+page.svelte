<script lang="ts">
	import Seo from '#lib/components/Seo.svelte';
	import { API_URL } from '#lib/config.ts';
	import { t } from '#lib/i18n/index.ts';
	import { tools } from '#lib/registry/tools.ts';
	import type { OptionSpec } from '#lib/registry/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const lang = $derived(data.lang);

	// Every server tool, straight from the registry (ids and options match server/app/tools).
	const serverTools = tools.filter((x) => x.runtime === 'server' && x.from.length > 0);
	const host = API_URL || 'https://your-server';

	function values(o: OptionSpec): string {
		if (o.type === 'select') return o.choices.map((c) => c.value).join(' | ');
		if (o.type === 'checkbox') return 'true | false';
		if (o.type === 'range' || o.type === 'number') return `${o.min}–${o.max}`;
		return o.type;
	}
	const curl = `curl -X POST ${host}/api/convert/word-to-pdf \\
  -H "Authorization: Bearer olab_…" \\
  -F "file=@report.docx" \\
  -F 'options={"pdfa": true}' \\
  -o report.pdf`;
	const errors = ['wrong-type', 'too-big', 'password', 'corrupted', 'bad-options', 'bad-key', 'not-found', 'busy', 'timeout'];
</script>

<Seo {lang} title="{t(lang, 'api.title')} — {t(lang, 'app.name')}" desc={t(lang, 'api.desc')} path="api/" />

<article class="container prose">
	<h1>{t(lang, 'api.title')}</h1>
	<p class="lead">{t(lang, 'api.lead')}</p>

	<h2>{t(lang, 'api.auth.h')}</h2>
	<p>{t(lang, 'api.auth.p')}</p>
	<pre dir="ltr"><code>Authorization: Bearer olab_…</code></pre>

	<h2>{t(lang, 'api.call.h')}</h2>
	<p>{t(lang, 'api.call.p')}</p>
	<pre dir="ltr"><code>{curl}</code></pre>
	<ul>
		<li dir="ltr"><code>GET /api/capabilities</code> — {t(lang, 'api.capabilities')}</li>
		<li dir="ltr"><code>POST /api/convert/&lbrace;tool&rbrace;</code> — {t(lang, 'api.convert')}</li>
	</ul>

	<h2>{t(lang, 'api.errors.h')}</h2>
	<p>{t(lang, 'api.errors.p')}</p>
	<p dir="ltr" class="codes">{#each errors as e (e)}<code>{e}</code> {/each}</p>

	<h2>{t(lang, 'api.tools.h', { n: serverTools.length })}</h2>
	<div class="scroll">
		<table>
			<thead>
				<tr><th>{t(lang, 'api.col.tool')}</th><th>{t(lang, 'api.col.in')}</th><th>{t(lang, 'api.col.options')}</th></tr>
			</thead>
			<tbody>
				{#each serverTools as tool (tool.id)}
					<tr>
						<td><code dir="ltr">{tool.id}</code><br /><small>{tool.i18n[lang].title}</small></td>
						<td dir="ltr"><small>{tool.from.filter((f) => !f.includes('/')).join(', ')}</small></td>
						<td dir="ltr">
							{#each tool.options ?? [] as o (o.id)}
								<div><code>{o.id}</code>: <small>{values(o)} (default {String(o.default)})</small></div>
							{:else}
								—
							{/each}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p>{t(lang, 'api.browser')}</p>
</article>

<style>
	pre {
		overflow-x: auto;
		padding: var(--space-4);
		border-radius: var(--radius);
		background: var(--surface-2);
		border: 1px solid var(--border);
		font-size: 0.85rem;
		line-height: 1.6;
		text-align: left;
	}
	.codes code {
		margin-inline-end: 0.5rem;
	}
	.scroll {
		overflow-x: auto;
	}
	table {
		border-collapse: collapse;
		width: 100%;
		font-size: 0.9rem;
	}
	th,
	td {
		border-bottom: 1px solid var(--border);
		padding: 0.5rem;
		vertical-align: top;
		text-align: start;
	}
	td[dir='ltr'] {
		text-align: left;
	}
</style>
