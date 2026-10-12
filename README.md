# المعمل · Office Lab

<div dir="rtl">

**المعمل** أدوات مجانية ومفتوحة المصدر لتحويل ملفات المكاتب ومعالجتها: الصور، وPDF، والمستندات، والبيانات.
الأدوات التي تعمل في المتصفح لا ترفع ملفك إلى أي مكان؛ كل شيء يحدث على جهازك.

- **النسخة الثابتة (المتصفح فقط):** تُنشر على GitHub Pages — https://micro4tricks-ai.github.io/office-lab/
- **نسخة الخادم (Docker):** للتحويلات الثقيلة (Office ↔ PDF، PDF → Word، الكتب الإلكترونية، OCR للملفات الكبيرة…). التشغيل: `docker compose -f deploy/docker-compose.yml up -d --build` ثم http://localhost — والتركيب على VPS في `deploy/HOSTINGER.md`.

### التشغيل محليًا
</div>

```bash
cd web
npm install
npm run dev
```

<div dir="rtl">

> الحالة الحالية: 101 أداة (81 في المتصفح و20 في نسخة الخادم). راجع `docs/PROGRESS.md` و`docs/FORMATS.md`.

</div>

---

**Office Lab** is a free, open-source toolkit for everyday office files — images, PDF, documents and data.
Browser tools never upload your file: everything runs on your device.

- **Static site (browser-only):** deployed to GitHub Pages — https://micro4tricks-ai.github.io/office-lab/
- **Server version (Docker):** heavy conversions (Office ↔ PDF, PDF → Word, ebooks, OCR for long scans…).
  `docker compose -f deploy/docker-compose.yml up -d --build` → http://localhost. VPS guide: `deploy/HOSTINGER.md` (Arabic).

### Run locally

```bash
cd web
npm install
npm run dev            # http://localhost:5173
npm run check          # type check
npx vitest run         # unit tests
npx playwright test    # end-to-end (after a build)
```

### Layout

| Path | What |
|---|---|
| `web/` | SvelteKit static site — registry, adapters, workers, i18n |
| `server/` | FastAPI conversion API (Docker image with calibre, pandoc, OCRmyPDF, Ghostscript, qpdf) |
| `deploy/` | docker compose (Caddy + API + Gotenberg), Caddyfile, VPS install script and guide |
| `docs/` | Build spec, progress log, supported formats |
| `.github/workflows/` | CI (build + tests) and GitHub Pages deploy |

### License

[AGPL-3.0](LICENSE).
