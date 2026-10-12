# Supported tools and formats

> Generated from `web/src/lib/registry/` — do not edit by hand. To refresh:
> `cd web && UPDATE_FORMATS=1 npx vitest run formats`

112 tools: 91 run in the browser (nothing is uploaded), 21 need the server version (Docker, see `deploy/`).

## PDF (43)

| Tool | In → Out | Runs | What it does |
|---|---|---|---|
| `merge-pdf` Merge PDF | PDF ×2+ → PDF | browser | Combine several PDFs into one, in the order you choose. |
| `organize-pdf` Organize PDF | PDF → PDF | browser | See every page: drag to reorder, rotate or delete what you want. |
| `sign-pdf` Sign PDF | PDF → PDF | browser | Sign by drawing, typing your name, or with an image of your signature or stamp — placed where you want. |
| `edit-pdf` Add text or images to PDF | PDF → PDF | browser | Write Arabic or English text, or place an image, anywhere on the pages. |
| `fill-pdf-form` Fill PDF forms | PDF → PDF | browser | Fill the form fields in Arabic or English, and flatten them into the page if you like. |
| `split-pdf` Split PDF | PDF → PDF | browser | Split into several files: by your ranges, every N pages, or one page each. |
| `extract-pdf-pages` Extract PDF pages | PDF → PDF | browser | Keep only the pages you want, in the order you write them. |
| `delete-pdf-pages` Delete PDF pages | PDF → PDF | browser | Remove specific pages and keep the rest. |
| `rotate-pdf` Rotate PDF | PDF → PDF | browser | Rotate all pages or chosen ones, with no quality loss. |
| `crop-pdf` Crop PDF margins | PDF → PDF | browser | Trim extra white margins from every page (in mm). |
| `pdf-page-numbers` Add page numbers | PDF → PDF | browser | Number your pages in the style and spot you choose, with Arabic-Indic digits if you like. |
| `watermark-pdf` Watermark PDF | PDF → PDF | browser | Stamp “Confidential”, “Draft” or your logo across the pages. |
| `image-to-pdf` Images to PDF | JPG / PNG / WEBP / AVIF / GIF / BMP / TIFF / SVG / ICO / HEIC / JXL ×1+ → PDF | browser | Put your images into one PDF in your order, on A4 or at their own size. |
| `pdf-to-image` PDF to images | PDF → JPG / PNG / WEBP | browser | Each page becomes a JPG, PNG or WebP at the resolution you pick. |
| `extract-pdf-images` Extract images from PDF | PDF → PNG / JPG | browser | Save every picture inside the file as its own image. |
| `pdf-to-text` PDF to text | PDF → TXT | browser | Get the file’s text as a TXT. (Scanned files need OCR.) |
| `compress-pdf` Compress PDF | PDF → PDF | browser | Shrink the file by recompressing the photos inside. For stronger results use the server version. |
| `compare-pdf` Compare two PDFs | PDF ×2 → HTML | browser | See what changed in the text between two versions, page by page. |
| `protect-pdf` Protect PDF | PDF → PDF | browser | Lock the file with a password (AES-256); nobody opens it without one. |
| `unlock-pdf` Unlock PDF | PDF → PDF | browser | Remove the password and print/copy limits from a file whose password you know. |
| `pdf-metadata` Edit PDF metadata | PDF → PDF | browser | Change title, author and subject — or wipe all hidden metadata before sending. |
| `pdf-grayscale` PDF to black & white | PDF → PDF | browser | Save colour ink when printing. (Pages become images, so text can no longer be copied.) |
| `pdf-n-up` Several pages per sheet (N-up) | PDF → PDF | browser | Print 2 or 4 pages on each sheet to save paper — Arabic or English order. |
| `pdf-booklet` Make a printable booklet | PDF → PDF | browser | Reorder pages to print double-sided, fold and staple as a booklet — Arabic right-edge binding too. |
| `pdf-add-blank-pages` Add blank pages | PDF → PDF | browser | Insert a blank page at the start, the end, or after every page (handy for duplex printing). |
| `pdf-header-footer` Add header & footer | PDF → PDF | browser | Put your organisation, the date and the page number at the top and bottom of every page — Arabic or English. |
| `redact-pdf` Redact PDF | PDF → PDF | browser | Black out names, numbers and amounts before sending a file. The text is really removed: covered pages become images, so nothing underneath can be copied. |
| `pdf-letterhead` Add letterhead to PDF | PDF → PDF | browser | Put your company letterhead (logo, address, footer) behind every page, or a stamp or frame on top. |
| `pdf-page-size` Change PDF page size | PDF → PDF | browser | Make every page A4 (or A3, A5, Letter) keeping proportions — before printing or uploading to a portal. |
| `pdf-split-halves` Split PDF pages in half | PDF → PDF | browser | Turn scanned two-page spreads into single pages, in Arabic (right first) or English order. |
| `flatten-pdf` Flatten PDF | PDF → PDF | browser | Lock form values and comments so they can’t be changed, or turn the pages into images like a printed scan. |
| `whatsapp-to-pdf` WhatsApp chat to PDF | TXT / ZIP → PDF | browser | Turn an exported WhatsApp chat (TXT, or the ZIP with photos) into a searchable PDF with bubbles, names, dates and pictures — to keep or submit. |
| `word-to-pdf` Word to PDF | DOCX / DOC / ODT / RTF → PDF | server | Turn Word, ODT and RTF documents into PDF with their layout and Arabic fonts, using LibreOffice. |
| `excel-to-pdf` Excel to PDF | XLSX / XLS / ODS → PDF | server | Turn Excel and ODS spreadsheets into PDF, optionally one page per sheet. Formulas are calculated first. |
| `powerpoint-to-pdf` PowerPoint to PDF | PPTX / PPT / PPSX / PPS / ODP → PDF | server | Turn presentations into PDF, one slide per page. |
| `convert-to-pdf` Convert anything to PDF | DOC / DOCX / DOCM / DOT / DOTX / ODT / OTT / RTF / TXT / WPD / WPS / HWP / PAGES / XLS / XLSX / XLSM / XLSB / ODS / NUMBERS / PPT / PPTX / PPTM / PPS / PPSX / ODP / KEY / ODG / PUB / VSD / VSDX / SVG / EMF / WMF → PDF | server | Turn Publisher, Visio, drawings (ODG), plain text, Apple Pages/Numbers/Keynote and more into PDF, using LibreOffice. |
| `html-to-pdf` HTML to PDF | HTML / HTM → PDF | server | Print a saved HTML page to PDF with Chromium, with full Arabic support. |
| `url-to-pdf` Web page to PDF | own page → PDF | server | Enter the address of any web page and save it as PDF. |
| `pdf-to-word` PDF to Word | PDF → DOCX | server | Turn a PDF into an editable Word document, with tables and images. Works on text PDFs; scans need OCR first. |
| `pdf-to-excel` PDF to Excel | PDF → XLSX | server | Pull the tables out of a PDF into Excel: one sheet per table, numbers as numbers, Arabic tables right to left. |
| `pdf-to-pdfa` PDF to PDF/A | PDF → PDF | server | Convert a PDF to the PDF/A archiving format that courts and government offices ask for. |
| `compress-pdf-strong` Strong PDF compression | PDF → PDF | server | Stronger compression with Ghostscript, or pick a target size (e.g. 2 MB for an upload portal). |
| `repair-pdf` Repair PDF | PDF → PDF | server | Try to fix a damaged PDF that won’t open by recovering what can still be read. |

