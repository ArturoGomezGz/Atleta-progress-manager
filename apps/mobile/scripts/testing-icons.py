#!/usr/bin/env python3
"""Genera los íconos de la variante de testing a partir de los de producción:
la misma imagen con una franja ámbar que dice TESTING, para distinguir las dos apps
instaladas en el mismo teléfono. Se vuelve a correr cuando cambian los íconos de assets/:

    python3 apps/mobile/scripts/testing-icons.py

Requiere Pillow. La fuente es Inter Bold, la misma de la app (se busca en node_modules).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
OUT = ASSETS / "testing"
FONT = next(ROOT.glob("node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"))
AMBER = (245, 158, 11, 255)  # colors.warning de la app
INK = (8, 9, 12, 255)  # colors.background


def band(img: Image.Image, top: float, bottom: float, width_ratio: float, text: bool = True, ink=INK, fill=AMBER):
    """Franja horizontal centrada con el texto TESTING. top/bottom/ancho son proporciones del lado."""
    w, h = img.size
    d = ImageDraw.Draw(img)
    y0, y1 = round(h * top), round(h * bottom)
    x0, x1 = round(w * (1 - width_ratio) / 2), round(w * (1 + width_ratio) / 2)
    d.rounded_rectangle((x0, y0, x1, y1), radius=(y1 - y0) // 2, fill=fill)
    # El texto ocupa ~62 % del alto de la franja y se centra
    size = round((y1 - y0) * 0.62)
    font = ImageFont.truetype(str(FONT), size)
    d.text(((x0 + x1) / 2, (y0 + y1) / 2), "TESTING", font=font, fill=ink, anchor="mm")


def main():
    OUT.mkdir(exist_ok=True)

    # Ícono completo (1024): franja ancha abajo
    icon = Image.open(ASSETS / "icon.png").convert("RGBA")
    band(icon, 0.80, 0.93, 0.78)
    icon.convert("RGB").save(OUT / "icon.png")

    # Capa frontal del ícono adaptivo (512): la máscara de Android recorta a ~66 %, la franja queda dentro
    fg = Image.open(ASSETS / "android-icon-foreground.png").convert("RGBA")
    band(fg, 0.69, 0.78, 0.46)
    fg.save(OUT / "android-icon-foreground.png")

    # Monocromo (íconos temáticos de Android 13+): solo alfa; la franja sólida con el texto vaciado
    mono = Image.open(ASSETS / "android-icon-monochrome.png").convert("RGBA")
    mw, mh = mono.size
    layer = Image.new("RGBA", mono.size, (0, 0, 0, 0))
    band(layer, 0.69, 0.79, 0.50, fill=(255, 255, 255, 255), ink=(0, 0, 0, 0))
    # Con ink transparente el texto no vacía nada: se vacía a mano
    d = ImageDraw.Draw(layer)
    y0, y1 = round(mh * 0.69), round(mh * 0.79)
    font = ImageFont.truetype(str(FONT), round((y1 - y0) * 0.62))
    mask = Image.new("L", mono.size, 0)
    ImageDraw.Draw(mask).text((mw / 2, (y0 + y1) / 2), "TESTING", font=font, fill=255, anchor="mm")
    layer.paste((0, 0, 0, 0), mask=mask)
    mono.alpha_composite(layer)
    mono.save(OUT / "android-icon-monochrome.png")
    print("Íconos de testing en", OUT)


main()
