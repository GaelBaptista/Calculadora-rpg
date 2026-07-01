#!/usr/bin/env python3
"""Processa cursores fantasy individuais com fundo transparente e brilho."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter, ImageEnhance

PROJECT = Path(__file__).resolve().parent.parent
OUT = PROJECT / 'assets' / 'cursors'
CURSOR_ASSETS = Path(
    r'C:\Users\User\.cursor\projects\c-Users-User-gemini-antigravity-scratch-t20-encounter-calculator\assets'
)

SOURCES = {
    'default': '947ab607',
    'pointer': '1913b185',
    'text': 'cf4704ee',
    'select': 'de687969',
}


def find_source(fragment: str) -> Path:
    for f in CURSOR_ASSETS.iterdir():
        if fragment in f.name and f.name.endswith('.png'):
            return f
    raise FileNotFoundError(fragment)


def flood_remove_bg(img: Image.Image) -> Image.Image:
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    visited = [[False] * w for _ in range(h)]

    def is_bg(r: int, g: int, b: int) -> bool:
        return r <= 42 and g <= 42 and b <= 42

    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            continue
        visited[y][x] = True
        r, g, b, a = px[x, y]
        if is_bg(r, g, b):
            px[x, y] = (0, 0, 0, 0)
            q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    return img


def trim(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def add_outer_glow(img: Image.Image, color: tuple[int, int, int], blur: int = 3, expand: int = 2) -> Image.Image:
    """Silhueta brilhante ao redor do cursor."""
    alpha = img.split()[3]
    glow_alpha = alpha
    if expand > 1:
        glow_alpha = alpha.filter(ImageFilter.MaxFilter(expand * 2 + 1))
    glow_alpha = glow_alpha.filter(ImageFilter.GaussianBlur(blur))
    glow = Image.new('RGBA', img.size, (*color, 0))
    glow.putalpha(glow_alpha)

    # segunda camada mais suave (halo maior)
    halo = alpha.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(blur + 2))
    halo_img = Image.new('RGBA', img.size, (*color, 0))
    halo_img.putalpha(halo.point(lambda a: int(a * 0.45)))

    canvas = Image.new('RGBA', img.size, (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, halo_img)
    canvas = Image.alpha_composite(canvas, glow)
    canvas = Image.alpha_composite(canvas, img)
    return canvas


def resize_cursor(img: Image.Image, max_px: int = 32) -> Image.Image:
    iw, ih = img.size
    scale = max_px / max(iw, ih)
    nw = max(1, int(iw * scale))
    nh = max(1, int(ih * scale))
    return img.resize((nw, nh), Image.Resampling.LANCZOS)


def hotspot_for(name: str, w: int, h: int) -> tuple[int, int]:
    if name == 'text':
        return w // 2, h // 2
    if name == 'select':
        return max(0, w - 1), max(0, int(h * 0.21))
    return max(0, int(w * 0.08)), max(0, int(h * 0.08))


def process(name: str, fragment: str, glow_color: tuple[int, int, int] | None) -> tuple[int, int, tuple[int, int]]:
    src = find_source(fragment)
    img = Image.open(src)
    img = flood_remove_bg(img)
    img = trim(img)

    if glow_color:
        img = add_outer_glow(img, glow_color, blur=4 if name == 'pointer' else 5, expand=2)
    elif name == 'select':
        img = add_outer_glow(img, (255, 160, 60), blur=2, expand=1)

    if name == 'pointer':
        img = ImageEnhance.Brightness(img).enhance(1.06)
        img = ImageEnhance.Contrast(img).enhance(1.05)
    elif name == 'select':
        img = ImageEnhance.Brightness(img).enhance(1.03)

    out = resize_cursor(img, 32)
    hx, hy = hotspot_for(name, *out.size)
    out.save(OUT / f'cursor-{name}.png')
    return hx, hy, out.size


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    results = {}
    results['default'] = process('default', SOURCES['default'], None)
    # dourado/branco brilhante para link/botão
    results['pointer'] = process('pointer', SOURCES['pointer'], (255, 210, 120))
    # roxo para seleção de texto
    results['text'] = process('text', SOURCES['text'], (168, 85, 247))
    # luva dourada para opções de select
    results['select'] = process('select', SOURCES['select'], None)

    for k, (hx, hy, size) in results.items():
        print(f'cursor-{k}: {size} hotspot ({hx}, {hy})')


if __name__ == '__main__':
    main()