## Images (14)

| Tool | In → Out | Runs | What it does |
|---|---|---|---|
| `convert-to-jpg` Convert images to JPG | JPG / PNG / WEBP / AVIF / GIF / BMP / TIFF / SVG / ICO / HEIC / JXL → JPG | browser | Turn PNG, WebP, HEIC, AVIF, TIFF and more into JPG at the quality you choose. |
| `convert-to-png` Convert images to PNG | JPG / PNG / WEBP / AVIF / GIF / BMP / TIFF / SVG / ICO / HEIC / JXL → PNG | browser | Turn any image into lossless PNG, keeping transparency. |
| `convert-to-webp` Convert images to WebP | JPG / PNG / WEBP / AVIF / GIF / BMP / TIFF / SVG / ICO / HEIC / JXL → WEBP | browser | WebP is much smaller and made for websites. |
| `convert-to-avif` Convert images to AVIF | JPG / PNG / WEBP / AVIF / GIF / BMP / TIFF / SVG / ICO / HEIC / JXL → AVIF | browser | AVIF is the newest, smallest format at the same quality (slower to make). |
| `convert-to-ico` Convert an image to ICO | JPG / PNG / WEBP / AVIF / GIF / BMP / TIFF / SVG / ICO / HEIC / JXL → ICO | browser | A .ico icon with several sizes in one file (16 to 256 px). |
| `heic-to-jpg` HEIC (iPhone) to JPG | HEIC → JPG | browser | Open iPhone photos anywhere: HEIC to JPG, with location data removed. |
| `compress-image` Compress images | JPG / PNG / WEBP / AVIF / GIF / BMP / TIFF / SVG / ICO / HEIC / JXL → JPG / PNG / WEBP / AVIF | browser | Make images smaller while keeping them looking good; see the size before and after. |
| `resize-image` Resize images | JPG / PNG / WEBP / AVIF / GIF / BMP / TIFF / SVG / ICO / HEIC / JXL → JPG / PNG / WEBP / AVIF | browser | Change dimensions in pixels or percent, or shrink to an exact file size in KB (e.g. 200 KB for online forms). |
| `crop-rotate-image` Crop & rotate images | JPG / PNG / WEBP / AVIF / GIF / BMP / TIFF / SVG / ICO / HEIC / JXL → JPG / PNG / WEBP / AVIF | browser | Rotate, flip, and crop to square, 16:9 and more — for many images at once. |
| `remove-image-metadata` Remove image metadata (EXIF & GPS) | JPG / PNG / WEBP → JPG / PNG / WEBP | browser | Strip GPS location, camera and date before sharing photos, with no quality loss. |
| `watermark-image` Watermark images | JPG / PNG / WEBP / AVIF / GIF / BMP / TIFF / SVG / ICO / HEIC / JXL → JPG / PNG / WEBP / AVIF | browser | Put Arabic or English text, or your logo, on images — once or tiled. |
| `favicon-generator` Favicon generator | JPG / PNG / WEBP / AVIF / GIF / BMP / TIFF / SVG / ICO / HEIC / JXL → ICO / PNG | browser | From one image: favicon.ico, every size from 16 to 512, a web manifest and the ready-to-paste HTML. |
| `image-to-svg` Image to SVG (vectorize) | JPG / PNG / WEBP / AVIF / GIF / BMP / TIFF / SVG / ICO / HEIC / JXL → SVG | browser | Turn logos and drawings into SVG that scales without blur — for print and cutting. |
| `url-to-image` Website screenshot | own page → PNG / JPG / WEBP | server | Capture any web page as an image, as it looks on a desktop or a phone. |

