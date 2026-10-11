# المعمل · Office Lab

<div dir="rtl">

**المعمل** أدوات مجانية ومفتوحة المصدر لتحويل ملفات المكاتب ومعالجتها: الصور، وPDF، والمستندات، والبيانات.
الأدوات التي تعمل في المتصفح لا ترفع ملفك إلى أي مكان؛ كل شيء يحدث على جهازك.

- **النسخة الثابتة (المتصفح فقط):** تُنشر على GitHub Pages — https://micro4tricks-ai.github.io/office-lab/
- **نسخة الخادم (Docker):** للتحويلات الثقيلة (Office ↔ PDF، PDF → Word، الكتب الإلكترونية…) — قيد الإنشاء (المرحلة 4).

### التشغيل محليًا
</div>

```bash
cd web
npm install
npm run dev
```

<div dir="rtl">

> الحالة الحالية: المرحلة 0 (الهيكل والنشر). راجع `docs/PROGRESS.md`.

</div>

---

**Office Lab** is a free, open-source toolkit for everyday office files — images, PDF, documents and data.
Browser tools never upload your file: everything runs on your device.

- **Static site (browser-only):** deployed to GitHub Pages — https://micro4tricks-ai.github.io/office-lab/
- **Server version (Docker):** heavy conversions (Office ↔ PDF, PDF → Word, ebooks…) — coming in Phase 4.

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
| `docs/` | Build spec, progress log, supported formats |
| `.github/workflows/` | CI (build + tests) and GitHub Pages deploy |

### License

[AGPL-3.0](LICENSE).
