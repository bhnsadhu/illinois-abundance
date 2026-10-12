#!/usr/bin/env python3
"""Prepare the supplied logo without using any of its figures.

Run: python3 scripts/prepare-brand.py [path/to/source.png]
Requires Pillow. The checked-in source is the default after the first run.
The source is archival input only; use logo-wordmark.png in rendered pages.
"""

from pathlib import Path
import math
import shutil
import sys
from statistics import median

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "brand"
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = OUT / "logo-source.png"
if len(sys.argv) > 1:
    incoming = Path(sys.argv[1]).expanduser().resolve()
    if incoming != SOURCE:
        shutil.copyfile(incoming, SOURCE)

source = Image.open(SOURCE).convert("RGB")
w, h = source.size
background = source.getpixel((0, 0))

# Detect orange wordmark pixels only in the lower half, below the figures.
mask = Image.new("L", source.size)
mask_pixels = mask.load()
foreground_samples = []
for y in range(h // 2, h):
    for x in range(w):
        r, g, b = source.getpixel((x, y))
        if r > 190 and 35 < g < 150 and b < 105 and r - g > 75:
            mask_pixels[x, y] = 255
            foreground_samples.append((r, g, b))
bounds = mask.getbbox()
if not bounds or not foreground_samples:
    raise ValueError("No orange wordmark was detected in the lower half.")

# Color-distance alpha estimates coverage at each antialiased edge, then
# reverses the cream compositing: C = alpha * foreground + (1-alpha) * bg.
foreground = tuple(median(c[i] for c in foreground_samples) for i in range(3))
full_distance = math.dist(foreground, background)
crop = source.crop(bounds)
wordmark = Image.new("RGBA", crop.size)
for y in range(crop.height):
    for x in range(crop.width):
        color = crop.getpixel((x, y))
        alpha = min(1.0, math.dist(color, background) / full_distance)
        if alpha < 0.015:
            wordmark.putpixel((x, y), (0, 0, 0, 0))
            continue
        unblended = tuple(
            round(max(0, min(255, (color[i] - background[i] * (1 - alpha)) / alpha)))
            for i in range(3)
        )
        wordmark.putpixel((x, y), (*unblended, round(alpha * 255)))

wordmark.save(OUT / "logo-wordmark.png", optimize=True)

# The naturally separated two lines can also sit on one line in small navs.
occupied_rows = [
    y for y in range(wordmark.height)
    if wordmark.getchannel("A").crop((0, y, wordmark.width, y + 1)).getbbox()
]
gaps = [(a, b) for a, b in zip(occupied_rows, occupied_rows[1:]) if b - a > 10]
if not gaps:
    raise ValueError("Expected a two-line wordmark.")
line_break = max(gaps, key=lambda pair: pair[1] - pair[0])
top = wordmark.crop((0, 0, wordmark.width, line_break[0] + 1))
bottom = wordmark.crop((0, line_break[1], wordmark.width, wordmark.height))
top = top.crop(top.getbbox())
bottom = bottom.crop(bottom.getbbox())
gap = round(max(top.height, bottom.height) * 0.6)
horizontal = Image.new("RGBA", (top.width + bottom.width + gap, max(top.height, bottom.height)))
horizontal.alpha_composite(top, (0, horizontal.height - top.height))
horizontal.alpha_composite(bottom, (top.width + gap, horizontal.height - bottom.height))
horizontal.save(OUT / "logo-wordmark-horizontal.png", optimize=True)

# At favicon sizes use the original hand-drawn A, extracted from Abundance.
occupied_columns = [
    x for x in range(bottom.width)
    if bottom.getchannel("A").crop((x, 0, x + 1, bottom.height)).getbbox()
]
first_gap = next((a, b) for a, b in zip(occupied_columns, occupied_columns[1:]) if b - a > 5)
initial = bottom.crop((occupied_columns[0], 0, first_gap[0] + 1, bottom.height))
initial = initial.crop(initial.getbbox())
favicon = Image.new("RGBA", (512, 512), (*background, 255))
initial.thumbnail((350, 350), Image.Resampling.LANCZOS)
initial = initial.resize(
    (round(initial.width * 350 / initial.height), 350), Image.Resampling.LANCZOS
)
favicon.alpha_composite(initial, ((512 - initial.width) // 2, (512 - initial.height) // 2))
favicon.save(OUT / "favicon-512.png", optimize=True)
for size, name in [(32, "favicon.png"), (180, "apple-touch-icon.png"), (192, "favicon-192.png")]:
    favicon.resize((size, size), Image.Resampling.LANCZOS).save(OUT / name, optimize=True)
favicon.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print(f"Source {source.size}; wordmark bounds {bounds}; wordmark {wordmark.size}; horizontal {horizontal.size}")
print(f"Background {background}; inferred foreground {foreground}; output {OUT}")