## Documents (10)

| Tool | In → Out | Runs | What it does |
|---|---|---|---|
| `markdown-to-pdf` Markdown to PDF (Arabic-ready) | MD / MARKDOWN / TXT (own page) → PDF | browser | A live editor: write in Arabic and English, pick a report, CV or letter template, and save a PDF with proper Arabic. |
| `markdown-to-html` Markdown to HTML | MD / MARKDOWN / TXT → HTML | browser | One styled HTML page, with tables, math and highlighted code. |
| `markdown-to-word` Markdown to Word | MD / MARKDOWN / TXT → DOCX | browser | A Word document with headings, lists and tables; Arabic paragraphs right-to-left. |
| `word-to-html` Word to HTML | DOCX → HTML | browser | A clean web page from a Word document — headings, lists, tables, images; Arabic stays right-to-left. |
| `word-to-markdown` Word to Markdown | DOCX → MD | browser | Turn a Word document into Markdown for sites, docs and GitHub. |
| `translate-document` Translate documents (English ↔ Arabic) | own page → — | browser | Translate Word, PowerPoint, Excel and text files keeping layout and tables; Arabic output turns right-to-left by itself. The free translation runs on your device — the file is not uploaded. |
| `document-convert` Document converter (pandoc) | MD / MARKDOWN / TXT / DOCX / ODT / EPUB / HTML / HTM / TEX / RST / ORG → DOCX / ODT / MD / HTML / EPUB / TEX / RST | server | Convert between Word, ODT, Markdown, HTML, EPUB and LaTeX, with automatic Arabic direction. |
| `latex-to-word` LaTeX to Word | TEX → DOCX | server | Turn a LaTeX file into a Word document with headings, lists and equations. |
| `word-to-latex` Word to LaTeX | DOCX / ODT → TEX | server | Turn a Word or ODT document into an editable LaTeX file. |
| `txt-to-html` Text to HTML | TXT → HTML | browser | Turn plain .txt files into ready-to-view HTML pages, with full Arabic support. |

