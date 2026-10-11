# BUILD PROMPT — Open-source file & image converter (iLovePDF-style, Arabic-first)

> For Claude Code. Written in English on purpose (≈half the tokens of Arabic). The site UI is Arabic + English.
> Session 1: paste this whole file. Every later session: just say «كمّل المرحلة التالية».

---

## 0. Settings (owner may edit before Session 1)

| Key | Default | Note |
|---|---|---|
| NAME | `Office Lab` / «المعمل» | working name, easy to rename later (one constant) |
| REPO | `micro4tricks-ai/office-lab` (public) | GitHub user already logged in via `gh` |
| PROJECT_DIR | `C:\Users\Admin\projects\office-lab` | |
| LICENSE | AGPL-3.0 for our code | owner is sole copyright holder → can dual-license commercially later |
| DEFAULT_LANG | `ar` (RTL), second `en` | |
| DOMAIN | none yet | GitHub Pages URL first |

---

## 1. Mission

Build an open-source, privacy-first converter site in two tiers from ONE repo:

- **Tier A — static site (browser-only):** every conversion that can run client-side via JS/WASM. Deployed to **GitHub Pages** for full real-world testing. Files never leave the user's device.
- **Tier B — server API (Docker):** heavy conversions (Office↔PDF, PDF→Word, ebooks, strong PDF compression, OCRmyPDF). Lives in the same repo, runs locally with `docker compose`, and later deploys **unchanged** to a Hostinger KVM VPS.

The same static build must work in both places: on GitHub Pages under `/office-lab/` with no API (server tools shown as "available on server version"), and on the VPS at `/` with the API enabled.

---

## 2. Rules for you (Claude) — read every session

**Token economy (the owner pays per limit window):**
1. At session start read ONLY `CLAUDE.md` and `docs/PROGRESS.md`, then the section of this prompt for the current phase (`docs/BUILD_PROMPT.md`). Do not re-read finished code unless you are editing it.
2. Never read or print `node_modules`, `dist`, `build`, lockfiles, WASM/binary files, or large fixtures. Pipe long command output through `tail -n 40`.
3. Edit files; don't rewrite whole files to change a few lines. No repeated "let me check" reads of a file you just wrote.
4. One phase per session. When the phase's acceptance checks pass: update `docs/PROGRESS.md`, commit, push, and stop with a ≤8-line summary (what works, the test result, the link, what is next). No long reports.
5. Don't spawn subagents unless two tasks are truly independent and large.
6. If the limit is near, stop at a clean point: commit WIP on a branch and write the exact next step in PROGRESS.md.

**Engineering:**
7. Ask the owner only when blocked by a decision listed as theirs; otherwise use the defaults here and note them in PROGRESS.md.
8. Every converter is registered in ONE registry (§4). The UI, the routes, the SEO pages and the capability checks are all generated from it. Never hard-code a tool in two places.
9. Every heavy library is **lazy-loaded** only when its tool opens. First page load must stay < 300 KB JS.
10. No runtime requests to third-party CDNs: WASM, fonts and models are self-hosted (copied from npm at build). This keeps it private, CSP-strict and VPS-ready.
11. Each engine sits behind a small adapter (`convert(input, options) → output`), so any library can be swapped later (important for licensing before going commercial).
12. Before claiming something works, run its test. Report failures honestly.
13. Commit after each finished task with a clear message; push at phase end.

---

## 3. Stack (fixed — don't re-debate)

- **Frontend:** SvelteKit + `@sveltejs/adapter-static` (prerender all pages), TypeScript, plain CSS with design tokens (no UI framework). Web Workers for every conversion. `fflate` for ZIP.
- **Base path:** `paths.base` from env `BASE_PATH` (`/office-lab` on Pages, empty on VPS). API URL from `PUBLIC_API_URL` (empty = no server).
- **Browser engines:**
  - Images: Canvas + `@jsquash/*` (jpeg/png/webp/avif/jxl).
  - HEIC: `libheif-js` (or `heic-to`).
  - SVG→raster: Canvas. Vectorize: `potrace` wasm.
  - PDF: `@cantoo/pdf-lib` (maintained fork of pdf-lib) + `pdfjs-dist`.
  - Office/data: `mammoth` (DOCX→HTML) + `turndown` (→MD); `markdown-it` + KaTeX + highlight.js + mermaid (lazy) for MD rendering; SheetJS CE from `https://cdn.sheetjs.com` tarball (the npm registry version is outdated) for XLSX/CSV/JSON.
  - OCR: `tesseract.js` with self-hosted `ara` + `eng` tessdata_fast.
  - Media (phase 6 only): `@ffmpeg/ffmpeg` single-thread core.
