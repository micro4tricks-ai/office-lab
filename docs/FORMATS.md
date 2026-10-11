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
| `image-to-pdf` | images | PDF (one page per image) | browser |
| `compress-image` | images | same / JPG / WebP / AVIF | browser |
| `resize-image` | images | same / JPG / WebP / PNG / AVIF | browser |
| `crop-rotate-image` | images | same | browser |
| `remove-image-metadata` | JPG, PNG, WebP | same (lossless) | browser |
| `watermark-image` | images | same | browser |
| `favicon-generator` | images | ICO + PNG set + manifest + HTML | browser |
| `image-to-svg` | images | SVG | browser |
| `txt-to-html` | TXT | HTML | browser |