## Data & spreadsheets (16)

| Tool | In → Out | Runs | What it does |
|---|---|---|---|
| `excel-to-csv` Excel to CSV | XLSX / XLSM / XLS / ODS / CSV / TSV / JSON → CSV | browser | Each sheet becomes a CSV that Excel opens with Arabic intact (UTF-8 with BOM). |
| `excel-to-json` Excel to JSON | XLSX / XLSM / XLS / ODS / CSV / TSV / JSON → JSON | browser | Each row becomes a JSON object keyed by the column headers. |
| `excel-to-html` Excel to HTML table | XLSX / XLSM / XLS / ODS / CSV / TSV / JSON → HTML | browser | A styled HTML table page, right-to-left automatically for Arabic. |
| `excel-to-markdown` Excel to Markdown table | XLSX / XLSM / XLS / ODS / CSV / TSV / JSON → MD | browser | A Markdown table ready to paste into GitHub or docs. |
| `excel-to-sql` Excel to SQL | XLSX / XLSM / XLS / ODS / CSV / TSV / JSON → SQL | browser | INSERT statements (plus CREATE TABLE) to load the data into any database. |
| `convert-to-excel` Convert to Excel | XLSX / XLSM / XLS / ODS / CSV / TSV / JSON → XLSX | browser | Turn CSV, JSON, ODS or old XLS into XLSX — right-to-left sheets for Arabic. |
| `convert-to-json` Convert to JSON | JSON / YAML / YML / XML / TOML → JSON | browser | Convert between JSON, YAML, XML and TOML — output JSON. |
| `convert-to-yaml` Convert to YAML | JSON / YAML / YML / XML / TOML → YAML | browser | Convert between JSON, YAML, XML and TOML — output YAML. |
| `convert-to-xml` Convert to XML | JSON / YAML / YML / XML / TOML → XML | browser | Convert between JSON, YAML, XML and TOML — output XML. |
| `convert-to-toml` Convert to TOML | JSON / YAML / YML / XML / TOML → TOML | browser | Convert between JSON, YAML, XML and TOML — output TOML. |
| `merge-excel` Merge Excel files | XLSX / XLSM / XLS / ODS / CSV / TSV / JSON ×2+ → XLSX | browser | Combine several Excel or CSV files into one — stacked (columns matched by name) or one sheet each. |
| `split-excel` Split an Excel file | XLSX / XLSM / XLS / ODS / CSV / TSV / JSON → XLSX | browser | One file per value in a column (each branch, city or employee) or every N rows — headers kept in each. |
| `remove-duplicates` Remove duplicate rows | XLSX / XLSM / XLS / ODS / CSV / TSV / JSON → XLSX | browser | Remove repeats from tables and customer lists — compare whole rows or chosen columns like Phone. |
| `clean-data` Clean spreadsheet data | XLSX / XLSM / XLS / ODS / CSV / TSV / JSON → XLSX | browser | Trim extra spaces, drop empty rows and columns, unify Arabic and Western digits. |
| `excel-to-vcard` Excel contacts to phone (vCard) | XLSX / XLSM / XLS / ODS / CSV / TSV / JSON → VCF | browser | Turn a list of names and numbers into a vCard file your phone or Gmail imports in one go. |
| `vcard-to-excel` Phone contacts (vCard) to Excel | VCF / VCARD → XLSX | browser | Turn a vCard file (from a phone or Gmail) into an Excel table of names, numbers and emails. |

