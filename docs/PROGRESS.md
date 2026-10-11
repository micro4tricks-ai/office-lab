# Progress
Current phase: 5 — Polish, SEO, PWA

## Done
- [x] Phase 0 (2026-10-11) — scaffold, registry, worker runner, UI shell, CI + Pages. Pages: https://micro4tricks-ai.github.io/office-lab/
- [x] Phase 1 (2026-10-11) — 14 image tools, worker pool, 28 vitest + 49 playwright green
- [x] Phase 2 (2026-10-11) — 21 PDF tools incl. organize / sign / edit / forms; 33 vitest + 90 playwright green
- [x] Phase 3 + owner-requested extras (2026-10-11) — 73 tools in total; 116 vitest + 144 playwright green
- [x] After Phase 4 (2026-10-12, owner's requests) — wider layout on big screens; OCR clean-up (phone photo 36% → 96% right); 9 tools from a PDF24 review → 100 tools (80 browser + 20 server)
- [x] Phase 4 (2026-10-12) — server version: 18 server tools (91 in total); 121 vitest, 79 server pytest (28 tool tests in the container), Playwright 152 green against the Docker stack and 140 on the Pages build

## Phase 0 checklist
- [x] repo layout, CLAUDE.md, LICENSE (AGPL-3.0), README, docs/BUILD_PROMPT.md
- [x] SvelteKit static, ar/en switch (dir flips), dark/light, responsive 360px → desktop
- [x] home: search + category grid from the registry (1 dummy tool: `txt-to-html`)
- [x] drop zone / file picker, progress bar, result list, download one / all as ZIP
- [x] ci.yml + pages.yml (actions pinned by SHA) — both green on GitHub; live site smoke-tested (convert + download)
- [x] tests: 6 vitest, 18 playwright (desktop + mobile, incl. axe a11y); Lighthouse a11y 100 on ar/, en/, tool page

## Phase 1 checklist
- [x] image formats: JPG/PNG/WebP/AVIF/GIF/BMP/TIFF/SVG/ICO/HEIC/JXL → JPG/PNG/WebP/AVIF/ICO/PDF (+ HEIC→JPG page)
- [x] compress  - [x] resize (px/%/target KB)  - [x] crop + rotate  - [x] strip EXIF/GPS (lossless)
- [x] watermark (Arabic text / logo, tiled)  - [x] favicon pack  - [x] image → SVG
- [x] 20-image batch, Pixel 7 profile at 4× CPU throttling: 0.5–0.7 s, longest main-thread task < 100 ms
- [x] first-load JS 124 KB (home), 134 KB (tool page); codecs lazy, in the worker only

## Phase 2 checklist
- [x] merge (reorderable), split (ranges / every N / each page), extract, delete, rotate
- [x] organize: thumbnail grid, drag to reorder, rotate, delete (buttons too, for touch/keyboard)
- [x] crop margins (crop box, mm)
- [x] page numbers (6 positions, 4 formats incl. «صفحة ١ من ٣», Arabic-Indic digits, start, skip cover)
- [x] watermark (text any language or image; centre or tiled; opacity, angle, pages)
- [x] sign (draw / type in Ruqaa or Script / image / today's date; drag, keys, "every page")
- [x] add text or images (same placement editor)
- [x] fill + flatten forms (Arabic values drawn as shaped images when flattening)
- [x] edit or wipe metadata
- [x] images → PDF (order, A4/Letter/fit, orientation, margins) · PDF → JPG/PNG/WebP (72/150/300 DPI, pages)
- [x] extract embedded images · PDF → TXT
- [x] basic compress (re-encode/shrink JPEG photos; never bigger) · compare two PDFs (HTML text diff)
- [x] protect (AES-256) / unlock with a known password — in the browser, no qpdf needed
- [x] 200-page PDF + 3 pages merged in ~0.3 s, no main-thread long tasks

## Phase 3 checklist
- [x] Markdown → PDF studio: live preview, per-paragraph direction, Arabic fonts (Cairo/Amiri/Noto Naskh), tables, code, KaTeX, Mermaid; TOC, header/footer, page numbers (Arabic-Indic option); templates simple / report (cover) / CV / letter; Paged.js + print
- [x] Markdown → HTML (single file) and → DOCX (headings, lists, tables, code, RTL)
- [x] DOCX → HTML / Markdown (mammoth + turndown on a domino DOM), images inline or as files
- [x] Data: XLSX/XLS/ODS/CSV/JSON → CSV/JSON/HTML/MD/SQL/XLSX; JSON ↔ YAML ↔ XML ↔ TOML
- [x] OCR images and scanned PDFs (≤20 pages): text or searchable PDF; Arabic fixture 100% characters right
- [x] Arabic MD prints a correct RTL PDF (checked by rendering Chromium's PDF)

## Extras the owner asked for (2026-10-11)
- [x] Arabic office tools: tafqeet (amount in words, EGP/SAR/AED/KWD/USD/EUR), Hijri ↔ Gregorian, Arabic text clean-up, VAT calculator
- [x] QR maker (text/Wi-Fi/contact, Arabic as UTF-8) + QR reader, barcode maker, create/extract ZIP, batch rename
- [x] PDF: black & white, 2/4 per sheet, booklet (Arabic binding), blank pages, header/footer text
- [x] Spreadsheets: merge, split, remove duplicates, clean, contacts Excel ↔ vCard

## Phase 4 checklist
- [x] FastAPI `server/`: GET /api/health, GET /api/capabilities (only tools whose programs exist), POST /api/convert/{tool} (multipart, synchronous)
- [x] Office → PDF (Word/Excel/PowerPoint/ODF/RTF), HTML → PDF, URL → PDF / screenshot, PDF → PDF/A via Gotenberg 8.37
- [x] PDF → Word (pdf2docx), strong compress (Ghostscript levels + target size), repair (qpdf → gs), OCRmyPDF ara+eng
- [x] ebooks (calibre: EPUB/AZW3/MOBI/FB2/DOCX/PDF/TXT), pandoc (MD/DOCX/ODT/EPUB/HTML/LaTeX/RST)
- [x] one-click Markdown → PDF: the studio sends its paged document + fonts to Gotenberg's Chromium (same CSS as the browser)
- [x] limits: MAX_MB, per-job temp dir removed after the response, sweeper (RETENTION_MIN), per-tool timeouts, slots = CPU count, slowapi per IP, non-root, read-only root fs, zip-bomb guard, no file names/contents in logs
- [x] Caddy: static site + /api proxy; CSP, COOP/COEP, CORP, HSTS, nosniff; body cap
- [x] `docker compose -f deploy/docker-compose.yml up -d` → http://localhost with all tools; `docker compose config` valid
- [x] `deploy/HOSTINGER.md` (Arabic) + `deploy/install-vps.sh` (shellcheck clean; not yet run on a real VPS)

## Owner requests after Phase 4 (2026-10-12)
- [x] Layout fills big screens (container 106rem, fluid gutters, root font 16→18px)
- [x] OCR: background normalisation + deskew + upscaling small images, Tesseract PSM 6 by default (columns option = PSM 3); text shown on the page with Copy; phone-photo fixture ≥90% (got 96%)
- [x] From the PDF24 list: redact, letterhead/overlay, page size, split in half, flatten, scanned-document look for images → PDF, invoice maker (ZATCA QR), password generator, convert anything to PDF (server), PDF to Excel (server)
- Skipped on purpose (low value or covered already): photo collage, cards, job application, e-invoice XML (needs a per-country standard), PDF/A & signature validation, viewer preferences, bookmarks editor, PDF → PowerPoint

## Decisions / defaults used
- Name: **Office Lab** / «المعمل» (owner renamed from Hawwil). Repo `micro4tricks-ai/office-lab`, local `C:\Users\Admin\projects\office-lab`.
- SvelteKit **3** (what `sv create` installs now): config in `web/vite.config.ts`, `#lib/...` imports with file extensions.
- `/` redirects to `/ar/` (or `/en/` if chosen before, saved in localStorage). `trailingSlash: 'always'` for Pages.
- `<html lang dir>` set at prerender in `hooks.server.ts`; theme set client-side (no inline script → CSP-friendly).
- API URL injected at build via Vite `define` (`__API_URL__` from `PUBLIC_API_URL`), not `$env`, so no `.env` file is needed.
- Engines: `adapters/index.ts` `engines` map is imported ONLY by the worker. The registry's `load` is `inWorker(engine)` (`workers/proxy.ts`), so the page never bundles a codec.
- One engine can serve several tools through `Tool.params` (fixed options), e.g. all `convert-to-*` use `image-convert`.
- Options can be conditional (`when`), and `type: 'image'` takes a second file (watermark logo).
- SVG input is rasterised on the main thread (`workers/prepare.ts`, longest side ≥ 1024) — workers have no DOM.
- Codecs: `@jsquash/*` (mozjpeg, webp, avif, png+oxipng, jxl decode), `libheif-js` (HEIC, LGPL-3.0), `utif2` (TIFF), `@cantoo/pdf-lib`.
- Vectorize uses `imagetracerjs` (Unlicense), NOT potrace: `esm-potrace-wasm` is GPL-2.0-only → incompatible with AGPL-3.0 and with a future commercial licence.
- Resize by pixels fits inside the box and never enlarges (with "keep ratio" on). Compress never returns a bigger file (keeps the original, with a note).
- Crop is by aspect ratio (centred), not a drag-to-select cropper — a visual cropper can come with Phase 5 polish.
- Image → PDF combines all chosen images into one PDF (order, page size, margins) — moved to the PDF tools in Phase 2.
- Image fixtures are generated by `web/tests/fixtures/images/make_fixtures.py` (Pillow + pillow-heif + pillow-jxl-plugin).
- Font: Cairo (variable) self-hosted from `@fontsource-variable/cairo`; the watermark worker loads it via `FontFace`.
- Lighthouse run locally with Edge (Chrome isn't installed on this PC).

- PDF: `@cantoo/pdf-lib` writes (and encrypts/decrypts — so protect/unlock stay in the browser; qpdf-wasm dropped). Unlock copies pages into a fresh document because the fork re-encrypts a decrypted one on save.
- pdf.js runs inside our worker as its own "fake worker", with `CanvasFactory`/`FilterFactory` built on OffscreenCanvas, `useWorkerFetch: false` and a `{ fonts }` ownerDocument (its defaults touch `document`). Its cmaps/fonts/wasm are copied to `static/pdfjs/` by `scripts/copy-assets.mjs` (git-ignored, runs before dev/build).
- pdf-lib cannot shape Arabic, so every text we draw (page numbers, watermarks, signatures, flattened form values) is rendered by the browser to PNG first. Its standard font silently turns Arabic into "?", so form values are checked against Latin-1 explicitly.
- Placement is done in the page's visual frame (`adapters/pdf/place.ts`), so /Rotate'd pages get upright stamps.
- Tool options: `combine` (several files → one job, reorderable), `editor` ('organize' | 'place' | 'form'), required/secret text fields. Editors call engines through the same worker pool (`pdf-thumbs`, `pdf-forms` action=fields).
- Unexpected errors log `[office-lab] <tool>: <stack>` to the console (worker sends the stack).
- Signature fonts: Aref Ruqaa + Dancing Script (OFL, @fontsource), loaded only when the editor opens.
- Page parsing: "1-3, 5, 8-", Arabic digits/comma ok; a range end past the last page is clamped, a single page past it is an error.

- Phase 3: SheetJS CE from cdn.sheetjs.com tarball (0.20.3). Arabic CSV in Windows-1256 is detected; CSV out gets a BOM; leading zeros (phones) survive. CSV output defuses formula injection; SQL has a MySQL dialect (backslash escaping).
- Every ZIP download goes through `safeEntryName` (zip-slip guard); extract-zip caps 5000 entries / 1 GB unpacked.
- OCR: tesseract.js v7 + `best_int` ara/eng models from npm (about as small as tessdata_fast, more accurate); all core builds copied (v7 also uses relaxedsimd). Searchable PDF = original page + invisible Amiri text layer with shaping features off (shaped glyphs extract as garbage); fonts embedded whole (fontkit's subsetter fails on these WOFFs).
- The runner passes the UI language as `uiLang` (never `lang`: it overwrote the OCR option of that name). A unit test keeps options from using it.
- Paged.js and Tesseract are self-hosted by `scripts/copy-assets.mjs`, which also runs before `svelte-check` (asset() paths are typed from static/).
- Widgets (`Tool.widget`): tools with their own page and no file runner (Markdown studio, tafqeet, Hijri, Arabic text, VAT, QR, barcode).
- Known low-risk audit items: `argparse`→`sprintf-js` (mammoth's CLI only, not bundled) and KaTeX prototype-pollution note (needs an existing pollution; we render the user's own text with trust off).

- Phase 4: Debian trixie image (Python 3.13, the distro's; the spec said 3.12 — no difference for us). pandoc from the upstream .deb: Debian's build keeps data files outside the binary and `--sandbox` can't reach them.
- Server tool ids = web registry ids (`web/src/lib/registry/server-tools.ts`); `tests/unit/server-tools.test.ts` parses `server/app/tools/*.py` to keep ids and option names in step.
- `PUBLIC_API_URL`: '' = no server, 'self' = same site (Docker build), or an origin. Pages reads the repo variable `PUBLIC_API_URL` (empty today).
- SSRF: Gotenberg runs with `--chromium-deny-private-ips --libreoffice-deny-private-ips`, webhooks and downloadFrom off; the API refuses private/internal hosts (incl. 0x7f.1-style IPv4) first. Gotenberg 8.37 also keeps each request inside its own /tmp folder. Hostile HTML/EPUB/LaTeX/MD fixtures are in the tool tests.
- calibre PDF input runs with header/footer detection off (it crashes on short PDFs). Calibre/Chromium PDFs extract lam-alef as «األ» in some readers (ligature ToUnicode); the page itself renders right.
- No ACME email in the Caddyfile (Let's Encrypt stopped expiry emails in 2025).
- CSP keeps 'unsafe-inline' for scripts (SvelteKit start-up script, Markdown preview iframe) — connect-src 'self' is what stops files leaving.

## Next step (exact)
- Phase 5 (polish, SEO, PWA): read BUILD_PROMPT §6 Phase 5. Prerendered SEO page per tool and language, sitemap.xml + robots.txt, OG images; generate docs/FORMATS.md from the registry; PWA (offline for browser tools, Web Share Target); pipelines (chain tools, presets); privacy badge + privacy/about pages; README with screenshots. Accept: Lighthouse ≥ 90 in all four categories on home and one tool page; installable PWA.
- Hosting the server version is the owner's call (Hostinger KVM 2+, guide in deploy/HOSTINGER.md). Docker Desktop is installed on this PC.
