/** The document the Markdown editor opens with (until the visitor writes their own). */
export const SAMPLE = {
	ar: `# تقرير الزيارة الشهرية

هذا مثال يوضح ما يدعمه **المعمل**: عناوين، قوائم، جداول، أكواد، معادلات ورسوم.
اكتب بالعربية أو بالإنجليزية — كل فقرة تأخذ اتجاهها تلقائيًا.

This English paragraph stays left-to-right inside an Arabic document.

## ملخص الأعمال

- فحص وحدات التكييف وتنظيف الفلاتر
- تغيير السير في الوحدة رقم 3
- **ملاحظة:** يلزم توريد قطعة غيار خلال أسبوع

## جدول البنود

| البند | الحالة | التكلفة |
| --- | --- | --- |
| فلتر هواء | تم التغيير | 450 |
| سير مروحة | تم التغيير | 320 |
| زيت ضاغط | يحتاج متابعة | — |

## معادلة

قانون القدرة: $P = V \\times I$، وعلى سطر مستقل:

$$E = mc^2$$

## مخطط سير العمل

\`\`\`mermaid
flowchart LR
  A[بلاغ] --> B[زيارة] --> C[تقرير]
\`\`\`

## كود

\`\`\`js
const total = items.reduce((s, i) => s + i.cost, 0);
\`\`\`

> اطبع الملف من زر «طباعة / حفظ PDF» واختر «حفظ كـ PDF».
`,
	en: `# Monthly visit report

This sample shows what **Office Lab** supports: headings, lists, tables, code, math and diagrams.
Write in English or Arabic — every paragraph picks its own direction.

فقرة عربية داخل مستند إنجليزي تبقى من اليمين لليسار.

## Summary

- Inspected the AC units and cleaned the filters
- Replaced the belt on unit 3
- **Note:** a spare part is needed within a week

## Items

| Item | Status | Cost |
| --- | --- | --- |
| Air filter | Replaced | 450 |
| Fan belt | Replaced | 320 |
| Compressor oil | Follow up | — |

## Math

Power: $P = V \\times I$, and on its own line:

$$E = mc^2$$

## Workflow

\`\`\`mermaid
flowchart LR
  A[Request] --> B[Visit] --> C[Report]
\`\`\`

## Code

\`\`\`js
const total = items.reduce((s, i) => s + i.cost, 0);
\`\`\`

> Use “Print / Save as PDF” and choose “Save as PDF”.
`
};
