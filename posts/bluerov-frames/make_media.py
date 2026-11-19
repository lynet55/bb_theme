"""Prepare the BlueROV2 Heavy render for the axes figure.

Crops the render to the vehicle, makes the white background transparent (flood fill from the edges,
so light surfaces on the vehicle stay opaque), and scales it down. Prints the crop box: the figure
uses the original render's pixel coordinates, and needs to know where the crop sits.
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

here = Path(__file__).parent
src = Image.open(here / "media" / "bluerov2_heavy_render.png").convert("RGB")
a = np.asarray(src).astype(int)
box = (240, 240, 3010, 2180)                       # x0, y0, x1, y1 in the original render
a = a[box[1]:box[3], box[0]:box[2]]
white = a.min(axis=2) >= 250
lab, _ = ndimage.label(white)
edge = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
bg = np.isin(lab, list(edge))
alpha = ndimage.gaussian_filter((~bg).astype(float), 0.8)   # soft edge
rgba = np.dstack([a, np.clip(alpha * 255, 0, 255)]).astype(np.uint8)
im = Image.fromarray(rgba, "RGBA")
scale = 0.5
im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
im.save(here / "media" / "bluerov2_heavy.png", optimize=True)
print("crop box", box, "->", im.size, f"{(here / 'media' / 'bluerov2_heavy.png').stat().st_size / 1e3:.0f} kB")
