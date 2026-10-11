# Progress
Current phase: 1 — Images

## Done
- [x] Phase 0 (2026-10-11) — scaffold, registry, worker runner, UI shell, CI + Pages. Pages: https://micro4tricks-ai.github.io/office-lab/

## Phase 0 checklist
- [x] repo layout, CLAUDE.md, LICENSE (AGPL-3.0), README, docs/BUILD_PROMPT.md
- [x] SvelteKit static, ar/en switch (dir flips), dark/light, responsive 360px → desktop
- [x] home: search + category grid from the registry (1 dummy tool: `txt-to-html`)
- [x] drop zone / file picker, progress bar, result list, download one / all as ZIP
- [x] ci.yml + pages.yml (actions pinned by SHA)
- [x] tests: 6 vitest, 18 playwright (desktop + mobile, incl. axe a11y); Lighthouse a11y 100 on ar/, en/, tool page

## Phase 1 checklist
- [ ] image formats (JPG/PNG/WebP/AVIF/GIF/BMP/TIFF/SVG/ICO/HEIC/JXL → JPG/PNG/WebP/AVIF/ICO/PDF)
- [ ] compress  - [ ] resize (px/%/target KB)  - [ ] crop + rotate  - [ ] strip EXIF
- [ ] watermark  - [ ] favicon pack  - [ ] image → SVG  - [ ] 20-image batch on throttled phone

## Decisions / defaults used
- Name: **Office Lab** / «المعمل» (owner renamed from Hawwil). Repo `micro4tricks-ai/office-lab`, local `C:\Users\Admin\projects\office-lab`.
- SvelteKit **3** (what `sv create` installs now): config in `web/vite.config.ts`, `#lib/...` imports with file extensions.
- `/` redirects to `/ar/` (or `/en/` if chosen before, saved in localStorage). `trailingSlash: 'always'` for Pages.
- `<html lang dir>` set at prerender in `hooks.server.ts`; theme set client-side (no inline script → CSP-friendly).
- API URL injected at build via Vite `define` (`__API_URL__` from `PUBLIC_API_URL`), not `$env`, so no `.env` file is needed.
- Engines: `adapters/index.ts` `engines` map is the one place both the registry and the worker import from.
- Font: Cairo (variable) self-hosted from `@fontsource-variable/cairo`.
- Lighthouse run locally with Edge (Chrome isn't installed on this PC).

## Next step (exact)
- Phase 1: add `@jsquash/*` adapters + image tools to the registry; one Playwright smoke test per tool with ≤50 KB fixtures.
