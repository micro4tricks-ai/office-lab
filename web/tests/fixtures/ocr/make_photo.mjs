// Phone-photo fixture, step 1: node make_photo.mjs page.png (Chromium shapes the Arabic); step 2: python degrade_photo.py page.png photo-letter.jpg
import { chromium } from 'playwright';
const html = `<!doctype html><html dir="rtl"><body style="margin:0;background:#fafaf7;font:22px Arial, Tahoma;color:#222;width:900px;padding:70px 80px;line-height:2">
<p>السادة / شركة النور للتجارة والمقاولات</p>
<p>تحية طيبة وبعد،</p>
<p>نفيدكم بأنه تم الانتهاء من أعمال الصيانة الدورية لوحدات التكييف بالمبنى الإداري بتاريخ ١٥ / ٩ / ٢٠٢٦، وقد شملت الأعمال تنظيف الفلاتر وفحص الضواغط واستبدال قطعة غيار واحدة بالوحدة رقم 3.</p>
<p>إجمالي قيمة الأعمال 4,750 جنيه مصري شاملة ضريبة القيمة المضافة.</p>
<p>وتفضلوا بقبول فائق الاحترام،</p>
<p style="text-align:left">مدير إدارة الصيانة</p>
</body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1060, height: 800 } });
await p.setContent(html);
await p.screenshot({ path: process.argv[2], fullPage: true });
await b.close();
