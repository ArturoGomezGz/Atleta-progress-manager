#!/usr/bin/env python3
"""Genera los íconos de producción de la app (Anillo PR, la marca de Atleta) en assets/.
Misma geometría que apps/web/src/app/icon.svg. Después hay que volver a correr testing-icons.py:

    python3 apps/mobile/scripts/brand-icons.py && python3 apps/mobile/scripts/testing-icons.py

Requiere Pillow.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent / "assets"
SS = 4  # supersampling para bordes suaves
BLUE, GOLD, INK, FG = (71, 145, 255), (251, 191, 36), (10, 13, 19), (230, 234, 240)
SWEEP = 154.6 / (2 * math.pi * 30) * 360  # arco del anillo, en grados


def gradient(size):
    """Fondo de la marca: #151b27 arriba a #06080c abajo."""
    top, bot = (21, 27, 39), (6, 8, 12)
    img = Image.new("RGBA", (1, size))
    for y in range(size):
        t = y / (size - 1)
        img.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(top, bot)) + (255,))
    return img.resize((size, size))


def mark(size, scale, mono=False):
    """El anillo sobre fondo transparente. `scale` = píxeles por unidad del viewBox de 100."""
    n = size * SS
    s = scale * SS
    ox = oy = n / 2 - 50 * s
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))

    def P(x, y):
        return (ox + x * s, oy + y * s)

    def disc(layer, x, y, r, fill):
        cx, cy = P(x, y)
        ImageDraw.Draw(layer).ellipse((cx - r * s, cy - r * s, cx + r * s, cy + r * s), fill=fill)

    def arc(layer, start, end, fill, caps):
        d = ImageDraw.Draw(layer)
        a, b = P(15, 15), P(85, 85)
        d.arc((a[0], a[1], b[0], b[1]), start, end, fill=fill, width=round(10 * s))
        if caps:
            for ang in (start, end):
                r = math.radians(ang)
                disc(layer, 50 + 30 * math.cos(r), 50 + 30 * math.sin(r), 5, fill)

    # Pista del anillo
    track = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    arc(track, 0, 360, BLUE + (0 if mono else 46,), False)
    img.alpha_composite(track)
    # Progreso
    arc(img, -90, -90 + SWEEP, (255, 255, 255, 255) if mono else BLUE + (255,), True)
    # Punto dorado del PR, con borde del color del fondo
    end = math.radians(-90 + SWEEP)
    gx, gy = 50 + 30 * math.cos(end), 50 + 30 * math.sin(end)
    if mono:
        disc(img, gx, gy, 7.5, (255, 255, 255, 255))
    else:
        disc(img, gx, gy, 8.75, INK + (255,))
        disc(img, gx, gy, 7.5, GOLD + (255,))
    # Chevron
    d = ImageDraw.Draw(img)
    pts = [P(40, 57), P(50, 45), P(60, 57)]
    col = (255, 255, 255, 255) if mono else FG + (255,)
    d.line(pts, fill=col, width=round(7 * s), joint="curve")
    for x, y in ((40, 57), (50, 45), (60, 57)):
        disc(img, x, y, 3.5, col)
    return img.resize((size, size), Image.LANCZOS)


def main():
    # Ícono completo: la marca sobre el fondo oscuro
    icon = gradient(1024)
    icon.alpha_composite(mark(1024, 8.4))
    icon.convert("RGB").save(ASSETS / "icon.png")

    # Adaptivo: fondo y capa frontal; Android recorta a ~66 % central, la marca queda dentro
    gradient(512).save(ASSETS / "android-icon-background.png")
    mark(512, 4.3).save(ASSETS / "android-icon-foreground.png")

    # Monocromo (íconos temáticos de Android 13+ y notificaciones): solo forma
    mark(432, 3.6, mono=True).save(ASSETS / "android-icon-monochrome.png")
    print("Íconos de marca en", ASSETS)


main()
