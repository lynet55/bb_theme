"""Illustrative images for the canonical VAE figure (not real model output).

  input.png  X        a 28x28 handwritten-style digit (rendered from a font, then softened)
  recon.png  X_hat    a blurred stand-in for what a decoder returns
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage
from pathlib import Path

out = Path(__file__).parent / "img"
S = 28
big = Image.new("L", (280, 280), 0)
font = ImageFont.truetype("DejaVuSans-Bold.ttf", 230)
ImageDraw.Draw(big).text((140, 150), "3", fill=255, font=font, anchor="mm")
x = np.asarray(big.rotate(-8, resample=Image.BICUBIC).resize((S, S), Image.LANCZOS), float) / 255
x = np.clip(ndimage.gaussian_filter(x, 0.5) * 1.15, 0, 1)
xh = np.clip(ndimage.gaussian_filter(x, 1.3) * 1.1, 0, 1)

ink = np.array([15, 27, 45], float); paper = np.array([255, 255, 255], float)
def save(name, a):
    rgb = paper * (1 - a[..., None]) + ink * a[..., None]
    Image.fromarray(rgb.astype(np.uint8)).resize((S * 16, S * 16), Image.NEAREST).save(out / name)
save("input.png", x)
save("recon.png", xh)