## Office tools (8)

| Tool | In → Out | Runs | What it does |
|---|---|---|---|
| `invoice-maker` Invoice maker (PDF) | own page → — | browser | A print-ready Arabic/English invoice: items, discount, VAT, total in words, your logo, and the Saudi ZATCA QR code. |
| `tafqeet` Amount in words (Arabic tafqeet) | own page → — | browser | Turn an amount into Arabic and English words for invoices and cheques — EGP, SAR, AED, KWD, USD, EUR. |
| `hijri-date` Hijri ↔ Gregorian date | own page → — | browser | Convert any date between Hijri and Gregorian (Umm al-Qura calendar). |
| `arabic-text` Arabic text tools | own page → — | browser | Remove diacritics and tatweel, switch digits between ١٢٣ and 123, normalise letters, count words. |
| `vat-calculator` VAT calculator | own page → — | browser | Add VAT to an amount or take it out (Egypt 14%, Saudi 15%, UAE 5%), with the total in Arabic words. |
| `qr-code` QR code maker | own page → — | browser | A QR code for a link, Arabic text, a Wi-Fi network or a contact, in your colours — PNG or SVG. |
| `read-qr` Read a QR code from an image | JPG / PNG / WEBP / AVIF / GIF / BMP / TIFF / SVG / ICO / HEIC / JXL → TXT | browser | Upload a photo or screenshot with a QR code and get what it says. |
| `barcode` Barcode maker | own page → — | browser | EAN13 for products, CODE128 and more — ready for label printing. |

## Text recognition (OCR) (3)

| Tool | In → Out | Runs | What it does |
|---|---|---|---|
| `ocr-image` Image to text (OCR) | JPG / PNG / WEBP / AVIF / GIF / BMP / TIFF / SVG / ICO / HEIC / JXL → TXT / PDF | browser | Turn a photo of a document or a screenshot into copyable Arabic and English text, or a searchable PDF. |
| `ocr-pdf` OCR scanned PDFs | PDF → TXT / PDF | browser | Make a scanned PDF searchable and copyable, or get its text (up to 20 pages in the browser). |
| `ocr-pdf-server` OCR for large PDFs | PDF → PDF | server | Make a scanned PDF searchable and copyable, any number of pages (OCRmyPDF), and straighten tilted pages. |

## Files & archives (4)

| Tool | In → Out | Runs | What it does |
|---|---|---|---|
| `password-generator` Password generator | own page → — | browser | Make strong random passwords on your device, without look-alike characters, with a strength meter. |
| `create-zip` Create a ZIP | any file ×1+ → ZIP | browser | Put any files into one ZIP to send them easily. |
| `extract-zip` Extract a ZIP | ZIP →  | browser | Open a ZIP and download what is inside, one by one or all at once. |
| `batch-rename` Batch rename files | any file ×1+ →  | browser | Rename dozens of files at once with a pattern and numbering (like invoice-001), then download as a ZIP. |

