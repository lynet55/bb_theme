r"""Synthetic example images for the VAE figure.

Illustrative only: a made-up underwater scene, not data from the thesis runs.
  depth.png        D_t        planar depth, 96x128, no return (walls hidden) = 0
  target.png       D^col_t    collision image: obstacles inflated by the vehicle size,
                              invalid pixels (Omega_t = 0) hatched
  recon.png        \hat D^col_t  a blurred stand-in for a decoder output
  colorbar.png     depth colour scale, 0 to 12 m
"""
import numpy as np
from PIL import Image
from scipy import ndimage
from pathlib import Path

H, W, RMAX, RVEH = 96, 128, 12.0, 0.35
out = Path(__file__).parent / "img"
fx = fy = W / (2 * np.tan(np.radians(45)))          # 90 deg horizontal FOV
cx, cy = W / 2, H / 2
v, u = np.mgrid[0:H, 0:W].astype(float)
dx, dy = (u - cx) / fx, (v - cy) / fy

D = np.full((H, W), np.inf)
def take(z, mask):
    global D
    z = np.where(mask, z, np.inf); D = np.minimum(D, z)

# seabed 1.6 m below the camera
with np.errstate(divide="ignore", invalid="ignore"):
    zf = 1.6 / dy
take(zf, (dy > 0) & (zf > 0))
# vertical pillars (x, z, radius), camera looks along +z
for X, Z, R in [(-1.3, 3.0, 0.35), (1.6, 5.5, 0.45), (0.2, 8.0, 0.3)]:
    a = dx**2 + 0.0; b = -2 * Z - 2 * X * dx; c = X**2 + Z**2 - R**2
    disc = b**2 - 4 * (1 + dx**2) * c
    z = (-b - np.sqrt(np.maximum(disc, 0))) / (2 * (1 + dx**2))
    take(z, disc > 0)
# a box (rock) on the seabed
z = np.full((H, W), 4.2); xs = dx * z; ys = dy * z
take(z, (xs > -0.9) & (xs < 0.1) & (ys > 0.9) & (ys < 1.6))

valid = np.isfinite(D) & (D < RMAX)
Dt = np.where(valid, D, 0.0)

# collision image: each obstacle pixel grows by the vehicle's size seen at its depth,
# and depth is reduced by the vehicle radius
Dc = np.where(valid, D, np.inf)
col = Dc.copy()
for z0 in np.linspace(1.0, RMAX, 23):
    rpx = max(1, int(round(RVEH * fx / z0)))
    layer = np.where(np.abs(Dc - z0) < 0.5, Dc, np.inf)
    st = np.hypot(*np.mgrid[-rpx:rpx + 1, -rpx:rpx + 1]) <= rpx
    col = np.minimum(col, ndimage.grey_erosion(layer, footprint=st, mode="nearest"))
Omega = np.isfinite(col) & (col < RMAX)
Dcol = np.where(Omega, np.clip(col - RVEH, 0, None), 0.0)

# reconstruction stand-in: smooth, loses thin edges
filled = np.where(Omega, Dcol, RMAX)
rec = ndimage.gaussian_filter(filled, 2.2)
rec += 0.25 * ndimage.gaussian_filter(np.random.default_rng(3).standard_normal((H, W)), 3)
rec = np.clip(rec, 0, RMAX)

# colour map: near = ink navy, far = pale blue
stops = np.array([[15, 27, 45], [29, 95, 209], [127, 166, 214], [222, 232, 246]], float)
def cmap(x):
    x = np.clip(x / RMAX, 0, 1) * (len(stops) - 1)
    i = np.minimum(x.astype(int), len(stops) - 2); f = (x - i)[..., None]
    return stops[i] * (1 - f) + stops[i + 1] * f

def save(name, rgb, scale=4):
    im = Image.fromarray(rgb.astype(np.uint8)).resize((W * scale, H * scale), Image.NEAREST)
    im.save(out / name)

hatch_bg = np.full((H * 4, W * 4, 3), 255.0)
yy, xx = np.mgrid[0:H * 4, 0:W * 4]
hatch_bg[((xx + yy) % 10) < 1.4] = [47, 63, 208]
def with_invalid(rgb, ok):
    big = np.repeat(np.repeat(rgb, 4, 0), 4, 1); okb = np.repeat(np.repeat(ok, 4, 0), 4, 1)
    return np.where(okb[..., None], big, hatch_bg)

Image.fromarray(with_invalid(cmap(Dt), valid).astype(np.uint8)).save(out / "depth.png")
Image.fromarray(with_invalid(cmap(Dcol), Omega).astype(np.uint8)).save(out / "target.png")
save("recon.png", cmap(rec))
bar = cmap(np.linspace(0, RMAX, 256))[None].repeat(8, 0)
Image.fromarray(bar.astype(np.uint8)).resize((512, 16), Image.BILINEAR).save(out / "colorbar.png")
print("valid", valid.mean().round(3), "Omega", Omega.mean().round(3))