- **MD→PDF in browser:** render styled RTL HTML (Arabic fonts Amiri / Noto Naskh Arabic / Cairo, self-hosted) → `Paged.js` preview → `window.print()` (Save as PDF). This gives perfect Arabic shaping. One-click direct PDF download comes from the server (Gotenberg Chromium) in Tier B.
- **Server (Tier B):** Python 3.12 FastAPI (`server/`).
  - Separate container: `gotenberg/gotenberg:8` (LibreOffice + Chromium).
  - API image includes: pandoc, calibre (`ebook-convert`), ocrmypdf + tesseract-ara/eng, qpdf, ghostscript, `pdf2docx`.
  - `caddy:2` serves the static build and reverse-proxies `/api/*`, automatic HTTPS.
- **Tests:** Vitest (registry + adapters), Playwright (one smoke test per tool with tiny fixtures ≤50 KB in `tests/fixtures/`), pytest for the server.
- **CI:** GitHub Actions: `ci.yml` (build + tests) and `pages.yml` (build with `BASE_PATH=/office-lab` → deploy Pages). Pin actions by commit SHA.

---

## 4. The registry (single source of truth)

`web/src/lib/registry/tools.ts` exports an array of:

```ts
type Tool = {
  id: string;                 // 'jpg-to-png', 'merge-pdf'
  category: 'image' | 'pdf' | 'document' | 'data' | 'ebook' | 'media' | 'ocr';
  from: string[];             // accepted extensions/MIME
  to: string[];               // output formats ([] for operations like merge)
  runtime: 'browser' | 'server';
  engine: string;             // adapter name
  load: () => Promise<Adapter>; // lazy import (browser) or API call (server)
  options?: OptionSpec[];     // quality, size, page range… (drives the UI form)
  maxMB: number;
  batch: boolean;
  i18n: { ar: { title, desc, keywords }, en: { title, desc, keywords } };
};
```

- From it generate: the home grid, `/[lang]/[tool]` pages (prerendered SEO pages with title, description, how-to and FAQ in both languages), the sitemap, and the "server only" badges.
- Server tools are enabled only if `GET {PUBLIC_API_URL}/api/capabilities` lists them. Otherwise they show «متاحة في نسخة الخادم» and link to a docs page.

---

## 5. Repository layout (keep exactly)

```
office-lab/
├─ CLAUDE.md                 # ≤40 lines: rules §2 summary, commands, current phase pointer
├─ README.md                 # Arabic + English: what, screenshots, run locally, deploy
├─ LICENSE                   # AGPL-3.0
├─ docs/
│  ├─ BUILD_PROMPT.md        # this file
│  ├─ PROGRESS.md            # phase checklist + decisions + next step
│  └─ FORMATS.md             # generated from the registry (table: from → to, runtime)
├─ web/                      # SvelteKit static site (Tier A)
│  ├─ src/lib/registry/      # tools.ts + types
│  ├─ src/lib/adapters/      # one file per engine
│  ├─ src/lib/workers/       # web workers
│  ├─ src/lib/i18n/          # ar.json, en.json
│  ├─ src/routes/            # [lang]/, [lang]/[tool]/, privacy, about
│  ├─ static/                # fonts, wasm, tessdata (copied by scripts/copy-assets.mjs)
│  └─ tests/                 # vitest + playwright + fixtures
├─ server/                   # FastAPI (Tier B)
│  ├─ app/main.py, app/tools/*.py, app/limits.py
│  ├─ Dockerfile
│  └─ tests/
├─ deploy/
│  ├─ docker-compose.yml     # caddy + api + gotenberg (+ optional profiles)
│  ├─ Caddyfile              # static + /api proxy + security headers (CSP, COOP/COEP)
│  ├─ .env.example           # DOMAIN, EMAIL, MAX_MB, RETENTION_MIN, WORKERS
│  ├─ install-vps.sh         # one-shot Ubuntu setup (docker, ufw, clone, up)
│  └─ HOSTINGER.md           # Arabic step-by-step VPS guide (§8)
└─ .github/workflows/        # ci.yml, pages.yml
```

---

## 6. Phases (one per session; each ends with tests green + push)

