"""WhatsApp export fixtures: an Arabic Android .txt and an iPhone .zip with a photo. Run from this folder."""
import zipfile
from pathlib import Path

RLM, LRM, NNBSP = chr(0x200F), chr(0x200E), chr(0x202F)
ar_day = lambda d: f"{d}{RLM}/١٠{RLM}/٢٠٢٦"
long_text = " ".join(["هذه رسالة طويلة جدًا لاختبار التفاف الأسطر داخل الفقاعة."] * 8)
lines = [f"{ar_day('١١')}، ٩:٠٠ ص - الرسائل والمكالمات مشفرة تمامًا بين الطرفين."]
for i in range(1, 61):
    who = "أحمد" if i % 3 else "سارة"
    lines.append(f"{ar_day('١١')}، ٩:{i:02d} ص - {who}: رسالة رقم {i} عن صيانة المكيفات")
lines.append(f"{ar_day('١٢')}، ١٠:٠٠ ص - سارة: {long_text}")
lines.append(f"{ar_day('١٢')}، ١٠:٠١ ص - أحمد: <تم استبعاد الوسائط>")
lines.append(f"{ar_day('١٢')}، ١٠:٠٢ ص - أحمد: Invoice INV-2026 is ready")
lines.append("سطر ثانٍ في نفس الرسالة")
Path("محادثة واتساب مع فريق الصيانة.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")

ios = "\n".join([
    f"[12/10/2026, 21:41:05] Office Team: {LRM}Messages and calls are end-to-end encrypted.",
    "[12/10/2026, 21:42:10] Mona: Here is the site photo",
    f"{LRM}[12/10/2026, 21:42:30] Mona: {LRM}<attached: 00000003-PHOTO-2026-10-12-21-42-30.jpg>",
    "[12/10/2026, 21:45:00] Karim: Thanks, received 👍",
]) + "\n"
photo = Path("../images/photo.jpg").read_bytes()
with zipfile.ZipFile("WhatsApp Chat - Office Team.zip", "w") as z:
    z.writestr("_chat.txt", ios)
    z.writestr("00000003-PHOTO-2026-10-12-21-42-30.jpg", photo)
