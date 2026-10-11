"""Phone-photo fixture, step 2: uneven light, 2.2° tilt, blur, noise, lower resolution, JPEG 70."""
import sys

from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
page = Image.open(src).convert("L")
W, H = page.size
grad = Image.linear_gradient("L").resize((W, H)).rotate(35, fillcolor=128)
page = Image.blend(page, Image.eval(grad, lambda v: 255 - v // 3), 0.35)  # uneven light
page = page.rotate(2.2, resample=Image.BICUBIC, expand=True, fillcolor=90)  # tilt
page = page.filter(ImageFilter.GaussianBlur(0.7))
page = Image.blend(page, Image.effect_noise(page.size, 18), 0.08)
page = page.resize((page.width * 4 // 5, page.height * 4 // 5))  # phone resolution
page.convert("RGB").save(out, "JPEG", quality=70)
print(out, page.size)