### Phase 0 — Scaffold & deploy skeleton
- Create the repo, layout, CLAUDE.md, PROGRESS.md, LICENSE, and a README stub. Copy this prompt into `docs/BUILD_PROMPT.md`.
- SvelteKit static app with:
  - an Arabic/English switch (`dir` flips), dark/light mode, and responsive layout (360px → desktop);
  - a home page with a search box and a category grid generated from the registry (with 1 dummy tool);
  - a shared drag-and-drop/file-picker component, a progress bar, a result list with download buttons, and "download all as ZIP".
- Workflows `ci.yml` and `pages.yml`; enable Pages (source: GitHub Actions).
- **Accept:** Pages URL loads in both languages, Lighthouse a11y ≥ 90, CI green.

### Phase 1 — Images (browser)
- Convert any of JPG, PNG, WebP, AVIF, GIF (first frame), BMP, TIFF, SVG, ICO, HEIC, JXL to JPG, PNG, WebP, AVIF, ICO and PDF.
- Image tools:
  - compress (quality slider, before/after size);
  - resize (px, %, or **target file size in KB** — binary search on quality/scale);
  - crop and rotate;
  - strip EXIF/GPS;
  - text/logo watermark;
  - favicon pack (16–512 + `.ico` + manifest snippet);
  - image → SVG (potrace).
- Batch + ZIP for all of the above.
- **Accept:** a Playwright smoke test per tool passes; a 20-image batch works on a mid phone (test with throttling).

### Phase 2 — PDF tools (browser)
- Page tools:
  - merge, split (ranges or every N pages), extract pages;
  - organize (thumbnail grid: drag to reorder, rotate, delete);
  - crop margins.
- Content tools:
  - page numbers (position, format, Arabic-Indic digits option);
  - watermark (text or image, opacity, angle);
  - sign (draw, type, or image; place on page);
  - add text or images;
  - fill + flatten forms;
  - edit metadata.
- Conversions and extraction:
  - images → PDF (order, page size, margins);
  - PDF → JPG/PNG/WebP (DPI choice, ZIP);
  - extract embedded images;
  - PDF → TXT (pdf.js).
- Other:
  - basic compress (object streams + re-encode embedded JPEGs);
  - compare two PDFs (text diff per page);
  - protect / unlock with a known password (qpdf-wasm if feasible, else mark as a server tool).
- **Accept:** smoke tests per tool; a 200-page PDF merges without freezing the UI (worker).

### Phase 3 — Documents, data, OCR (browser)
- **Markdown → PDF (the flagship):**
  - editor with live preview; RTL auto-detect per paragraph;
  - Arabic fonts; tables, code highlighting, KaTeX, Mermaid;
  - auto TOC, header/footer, page numbers;
  - 4 templates (report, CV, official letter, simple);
  - output via Paged.js + print. Also MD → HTML (single file) and MD → DOCX (the `docx` npm lib, covering headings, lists, tables, bold/italic, RTL).
- **DOCX** → HTML and Markdown (mammoth + turndown, images embedded or zipped).
- **Data:** XLSX/XLS/ODS/CSV ↔ JSON, CSV, HTML, Markdown table, SQL INSERT. Also JSON ↔ YAML ↔ XML ↔ TOML.
- **OCR:** image or scanned PDF (≤20 pages in browser) → text / searchable copy; languages ar, en, ar+en.
- **Accept:** smoke tests; an Arabic sample MD file prints a correct RTL PDF (visual check by screenshot); OCR of an Arabic fixture reaches ≥85% characters correct.

### Phase 4 — Server API + Docker (Tier B)
- **Endpoints:**
  - `GET /api/health`
  - `GET /api/capabilities`
  - `POST /api/convert/{tool_id}` (multipart). Synchronous with a timeout; a job queue is added only if needed later.
- **Server tools:**
  - DOCX/DOC/ODT/RTF/PPTX/PPT/XLSX/XLS/ODS/ODP/HTML/MD → PDF (Gotenberg);
  - one-click MD → PDF via Gotenberg Chromium with the same CSS as the browser;
  - URL → PDF and screenshot;
  - PDF → DOCX (pdf2docx);
  - PDF → PDF/A;
  - strong compress (ghostscript presets + **target size**);
  - repair (qpdf);
  - protect/unlock (if not in browser);
  - OCRmyPDF (ara+eng);
  - ebooks: EPUB/MOBI/AZW3/FB2/DOCX/PDF via calibre;
  - pandoc conversions (MD/DOCX/ODT/EPUB/HTML/LaTeX).