## Ebooks (4)

| Tool | In → Out | Runs | What it does |
|---|---|---|---|
| `ebook-convert` Ebook converter | EPUB / MOBI / AZW3 / AZW / FB2 / DOCX / ODT / RTF / TXT / PDF → EPUB / AZW3 / MOBI / FB2 / DOCX / PDF / TXT | server | Convert books between EPUB, Kindle (AZW3/MOBI), FB2, PDF and Word with calibre. |
| `epub-to-pdf` EPUB to PDF | EPUB → PDF | server | Turn an EPUB book into an A4 PDF with page numbers, to print or read anywhere. |
| `pdf-to-epub` PDF to EPUB | PDF → EPUB | server | Turn a text PDF into a reflowable EPUB for phones and e-readers. |
| `mobi-to-epub` Kindle (MOBI/AZW3) to EPUB | MOBI / AZW3 / AZW → EPUB | server | Turn DRM-free Kindle books into EPUB to read in any app. |

## Audio & video (10)

| Tool | In → Out | Runs | What it does |
|---|---|---|---|
| `video-to-mp4` Convert video to MP4 | MP4 / M4V / MOV / WEBM / MKV → MP4 | browser | Turn iPhone MOV, WebM or MKV into MP4 that plays on any device and in WhatsApp — on your device, no upload. |
| `video-to-webm` Convert video to WebM | MP4 / M4V / MOV / WEBM / MKV → WEBM | browser | WebM is an open, light format for websites (VP9 or AV1 with Opus). |
| `compress-video` Compress video | MP4 / M4V / MOV / WEBM / MKV → same format | browser | Shrink a video for WhatsApp or email by lowering resolution and bitrate. The original is kept if it would not get smaller. |
| `video-to-mp3` Extract audio from video | MP4 / M4V / MOV / WEBM / MKV → MP3 / M4A / WAV / OGG / FLAC | browser | Save the sound of any video as MP3, M4A or WAV — a lecture, a meeting or a clip. |
| `convert-audio` Convert audio (MP3, WAV, M4A...) | MP3 / WAV / OGG / OGA / OPUS / M4A / AAC / FLAC → MP3 / M4A / WAV / OGG / FLAC | browser | Convert between MP3, WAV, M4A, OGG and FLAC — WhatsApp voice notes (OPUS) included. |
| `trim-media` Trim video or audio | MP4 / M4V / MOV / WEBM / MKV / MP3 / WAV / OGG / OGA / OPUS / M4A / AAC / FLAC → same format | browser | Keep part of a video or audio file by setting a start and an end, usually without re-encoding. |
| `mute-video` Remove sound from video | MP4 / M4V / MOV / WEBM / MKV → same format | browser | Take the audio out of a video without touching the picture, in seconds. |
| `rotate-video` Rotate video | MP4 / M4V / MOV / WEBM / MKV → same format | browser | Fix a video filmed sideways or upside down. |
| `video-to-gif` Video to GIF | MP4 / M4V / MOV / WEBM / MKV → GIF | browser | Make an animated GIF from a short part of a video, for slides and chats. |
| `media-convert` Audio & video converter (FFmpeg) | MP4 / M4V / MOV / WEBM / MKV / AVI / WMV / ASF / FLV / 3GP / 3G2 / MPG / MPEG / TS / MTS / M2TS / VOB / OGV / MP3 / WAV / OGG / OGA / OPUS / M4A / AAC / FLAC / AMR / WMA / AIF / AIFF / AC3 / CAF / MKA → MP4 / WEBM / MP3 / M4A / WAV / OGG | server | For big files and old formats: AVI, WMV, FLV, 3GP, AMR, WMA to MP4, MP3 and more, with compression and resizing. |
