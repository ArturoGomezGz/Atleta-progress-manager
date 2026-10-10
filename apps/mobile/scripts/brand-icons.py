#!/usr/bin/env python3
"""Genera los íconos de producción de la app con el Anillo PR, el logo de la marca
(el mismo de apps/web/src/components/atleta-mark.tsx y apps/web/src/app/icon.svg):

    python3 apps/mobile/scripts/brand-icons.py
    python3 apps/mobile/scripts/testing-icons.py   # después, para la variante de testing

Requiere Pillow. Se dibuja a 4x y se reduce para que los bordes salgan suaves.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent / "assets"
BLUE = (71, 145, 255, 255)  # #4791ff
GOLD = (251, 191, 36, 255)  # #fbbf24
CHEVRON = (230, 234, 240, 255)  # #e6eaf0
RIM = (10, 13, 19, 255)  # #0a0d13
SS = 4


def gradient(size: int) -> Image.Image:
    """Fondo de la marca: vertical #151b27 -> #06080c."""
    top, bottom = (21, 27, 39), (6, 8, 12)
    img = Image.new("RGBA", (1, size))
    for y in range(size):
        t = y / (size - 1)
        img.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)) + (255,))
    return img.resize((size, size))


def logo(size: int, scale: float, mono: bool = False) -> Image.Image:
    """Anillo PR sobre fondo transparente. scale = píxeles por unidad del viewBox de 100 (centrado)."""
    n = size * SS
    k = scale * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = n / 2

    def pt(x, y):
        return (c + (x - 50) * k, c + (y - 50) * k)

    r, sw = 30 * k, 10 * k
    ro = r + sw / 2  # PIL dibuja el trazo hacia adentro desde el borde: se pasa el radio exterior
    box = (c - ro, c - ro, c + ro, c + ro)
    # Pista tenue del anillo y arco de progreso (82 %), que arranca arriba y sigue las agujas del reloj
    d.ellipse(box, outline=(255, 255, 255, 64) if mono else (71, 145, 255, 51), width=round(sw))
    d.arc(box, -90, 205.2, fill=(255, 255, 255, 255) if mono else BLUE, width=round(sw))
    for ang in (-90, 205.2):  # puntas redondeadas del arco
        x, y = c + r * math.cos(math.radians(ang)), c + r * math.sin(math.radians(ang))
        d.ellipse((x - sw / 2, y - sw / 2, x + sw / 2, y + sw / 2), fill=(255, 255, 255, 255) if mono else BLUE)
    # Punto dorado donde termina el arco
    dx, dy = pt(22.86, 37.23)
    pr = 7.5 * k
    if not mono:
        d.ellipse((dx - pr - 1.25 * k, dy - pr - 1.25 * k, dx + pr + 1.25 * k, dy + pr + 1.25 * k), fill=RIM)
    d.ellipse((dx - pr, dy - pr, dx + pr, dy + pr), fill=(255, 255, 255, 255) if mono else GOLD)
    # Chevron
    pts = [pt(40, 57), pt(50, 45), pt(60, 57)]
    w = round(7 * k)
    col = (255, 255, 255, 255) if mono else CHEVRON
    d.line(pts, fill=col, width=w, joint="curve")
    for x, y in pts[::2]:
        d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=col)
    return img.resize((size, size), Image.LANCZOS)


def main():
    # Ícono completo (1024): fondo de la marca y el anillo, como el maskable de la web
    icon = gradient(1024)
    icon.alpha_composite(logo(1024, 7.2))
    icon.convert("RGB").save(ASSETS / "icon.png")

    # Ícono adaptivo: fondo + capa frontal (512, la máscara recorta a ~66 %) + monocromo (432)
    gradient(512).save(ASSETS / "android-icon-background.png")
    logo(512, 3.9).save(ASSETS / "android-icon-foreground.png")
    logo(432, 3.6, mono=True).save(ASSETS / "android-icon-monochrome.png")
    print("Íconos de marca en", ASSETS)


main()