- **Limits & safety:**
  - `MAX_MB` (100);
  - a per-job temp dir, deleted at job end; a sweeper deletes anything older than `RETENTION_MIN` (60);
  - per-tool timeouts and a concurrency semaphore (= CPU count);
  - rate limit per IP (slowapi); runs as a non-root user;
  - gotenberg on an internal network only;
  - an ImageMagick/ghostscript-safe policy; zip-bomb guard;
  - file contents never logged.
- **Caddy:** serves `web/build`, proxies `/api`, and sets headers: CSP, COOP/COEP, HSTS, and `X-Content-Type-Options`.
- **Local:** `docker compose -f deploy/docker-compose.yml up -d` → http://localhost works with all tools.
- **Accept:** pytest per tool against fixtures inside the container; the Playwright suite passes against localhost with the API enabled; `docker compose config` is valid; `deploy/HOSTINGER.md` is written.

### Phase 5 — Polish, SEO, PWA
- Prerendered SEO page per tool and language; `sitemap.xml` and `robots.txt`; Open Graph images.
- `docs/FORMATS.md` generated from the registry.
- PWA: offline for browser tools, plus a Web Share Target to receive files from the phone share menu.
- Pipelines: chain tools, e.g. HEIC → JPG → compress → one PDF, saved as presets.
- Privacy badge on browser tools («يعمل على جهازك — لا يُرفع ملفك»), and privacy + about pages.
- Final README with screenshots.
- **Accept:** Lighthouse ≥ 90 in all four categories on home and on one tool page; installable PWA.

### Phase 6 — Later (only when the owner asks)
- Video/audio via ffmpeg (browser for small files, server for big ones).
- Background removal, upscaling.
- WhatsApp chat export → PDF.
- Public API keys.
- Accounts and payments: the commercial phase, to be planned separately.

---

## 7. UX requirements (all phases)
- Arabic is the default (RTL). Every string lives in `ar.json` / `en.json`; there are no hard-coded texts.
- Each tool page shows: a drop zone, an options form (from `options`), Convert, progress per file, results with size before/after, download one/all (ZIP), and «تحويل ملفات أخرى».
- Clear errors in Arabic for: wrong type, too big, password-protected, corrupted.
- Keyboard accessible with visible focus; `prefers-reduced-motion` respected; 44px touch targets.
- Visual style: clean, calm, trustworthy (not a template look). One accent color, generous spacing, Arabic-first typography (Cairo / Noto Naskh).

---

## 8. Deployment targets

**GitHub Pages (testing, now):**
- `pages.yml` builds with `BASE_PATH=/office-lab PUBLIC_API_URL=`. Server tools show the "server version" badge.
- Pages cannot send custom headers, so it registers `coi-serviceworker` only if a tool needs SharedArrayBuffer.

**Hostinger VPS (later) — `deploy/HOSTINGER.md` in Arabic must cover:**
1. **Plan:** KVM 2 or higher (2 vCPU, 8 GB RAM, 100 GB NVMe is plenty to start). Choose Ubuntu 24.04 (or the Docker template). Shared/web hosting is NOT enough for Tier B. It can host Tier A only, by uploading `web/build`.
2. **DNS:** an A record from the domain to the VPS IP.
3. **Install:** SSH in → `curl -fsSL <raw url>/deploy/install-vps.sh | bash`. The script installs Docker, opens ufw ports 22/80/443, clones the repo, copies `.env.example` → `.env`, and asks for DOMAIN and EMAIL.
4. **Run:** `docker compose up -d --build` → HTTPS is automatic via Caddy.
5. **Update:** `git pull && docker compose up -d --build`.
6. **Backup:** nothing to back up (stateless), only `.env`. Add a health check with Uptime Kuma (optional profile).
7. **Troubleshooting:** logs, disk cleanup (`docker system prune`), and how to change the limits.

---

## 9. PROGRESS.md format (keep short)
```
# Progress
Current phase: 1 — Images
## Done
- [x] Phase 0 (2026-10-xx) — Pages: https://micro4tricks-ai.github.io/office-lab/
## Phase 1 checklist
- [x] jpg↔png↔webp  - [ ] heic→jpg  - [ ] target-KB resize ...
## Decisions / defaults used
- ...
## Next step (exact)
- ...
```

---

## 10. Start now
Run Phase 0 only. Then stop with the short summary from §2 rule 4.
