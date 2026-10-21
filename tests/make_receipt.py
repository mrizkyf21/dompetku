"""Membuat contoh foto struk minimarket untuk menguji fitur pindai struk.

Pemakaian: python3 tests/make_receipt.py tests/fixtures/struk-contoh.jpg [skala]
"""
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = sys.argv[1]
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
font = ImageFont.truetype(FONT, 22)
bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 26)

lines = [
    ("c", "TOKO MAKMUR JAYA", bold),
    ("c", "Jl. Merdeka No. 17, Bandung", font),
    ("c", "NPWP 01.234.567.8-901.000", font),
    ("l", "-" * 40, font),
    ("l", "20.10.2026-18:42   K01/ANDI   0145", font),
    ("l", "-" * 40, font),
    ("l", "BERAS PANDAN WNG 5KG     1   72.500", font),
    ("l", "MINYAK GRG BIMOLI 2L     1   38.900", font),
    ("l", "TELUR AYAM NEGERI 1KG    1   29.000", font),
    ("l", "INDOMIE GRG SPESIAL      5   15.500", font),
    ("l", "GULA PSR GULAKU 1KG      1   17.200", font),
    ("l", "SUSU UHT ULTRA 1L        2   36.000", font),
    ("l", "-" * 40, font),
    ("l", "HARGA JUAL         :       209.100", font),
    ("l", "DISKON             :        -9.100", font),
    ("l", "TOTAL              :       200.000", bold),
    ("l", "TUNAI              :       250.000", font),
    ("l", "KEMBALI            :        50.000", font),
    ("l", "-" * 40, font),
    ("c", "TERIMA KASIH, SELAMAT BELANJA KEMBALI", font),
]

W, H = 620, 120 + 40 * len(lines)
paper = Image.new("RGB", (W, H), (250, 248, 240))
d = ImageDraw.Draw(paper)
y = 60
for align, text, f in lines:
    w = d.textlength(text, font=f)
    x = (W - w) / 2 if align == "c" else 40
    d.text((x, y), text, fill=(35, 35, 40), font=f)
    y += 40

# Letakkan di atas "meja" dengan sedikit miring, seperti difoto
bg = Image.new("RGB", (W + 260, H + 260), (120, 95, 75))
rotated = paper.rotate(2.5, expand=True, fillcolor=(120, 95, 75), resample=Image.BICUBIC)
bg.paste(rotated, (130 - (rotated.width - W) // 2, 130 - (rotated.height - H) // 2))
photo = bg.filter(ImageFilter.GaussianBlur(0.6))
if len(sys.argv) > 2:  # skala besar untuk uji pengecilan foto
    s = float(sys.argv[2])
    photo = photo.resize((int(photo.width * s), int(photo.height * s)))
photo.save(OUT, quality=90)
print(OUT, photo.size)
