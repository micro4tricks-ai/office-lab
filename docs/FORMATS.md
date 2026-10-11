# Supported tools and formats

> From `web/src/lib/registry/` (a generator comes in Phase 5 — until then, keep in sync by hand).
> 100 tools: 80 run in the browser (nothing is uploaded), 20 need the server version (Docker, see `deploy/`).

Image inputs: JPG/JPEG/JFIF, PNG, WebP, AVIF, GIF (first frame), BMP, TIFF, SVG, ICO, HEIC/HEIF, JXL.
Spreadsheet inputs: XLSX, XLSM, XLS, ODS, CSV/TSV (UTF-8 or Windows-1256), JSON arrays.

## PDF (31)
| Tool | In → Out |
|---|---|
| `merge-pdf` | PDF ×2+ → PDF (reorderable) |
| `split-pdf` · `extract-pdf-pages` · `delete-pdf-pages` · `rotate-pdf` · `organize-pdf` | PDF → PDF |
| `crop-pdf` · `pdf-page-numbers` · `watermark-pdf` · `pdf-header-footer` · `pdf-add-blank-pages` | PDF → PDF |
| `sign-pdf` · `edit-pdf` · `fill-pdf-form` | PDF → PDF (visual editors) |
| `pdf-n-up` · `pdf-booklet` · `pdf-grayscale` · `compress-pdf` | PDF → PDF |
| `protect-pdf` · `unlock-pdf` · `pdf-metadata` | PDF → PDF |
| `redact-pdf` (black boxes; covered pages re-drawn as images) · `pdf-letterhead` (PDF/image under or over) | PDF → PDF |
| `pdf-page-size` (A4/A3/A5/Letter/Legal) · `pdf-split-halves` (scanned spreads) · `flatten-pdf` (forms, or all as images) | PDF → PDF |
| `image-to-pdf` | images ×1+ → PDF (optional 'scanned document' clean-up) |
| `pdf-to-image` | PDF → JPG / PNG / WebP |
| `extract-pdf-images` | PDF → PNG / JPG |
| `pdf-to-text` | PDF → TXT |
| `compare-pdf` | PDF ×2 → HTML report |

## Images (13)
`convert-to-jpg` · `convert-to-png` · `convert-to-webp` · `convert-to-avif` · `convert-to-ico` · `heic-to-jpg` ·
`compress-image` · `resize-image` · `crop-rotate-image` · `remove-image-metadata` · `watermark-image` ·
`favicon-generator` (ICO + PNG set + manifest) · `image-to-svg`

## Documents (6)
| Tool | In → Out |
|---|---|
| `markdown-to-pdf` | Markdown editor → PDF via print (4 templates, Arabic) |
| `markdown-to-html` · `markdown-to-word` | MD → HTML / DOCX |
| `word-to-html` · `word-to-markdown` | DOCX → HTML / MD |
| `txt-to-html` | TXT → HTML |

## Data & spreadsheets (16)
| Tool | In → Out |
|---|---|
| `excel-to-csv` · `excel-to-json` · `excel-to-html` · `excel-to-markdown` · `excel-to-sql` | sheets → CSV / JSON / HTML / MD / SQL |
| `convert-to-excel` | CSV / JSON / ODS / XLS → XLSX |
| `convert-to-json` · `convert-to-yaml` · `convert-to-xml` · `convert-to-toml` | JSON ↔ YAML ↔ XML ↔ TOML |
| `merge-excel` · `split-excel` · `remove-duplicates` · `clean-data` | sheets → XLSX |
| `excel-to-vcard` · `vcard-to-excel` | contacts ↔ VCF |

## OCR (2)
`ocr-image` · `ocr-pdf` (≤20 pages) — Arabic, English or both → TXT (shown on the page) or searchable PDF.
Photos are cleaned first: even light, straightened, small images doubled; read as one block (or columns).

## Office tools (8)
`invoice-maker` (VAT, amount in words, logo, ZATCA QR) · `tafqeet` (amount in Arabic/English words) · `hijri-date` · `arabic-text` · `vat-calculator` ·
`qr-code` · `read-qr` · `barcode`

## Files (4)
`create-zip` · `extract-zip` · `batch-rename` · `password-generator`

## Server version (20) — Docker: FastAPI + Gotenberg
| Tool | In → Out | Engine |
|---|---|---|
| `word-to-pdf` | DOCX / DOC / ODT / RTF → PDF (optional PDF/A) | LibreOffice (Gotenberg) |
| `excel-to-pdf` | XLSX / XLS / ODS → PDF (one page per sheet option) | LibreOffice |
| `powerpoint-to-pdf` | PPTX / PPT / PPSX / PPS / ODP → PDF | LibreOffice |
| `convert-to-pdf` | Publisher, Visio, ODG, TXT, Apple Pages/Numbers/Keynote… → PDF | LibreOffice |
| `html-to-pdf` | HTML → PDF (+ one-click PDF in the Markdown studio and the invoice maker) | Chromium (Gotenberg) |
| `url-to-pdf` · `url-to-image` | web page → PDF / PNG · JPG · WebP | Chromium |
| `pdf-to-pdfa` | PDF → PDF/A-1b / 2b / 3b | Gotenberg PDF engines |
| `pdf-to-word` | PDF → DOCX | pdf2docx |
| `pdf-to-excel` | PDF tables → XLSX (one sheet per table, Arabic right to left) | PyMuPDF + openpyxl |
| `compress-pdf-strong` | PDF → PDF (levels or a target size) | Ghostscript |
| `repair-pdf` | PDF → PDF | qpdf, then Ghostscript |
| `ocr-pdf-server` | scanned PDF (any length) → searchable PDF / PDF/A | OCRmyPDF + Tesseract (ara, eng) |
| `ebook-convert` · `epub-to-pdf` · `pdf-to-epub` · `mobi-to-epub` | EPUB / MOBI / AZW3 / FB2 / DOCX / PDF / TXT | calibre |
| `document-convert` · `latex-to-word` · `word-to-latex` | MD / DOCX / ODT / EPUB / HTML / LaTeX / RST | pandoc (`--sandbox`) |
