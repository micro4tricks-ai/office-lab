# Office Lab / «المعمل» — notes for Claude

Open-source, privacy-first file converter for offices. Arabic-first (RTL), English second.
Spec: `docs/BUILD_PROMPT.md`. State + next step: `docs/PROGRESS.md`.

## Session rules (summary of BUILD_PROMPT §2)
- Start by reading only this file, `docs/PROGRESS.md`, and the current phase in `docs/BUILD_PROMPT.md`.
- Never read `node_modules`, `build`, `.svelte-kit`, lockfiles, WASM/binaries, big fixtures. Pipe long output through `tail -n 40`.
- One phase per session. When acceptance passes: update PROGRESS.md, commit, push, stop with a ≤8-line summary.
- Every tool lives ONLY in `web/src/lib/registry/tools.ts`; UI, routes and SEO pages come from it.
- Engines: one adapter per file in `web/src/lib/adapters/`, registered in `adapters/index.ts` (`engines` map, lazy import). Conversions run in `workers/convert.worker.ts`.
- Lazy-load heavy libs; first load < 300 KB JS. No third-party CDNs at runtime — self-host fonts/WASM/models.
- All UI strings in `web/src/lib/i18n/{ar,en}.json` (same keys — a unit test checks it).
- Run the tests before claiming anything works. Commit per task, push at phase end.

## SvelteKit 3 gotchas (this repo)
- Kit config lives in `web/vite.config.ts` (`sveltekit({...})`), no `svelte.config.js`.
- `#lib/...` imports need the real extension: `#lib/i18n/index.ts`, `#lib/config.ts`.
- `Handle` type comes from `@sveltejs/kit/hooks`. `page.url.search` is not allowed in prerendered pages.
- Git Bash on Windows mangles `/office-lab`: prefix commands with `MSYS_NO_PATHCONV=1`.
- `vite preview` keeps serving the build it started with: restart it after every build (Playwright reuses a running one locally).
- Workers have no `document`: pdf.js needs the OffscreenCanvas factories in `adapters/pdf/pdfjs.ts`; pdf-lib can't shape Arabic (draw text as PNG via `adapters/text-image.ts`).

## Commands (run in `web/`)
```
npm run dev                                   # local dev at /
MSYS_NO_PATHCONV=1 BASE_PATH=/office-lab npm run build   # Pages-style build → web/build
npm run check                                 # svelte-check
npx vitest run                                # unit tests
MSYS_NO_PATHCONV=1 BASE_PATH=/office-lab npx playwright test   # e2e (needs a build first)
```

## Server version (Phase 4) — Docker Desktop is installed on this PC (WSL2)
- Git Bash needs `export PATH="$PATH:/c/Program Files/Docker/Docker/resources/bin"` for `docker`.
- Server code: `server/app` (tools in `app/tools/*.py`, ids = web registry ids; a vitest keeps them in step).
- `cd server && .venv/Scripts/python -m pytest -q` → API tests (tool tests skip without converters).
- Full stack: `docker compose -f deploy/docker-compose.yml up -d --build` → http://localhost.
- Tool tests in the container: `docker build --target test -t office-lab-api:test server` then
  `docker run --rm --network office-lab_internal office-lab-api:test` (stack up first).
- e2e against the stack: `cd web && E2E_URL=http://localhost/ npx playwright test`.
- Extract text from OCR'd Arabic PDFs with poppler (`pdftotext`), not PyMuPDF (it gives drawing order).

## Deploy
- Push to `main` → CI (`ci.yml`) → only if green, `pages.yml` deploys → https://micro4tricks-ai.github.io/office-lab/
- Runners pinned to `ubuntu-24.04` (not `ubuntu-latest`) so image migrations do not break CI by surprise.
- `PUBLIC_API_URL` empty = no server; server tools show «متاحة في نسخة الخادم».
