"""Regenerates the tiny image fixtures (each well under 50 KB).

Needs Pillow 12+ with AVIF, plus `pip install pillow-heif pillow-jxl-plugin`.
Run from this folder: python make_fixtures.py
"""
from PIL import Image, ImageDraw
import pillow_heif
import pillow_jxl  # noqa: F401  (registers .jxl)

pillow_heif.register_heif_opener()
W, H = 128, 96


def scene(mode="RGB"):
    img = Image.new(mode, (W, H), (240, 236, 226, 255) if mode == "RGBA" else (240, 236, 226))
    d = ImageDraw.Draw(img)
    for x in range(W):  # a gradient band so lossy codecs have something to chew on
        d.line([(x, 0), (x, 30)], fill=(15 + x, 110, 102 + x // 2))
    d.ellipse([10, 38, 58, 86], fill=(194, 106, 0))
    d.rectangle([70, 40, 118, 86], fill=(15, 110, 102))
    d.polygon([(64, 34), (94, 92), (34, 92)], outline=(29, 35, 33))
    return img


rgb = scene()

# JPEG with EXIF: camera make, GPS and orientation 6 (stored sideways, shown upright).
exif = Image.Exif()
exif[0x010F] = "FixtureCam"            # Make
exif[0x0112] = 6                       # Orientation: rotate 90 CW to display
gps = {1: "N", 2: (30.0, 2.0, 41.0), 3: "E", 4: (31.0, 14.0, 9.0)}
exif[0x8825] = gps
rgb.rotate(90, expand=True).save("photo.jpg", quality=80, exif=exif.tobytes())

rgba = scene("RGBA")
ImageDraw.Draw(rgba).rectangle([0, 60, 40, 96], fill=(0, 0, 0, 0))  # a transparent corner
rgba.save("alpha.png", optimize=True)

rgb.save("photo.webp", quality=80)
rgb.save("photo.avif", quality=60)
rgb.save("photo.bmp")
rgb.save("photo.tiff", compression="tiff_lzw")
rgb.save("photo.heic", quality=60)
rgb.save("photo.jxl", quality=80)
rgb.resize((48, 48)).save("icon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

frame2 = rgb.transpose(Image.FLIP_LEFT_RIGHT)
rgb.save("anim.gif", save_all=True, append_images=[frame2], duration=300, loop=0)

with open("broken.jpg", "wb") as f:  # a JPEG header followed by junk
    f.write(b"\xff\xd8\xff\xe0" + b"\x00" * 64 + b"not really an image")

with open("logo.svg", "w", encoding="utf-8") as f:
    f.write(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">'
        '<rect width="64" height="64" rx="14" fill="#0f6e66"/>'
        '<circle cx="32" cy="32" r="16" fill="#c26a00"/></svg>\n'
    )

# PNG and WebP that carry metadata, for the "remove metadata" tool.
from PIL import PngImagePlugin  # noqa: E402

info = PngImagePlugin.PngInfo()
info.add_text("Author", "Fixture Person")
info.add_text("Location", "30.04, 31.23")
rgb.save("meta.png", pnginfo=info, exif=exif.tobytes())
rgb.save("meta.webp", quality=80, exif=exif.tobytes())
