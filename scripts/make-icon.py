#!/usr/bin/env python3
"""Draws the Cerul Lumii app icon (globe + plane taking off on a dusk sky) with Pillow.
Writes electron/build/icon.png (1024), icon.ico (16..256) and electron/app/icon.png (256, window icon).
Run: python3 scripts/make-icon.py"""
import math, os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 1024 * 2  # supersample

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
# sky gradient (navy -> blue -> warm horizon)
sky = Image.new("RGBA", (S, S))
px = sky.load()
stops = [(0.0, (6, 18, 38)), (0.55, (18, 52, 104)), (0.82, (64, 104, 160)), (1.0, (255, 160, 100))]
for y in range(S):
    t = y / (S - 1)
    for i in range(len(stops) - 1):
        if stops[i][0] <= t <= stops[i + 1][0]:
            c = lerp(stops[i][1], stops[i + 1][1], (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0])); break
    for x in range(S): px[x, y] = c + (255,)
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
img.paste(sky, (0, 0), mask)
d = ImageDraw.Draw(img)

# globe
cx, cy, r = S * 0.50, S * 0.56, S * 0.31
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
gd.ellipse([cx - r * 1.12, cy - r * 1.12, cx + r * 1.12, cy + r * 1.12], fill=(34, 224, 208, 70))
glow = glow.filter(ImageFilter.GaussianBlur(S * 0.03)); img.alpha_composite(glow)
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(12, 58, 92, 255), outline=(34, 224, 208, 255), width=int(S * 0.018))
lw = int(S * 0.010); col = (120, 236, 226, 200)
for k in (-0.55, 0, 0.55):  # parallels
    yy = cy + k * r; hw = math.sqrt(max(0, r * r - (k * r) ** 2))
    d.line([cx - hw, yy, cx + hw, yy], fill=col, width=lw)
for k in (0.35, 0.75):      # meridians (ellipses)
    d.ellipse([cx - r * k, cy - r, cx + r * k, cy + r], outline=col, width=lw)
d.line([cx, cy - r, cx, cy + r], fill=col, width=lw)
# continents hint (two soft blobs)
for (ox, oy, rw, rh) in ((-0.35, -0.2, 0.28, 0.2), (0.25, 0.25, 0.22, 0.16)):
    d.ellipse([cx + ox * r - rw * r, cy + oy * r - rh * r, cx + ox * r + rw * r, cy + oy * r + rh * r], fill=(46, 140, 120, 230))

# contrail arc
trail = Image.new("RGBA", (S, S), (0, 0, 0, 0)); td = ImageDraw.Draw(trail)
# straight, tapering contrail behind the tail (plane heads up-right at 38 degrees)
ux, uy = math.cos(math.radians(38)), -math.sin(math.radians(38)); nx, ny = -uy, ux
tx, ty = S * 0.455, S * 0.465; bx, by = tx - ux * S * 0.42, ty - uy * S * 0.42
w0, w1 = S * 0.018, S * 0.002
td.polygon([(tx + nx * w0, ty + ny * w0), (bx + nx * w1, by + ny * w1), (bx - nx * w1, by - ny * w1), (tx - nx * w0, ty - ny * w0)], fill=(255, 255, 255, 190))
trail = trail.filter(ImageFilter.GaussianBlur(S * 0.004)); img.alpha_composite(trail)

# plane (top view, pointing up-right), built pointing right then rotated
P = Image.new("RGBA", (S, S), (0, 0, 0, 0)); pd = ImageDraw.Draw(P)
L = S * 0.46; ox, oy = S / 2, S / 2
body = [(ox - L * .5, oy - L * .05), (ox + L * .38, oy - L * .06), (ox + L * .5, oy), (ox + L * .38, oy + L * .06), (ox - L * .5, oy + L * .05)]
wing = [(ox - L * .02, oy - L * .05), (ox - L * .2, oy - L * .52), (ox - L * .08, oy - L * .52), (ox + L * .16, oy - L * .05),
        (ox + L * .16, oy + L * .05), (ox - L * .08, oy + L * .52), (ox - L * .2, oy + L * .52), (ox - L * .02, oy + L * .05)]
tail = [(ox - L * .38, oy - L * .04), (ox - L * .5, oy - L * .2), (ox - L * .42, oy - L * .2), (ox - L * .28, oy - L * .04),
        (ox - L * .28, oy + L * .04), (ox - L * .42, oy + L * .2), (ox - L * .5, oy + L * .2), (ox - L * .38, oy + L * .04)]
shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0)); sd = ImageDraw.Draw(shadow)
for poly in (wing, tail, body): sd.polygon([(x + S * .015, y + S * .02) for x, y in poly], fill=(0, 0, 0, 110))
shadow = shadow.filter(ImageFilter.GaussianBlur(S * 0.01))
P.alpha_composite(shadow)
pd.polygon(wing, fill=(226, 236, 248, 255)); pd.polygon(tail, fill=(255, 106, 42, 255)); pd.polygon(body, fill=(255, 255, 255, 255))
pd.line([(ox - L * .45, oy), (ox + L * .45, oy)], fill=(34, 224, 208, 255), width=int(S * 0.01))
P = P.rotate(38, resample=Image.BICUBIC, center=(ox, oy))
img.alpha_composite(P, (int(S * 0.13), int(-S * 0.17)))

img = Image.composite(img, Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask)
big = img.resize((1024, 1024), Image.LANCZOS)
os.makedirs(os.path.join(ROOT, "electron", "build"), exist_ok=True)
big.save(os.path.join(ROOT, "electron", "build", "icon.png"))
big.resize((256, 256), Image.LANCZOS).save(os.path.join(ROOT, "electron", "app", "icon.png"))
big.save(os.path.join(ROOT, "electron", "build", "icon.ico"), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("icon written")
