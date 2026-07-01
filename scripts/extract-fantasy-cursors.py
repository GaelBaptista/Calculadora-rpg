#!/usr/bin/env python3
"""Extrai os 3 cursores fantasy da imagem composta ChatGPT."""
from pathlib import Path
from PIL import Image

SRC = Path(r'C:\Users\User\Downloads\ChatGPT Image 1 de jul. de 2026, 14_00_34.png')
if not SRC.exists():
    SRC = Path(__file__).resolve().parent.parent / 'assets' / 'cursors-fantasy-sheet.png'

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'cursors'

SLICES = [
    ('cursor-default', 0, (0.10, 0.10)),
    ('cursor-pointer', 1, (0.10, 0.10)),
    ('cursor-text', 2, (0.50, 0.50)),
]


def luminance(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


def is_background(r, g, b, a):
    if a < 25:
        return True
    lum = luminance(r, g, b)
    # fundo escuro marrom/preto da arte
    if lum < 72:
        return True
    # vinheta muito escura
    if r < 90 and g < 80 and b < 75:
        return True
    return False


def remove_bg(img: Image.Image) -> Image.Image:
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_background(r, g, b, a):
                px[x, y] = (0, 0, 0, 0)
    return img


def trim_and_resize(img: Image.Image, max_px: int = 32) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    img = img.crop(bbox)
    iw, ih = img.size
    scale = max_px / max(iw, ih)
    nw = max(1, int(iw * scale))
    nh = max(1, int(ih * scale))
    return img.resize((nw, nh), Image.Resampling.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SRC)
    w, h = sheet.size
    col_w = w // 3
    hotspots = {}

    for name, col, hr in SLICES:
        x1 = col * col_w + 40
        x2 = (col + 1) * col_w - 40
        y1 = int(h * 0.34)
        y2 = int(h * 0.88)
        crop = sheet.crop((x1, y1, x2, y2))
        crop = remove_bg(crop)
        out = trim_and_resize(crop, 32)
        sw, sh = out.size
        hx = max(0, min(sw - 1, int(sw * hr[0])))
        hy = max(0, min(sh - 1, int(sh * hr[1])))
        out.save(OUT / f'{name}.png')
        hotspots[name] = (hx, hy, out.size)
        print(f'{name}: {out.size} hotspot ({hx}, {hy})')

    ref = Path(__file__).resolve().parent.parent / 'assets' / 'cursors-fantasy-sheet.png'
    if SRC != ref and SRC.exists() and not ref.exists():
        import shutil
        shutil.copy2(SRC, ref)

    return hotspots


if __name__ == '__main__':
    main()
