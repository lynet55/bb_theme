#!/usr/bin/env python3
"""Export figures from a built page as PNG or PDF, for LaTeX documents and slides.

    python export.py dist/slam-basics/index.html                       # every figure, PNG
    python export.py dist/slam-basics/index.html --fig tri gnlm --format pdf png
    python export.py dist/auv-online-stack/index.html --diagram-only --transparent
    python export.py dist/slam-basics/index.html --fig epipolar --view "Forward motion"

What is exported:
  default          the whole figure card: tag, title, controls, drawing, readouts, source line
  --diagram-only   only the drawing (and its legend), the usual choice for a paper or thesis
  --transparent    no background: drop the panel colour and grain (PNG keeps an alpha channel)

PDF output keeps lines and equations as vectors; include it with \\includegraphics.
Needs: pip install playwright && playwright install chromium   (or pass --chrome /path/to/chrome)
Equations and fonts load from the web; set QR_MATHJAX when building to use a local MathJax.
"""
import argparse
import asyncio
import sys
from pathlib import Path

HIDE_OTHERS = """
html, body { background: %(bg)s !important; }
body::before, body::after { display: none !important; }
body * { visibility: hidden !important; }
#qr-target, #qr-target * { visibility: visible !important; }
body > svg, body > svg * { visibility: visible !important; }   /* shared hatch patterns and filters */
#qr-target { position: absolute !important; left: 0 !important; top: 0 !important; margin: 0 !important;
             width: %(w)spx !important; box-sizing: border-box !important; }
"""
TRANSPARENT = """
#qr-target, #qr-target .plate { background: none !important; box-shadow: none !important; border: 0 !important; }
"""
DIAGRAM_PAD = """
#qr-target { padding: %(pad)spx !important; }
#qr-target .sim-sliders, #qr-target .slider, #qr-target .fig-reads, #qr-target .seg, #qr-target .sim-btn,
#qr-target input, #qr-target .controls { display: none !important; }
"""


async def run(a):
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        sys.exit("export needs Playwright: pip install playwright && playwright install chromium")
    page_path = Path(a.page).resolve()
    if not page_path.exists():
        sys.exit(f"no such page: {page_path} (build it first with build.py)")
    out = Path(a.out or page_path.parent / "export")
    out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        launch = {"args": ["--allow-file-access-from-files"]}
        if a.chrome:
            launch["executable_path"] = a.chrome
        browser = await p.chromium.launch(**launch)
        page = await browser.new_page(viewport={"width": a.width, "height": 1200}, device_scale_factor=a.scale)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(page_path.as_uri())
        try:
            await page.wait_for_function("window.MathJax && MathJax.startup && MathJax.startup.promise", timeout=8000)
            await page.evaluate("MathJax.startup.promise")
        except Exception:
            print("  ! MathJax did not load (offline?); equations fall back to plain text")
        await page.wait_for_timeout(800)
        ids = await page.eval_on_selector_all("figure.fig", "els => els.map(e => e.id)")
        wanted = [f if f.startswith(("fig-", "tab-")) else "fig-" + f for f in a.fig] if a.fig else ids
        missing = [f for f in wanted if f not in ids]
        if missing:
            sys.exit(f"no such figure: {', '.join(missing)}. Figures on this page: {', '.join(ids)}")
        for fid in wanted:
            await page.reload()
            await page.wait_for_timeout(600)
            try:
                await page.evaluate("MathJax.startup.promise")
            except Exception:
                pass
            fig = page.locator(f"#{fid}")
            if a.view:
                btn = fig.locator(".seg button", has_text=a.view)
                if await btn.count():
                    await btn.first.click()
                    await page.wait_for_timeout(500)
            sel = f"#{fid} .chart" if a.diagram_only else f"#{fid} .plate"
            target = page.locator(sel).first
            box = await target.bounding_box()
            await target.evaluate("e => e.id = 'qr-target'")
            css = HIDE_OTHERS % {"bg": "transparent" if a.transparent else "#ffffff", "w": round(box["width"])}
            if a.transparent:
                css += TRANSPARENT
            if a.diagram_only:
                css += DIAGRAM_PAD % {"pad": a.pad}
            await page.add_style_tag(content=css)
            await page.wait_for_timeout(400)
            target = page.locator("#qr-target")
            box = await target.bounding_box()
            name = fid.replace("fig-", "").replace("tab-", "table-") + (("-" + a.view.lower().replace(" ", "-")) if a.view else "")
            if "png" in a.format:
                path = out / f"{name}.png"
                await target.screenshot(path=str(path), omit_background=a.transparent)
                print(f"  wrote {path}")
            if "pdf" in a.format:
                path = out / f"{name}.pdf"
                await page.emulate_media(media="screen")
                await page.pdf(path=str(path), width=f"{box['width'] + 1:.0f}px", height=f"{box['height'] + 1:.0f}px",
                               print_background=not a.transparent, page_ranges="1",
                               margin={"top": "0", "right": "0", "bottom": "0", "left": "0"})
                print(f"  wrote {path}")
        if errors:
            print("  ! page errors:", *errors, sep="\n    ")
        await browser.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("page", help="a built page, e.g. dist/slam-basics/index.html")
    ap.add_argument("--fig", nargs="*", help="figure ids to export (default: all)")
    ap.add_argument("--format", nargs="+", default=["png"], choices=["png", "pdf"])
    ap.add_argument("--out", help="output folder (default: export/ next to the page)")
    ap.add_argument("--view", help="click this view button before exporting")
    ap.add_argument("--diagram-only", action="store_true", help="only the drawing, without title, controls and source")
    ap.add_argument("--transparent", action="store_true", help="no background")
    ap.add_argument("--scale", type=float, default=3, help="pixel density for PNG (default 3)")
    ap.add_argument("--width", type=int, default=1100, help="browser width in px (default 1100)")
    ap.add_argument("--pad", type=int, default=6, help="padding around --diagram-only exports, px")
    ap.add_argument("--chrome", help="path to a Chrome or Chromium binary")
    asyncio.run(run(ap.parse_args()))


if __name__ == "__main__":
    main()
