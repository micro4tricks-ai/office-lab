# Supported formats

> Generated from `web/src/lib/registry/tools.ts` (generator arrives in Phase 5 — until then, keep in sync by hand).

Image inputs (all image tools unless noted): JPG/JPEG/JFIF, PNG, WebP, AVIF, GIF (first frame), BMP, TIFF, SVG, ICO, HEIC/HEIF, JXL.

| Tool | From | To | Runs |
|---|---|---|---|
| `convert-to-jpg` | images | JPG | browser |
| `convert-to-png` | images | PNG | browser |
| `convert-to-webp` | images | WebP | browser |
| `convert-to-avif` | images | AVIF | browser |
| `convert-to-ico` | images | ICO (16–256) | browser |
| `heic-to-jpg` | HEIC/HEIF | JPG | browser |
| `compress-image` | images | same / JPG / WebP / AVIF | browser |
| `resize-image` | images | same / JPG / WebP / PNG / AVIF | browser |
| `crop-rotate-image` | images | same | browser |
| `remove-image-metadata` | JPG, PNG, WebP | same (lossless) | browser |
| `watermark-image` | images | same | browser |
| `favicon-generator` | images | ICO + PNG set + manifest + HTML | browser |
| `image-to-svg` | images | SVG | browser |
| `merge-pdf` | PDF ×2+ | PDF | browser |
| `split-pdf` | PDF | PDF (several) | browser |
| `extract-pdf-pages` / `delete-pdf-pages` / `rotate-pdf` | PDF | PDF | browser |
| `organize-pdf` | PDF | PDF (reorder/rotate/delete, visual) | browser |
| `crop-pdf` | PDF | PDF | browser |
| `pdf-page-numbers` | PDF | PDF | browser |
| `watermark-pdf` | PDF | PDF | browser |
| `sign-pdf` / `edit-pdf` | PDF | PDF (signature, text, images placed visually) | browser |
| `fill-pdf-form` | PDF | PDF (filled, optionally flattened) | browser |
| `image-to-pdf` | images ×1+ | PDF (one file, A4/Letter/fit) | browser |
| `pdf-to-image` | PDF | JPG / PNG / WebP | browser |
| `extract-pdf-images` | PDF | PNG / JPG | browser |
| `pdf-to-text` | PDF | TXT | browser |
| `compress-pdf` | PDF | PDF | browser |
| `compare-pdf` | PDF ×2 | HTML report | browser |
| `protect-pdf` / `unlock-pdf` | PDF | PDF | browser |
| `pdf-metadata` | PDF | PDF | browser |
| `txt-to-html` | TXT | HTML | browser |
