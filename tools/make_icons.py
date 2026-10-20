"""Membuat ikon aplikasi PNG. Jalankan: python3 tools/make_icons.py"""
from pathlib import Path

from PIL import Image, ImageDraw

GREEN = (15, 157, 88)
WHITE = (255, 255, 255)
OUT = Path(__file__).resolve().parent.parent / "icons"


def draw_wallet(size, padding_ratio, rounded):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=size * 0.22, fill=GREEN)
    else:
        d.rectangle([0, 0, size, size], fill=GREEN)

    p = size * padding_ratio
    w = size - 2 * p
    # Badan dompet
    top = p + w * 0.18
    d.rounded_rectangle([p, top, size - p, size - p], radius=w * 0.12, fill=WHITE)
    # Kantong kancing
    d.rounded_rectangle(
        [p + w * 0.58, top + w * 0.26, size - p + w * 0.04, top + w * 0.56],
        radius=w * 0.08, fill=GREEN,
    )
    r = w * 0.06
    cx, cy = p + w * 0.74, top + w * 0.41
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
    # Lipatan atas
    d.rounded_rectangle([p + w * 0.08, p, size - p - w * 0.2, top + w * 0.08], radius=w * 0.06, fill=WHITE)
    d.rectangle([p + w * 0.08, top - w * 0.02, size - p - w * 0.2, top + w * 0.04], fill=GREEN)
    return img


OUT.mkdir(exist_ok=True)
draw_wallet(192, 0.2, True).save(OUT / "icon-192.png")
draw_wallet(512, 0.2, True).save(OUT / "icon-512.png")
# Ikon maskable: latar penuh, isi di zona aman tengah
draw_wallet(512, 0.28, False).save(OUT / "icon-maskable-512.png")
print("Ikon dibuat di", OUT)
