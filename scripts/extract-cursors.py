#!/usr/bin/env python3
"""Extrai cursores steampunk (vikigrafika) do sprite sheet para PNGs CSS."""
from __future__ import annotations

import json
import shutil
from pathlib import Path
from PIL import Image

SRC = Path(__file__).resolve().parent.parent / 'assets' / 'cursors_by_vikigrafika_d5g1ejv.jpg'
OUT_DIR = Path(__file__).resolve().parent.parent / 'assets' / 'cursors'
MANIFEST = OUT_DIR / 'manifest.json'

BG = (80, 80, 80)
BG_TOL = 28

# (nome, x1, y1, x2, y2, hotspot_x_ratio, hotspot_y_ratio)
MANUAL_CROPS = [
    ('hand-pointer', 109, 124, 346, 478, 0.10, 0.10),
    ('hand-grab', 401, 128, 667, 457, 0.50, 0.45),
    ('hand-open', 669, 129, 928, 453, 0.50, 0.50),
    ('hand-zoom', 930, 50, 1285, 490, 0.40, 0.18),
    ('hand-gears', 1085, 76, 1325, 478, 0.50, 0.50),
    ('hand-wait', 1371, 134, 1595, 497, 0.50, 0.35),
    ('hand-alt-peace', 60, 656, 260, 978, 0.50, 0.50),
    ('hand-alt-rock', 280, 652, 500, 978, 0.50, 0.50),
    ('arrow-nw', 100, 1040, 395, 1345, 0.06, 0.06),
    ('arrow-n', 445, 1040, 740, 1345, 0.50, 0.06),
    ('arrow-ne', 790, 1040, 1085, 1345, 0.94, 0.06),
    ('arrow-e', 1135, 1040, 1430, 1345, 0.94, 0.50),
    ('eye-down', 275, 1443, 471, 1712, 0.50, 0.10),
    ('eye-up', 559, 1514, 754, 1744, 0.50, 0.90),
    ('eye-right', 847, 1515, 1104, 1715, 0.10, 0.50),
    ('eye-left', 1183, 1519, 1447, 1719, 0.90, 0.50),
]

ROLES = {
    'default': 'arrow-nw',
    'pointer': 'hand-pointer',
    'grab': 'hand-grab',
    'grabbing': 'hand-grab',
    'wait': 'hand-wait',
    'progress': 'hand-gears',
    'zoom-in': 'hand-zoom',
    'move': 'hand-open',
    'not-allowed': 'hand-alt-rock',
    'help': 'hand-zoom',
}


def is_background(rgba):
    r, g, b, a = rgba
    if a < 10:
        return True
    return abs(r - BG[0]) < BG_TOL and abs(g - BG[1]) < BG_TOL and abs(b - BG[2]) < BG_TOL


def make_transparent(img: Image.Image) -> Image.Image:
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if is_background(px[x, y]):
                px[x, y] = (0, 0, 0, 0)
    return img


def resize_cursor(img: Image.Image, max_side: int) -> Image.Image:
    w, h = img.size
    scale = max_side / max(w, h)
    nw = max(1, int(w * scale))
    nh = max(1, int(h * scale))
    return img.resize((nw, nh), Image.Resampling.LANCZOS)


def main():
    if OUT_DIR.exists():
        for p in OUT_DIR.glob('*.png'):
            p.unlink()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    sheet = Image.open(SRC)
    manifest = {'_roles': ROLES, '_credit': 'Cursors by vikigrafika (DeviantArt)'}

    for name, x1, y1, x2, y2, hxr, hyr in MANUAL_CROPS:
        crop = make_transparent(sheet.crop((x1, y1, x2, y2)))
        entry = {'box': [x1, y1, x2, y2]}

        for size in (32, 48):
            sized = resize_cursor(crop, size)
            sw, sh = sized.size
            hx = max(0, min(sw - 1, int(sw * hxr)))
            hy = max(0, min(sh - 1, int(sh * hyr)))
            suffix = '' if size == 32 else '-48'
            rel = f'assets/cursors/{name}{suffix}.png'
            sized.save(OUT_DIR / f'{name}{suffix}.png')
            if size == 32:
                entry['file'] = rel
                entry['hotspot'] = [hx, hy]
            else:
                entry['file48'] = rel
                entry['hotspot48'] = [int(48 / 32 * hx), int(48 / 32 * hy)]

        manifest[name] = entry

    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'Exported {len(MANUAL_CROPS)} cursors to {OUT_DIR}')


if __name__ == '__main__':
    main()
