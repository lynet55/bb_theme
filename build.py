#!/usr/bin/env python3
"""Quiet Report: turn a Markdown file plus CSV data into an interactive report page.

    python build.py                 build every post in posts/ and the index page
    python build.py posts/my-post   build one post
    python build.py new my-post     start a new post from the template

Output goes to dist/. Each post becomes one self-contained index.html.
Needs:  pip install markdown pyyaml
"""
import argparse
import csv, html, json, os, re, shutil, sys
from pathlib import Path

import markdown
import yaml

ROOT = Path(__file__).resolve().parent
THEME = ROOT / "theme"
DIST = ROOT / "dist"

# Keys the builder handles itself; everything else in a figure block goes to the chart.
FRAME_KEYS = {"id", "data", "where", "views", "title", "subtitle", "tag", "caption", "source", "src", "srcs", "clips"}


def site_config(site_file=None):
    cfg = {"name": "Physical Intuitions", "author": "", "footer": "",
           "mathjax": "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js"}
    # a site.yaml next to where you run the build wins over the library's own
    f = Path(site_file) if site_file else (Path.cwd() / "site.yaml" if (Path.cwd() / "site.yaml").exists() else ROOT / "site.yaml")
    if f.exists():
        cfg.update(yaml.safe_load(f.read_text(encoding="utf-8")) or {})
    if os.environ.get("QR_MATHJAX"):
        cfg["mathjax"] = os.environ["QR_MATHJAX"]
    return cfg


def num(v):
    try:
        f = float(v)
        return int(f) if f.is_integer() and "." not in v and "e" not in v.lower() else f
    except (TypeError, ValueError):
        return v


def load_rows(post_dir, name, where=None):
    path = post_dir / name
    if not path.exists():
        path = post_dir / "data" / name
    if not path.exists():
        sys.exit(f"  ! data file not found: {name} (looked in {post_dir} and {post_dir / 'data'})")
    if path.suffix == ".json":
        rows = json.loads(path.read_text(encoding="utf-8"))
    else:
        with open(path, newline="", encoding="utf-8-sig") as fh:
            rows = [{k.strip(): num(v.strip()) for k, v in r.items() if k} for r in csv.DictReader(fh)]
    for col, allowed in (where or {}).items():
        allowed = allowed if isinstance(allowed, list) else [allowed]
        keep = {str(a) for a in allowed}
        rows = [r for r in rows if str(r.get(col)) in keep]
    return rows


def deep_merge(base, over):
    """A view overrides single keys; nested dicts are merged, lists are replaced."""
    out = dict(base)
    for k, v in over.items():
        out[k] = deep_merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def load_nested(post_dir, node):
    """Any nested item with `data: file.csv` gets its rows loaded."""
    if isinstance(node, list):
        for n in node:
            load_nested(post_dir, n)
    elif isinstance(node, dict):
        for v in node.values():
            load_nested(post_dir, v)
        if isinstance(node.get("data"), str) and "rows" not in node:
            node["rows"] = load_rows(post_dir, node["data"], node.get("where"))


def protect_math(text, store):
    def keep(m, display):
        store.append(("\\[" + m.group(1) + "\\]") if display else ("\\(" + m.group(1) + "\\)"))
        return f"QRMATH{len(store) - 1}X"
    text = re.sub(r"\$\$(.+?)\$\$", lambda m: keep(m, True), text, flags=re.S)
    text = re.sub(r"(?<![\\$])\$([^$\n]+?)\$", lambda m: keep(m, False), text)
    return text.replace("\\$", "$")


def restore_math(text, store):
    return re.sub(r"QRMATH(\d+)X", lambda m: html.escape(store[int(m.group(1))]), text)


def md_inline(text, store):
    out = markdown.markdown(protect_math(str(text), store), extensions=["extra"])
    return re.sub(r"^<p>|</p>$", "", out.strip())


def build_post(post_dir, cfg):
    post_dir = Path(post_dir).resolve()
    src = (post_dir / "post.md").read_text(encoding="utf-8")
    meta = {}
    if src.startswith("---"):
        _, fm, src = src.split("---", 2)
        meta = yaml.safe_load(fm) or {}
    slug = post_dir.name
    out_dir = DIST / slug
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. pull out the figure blocks
    figs, counters = [], {"fig": 0, "tab": 0}

    def grab(m):
        try:
            spec = yaml.safe_load(m.group(1)) or {}
        except yaml.YAMLError as e:
            sys.exit(f"  ! could not read a figure block in {slug}/post.md:\n{e}")
        kind = "tab" if spec.get("type") == "table" else "fig"
        counters[kind] += 1
        spec["_kind"], spec["_n"] = kind, counters[kind]
        spec.setdefault("id", f"{kind}-{counters[kind]}")
        figs.append(spec)
        return f"\n\nQRFIGURE{len(figs) - 1}X\n\n"

    src = re.sub(r"^```figure[ \t]*\n(.*?)^```[ \t]*$", grab, src, flags=re.S | re.M)

    # 2. Markdown to HTML
    math = []
    body = markdown.markdown(protect_math(src, math), extensions=["extra", "toc", "sane_lists"])

    # 3. number the headings, collect contents
    toc, secs, n2, n3 = [], {}, 0, 0

    def heading(m):
        nonlocal n2, n3
        level, attrs, inner = int(m.group(1)), m.group(2), m.group(3)
        hid = re.search(r'id="([^"]+)"', attrs).group(1)
        plain = "nonum" in attrs or "collapsed" in attrs
        if level == 2:
            n3 = 0
            if plain:
                label = ""
            else:
                n2 += 1
                label = f"{n2}"
            toc.append({"id": hid, "title": inner, "label": label, "subs": []})
        else:
            if plain or not toc or not toc[-1]["label"]:
                label = ""
            else:
                n3 += 1
                label = f"{n2}.{n3}"
            if toc:
                toc[-1]["subs"].append({"id": hid, "label": label, "title": inner})
        secs[hid] = label or re.sub(r"<[^>]+>", "", inner)
        num_html = f'<span class="hnum">{label}</span> ' if label else ""
        return f"<h{level}{attrs}>{num_html}{inner}</h{level}>"

    body = re.sub(r"<h([23])([^>]*)>(.*?)</h\1>", heading, body, flags=re.S)

    # 4. subsection pills under each h2, collapsed sections
    parts = re.split(r"(?=<h2[ >])", body)
    for i, part in enumerate(parts):
        m = re.match(r'<h2([^>]*)>(.*?)</h2>', part, flags=re.S)
        if not m:
            continue
        hid = re.search(r'id="([^"]+)"', m.group(1)).group(1)
        entry = next(t for t in toc if t["id"] == hid)
        rest = part[m.end():]
        subs = [s for s in entry["subs"] if s["label"]]
        pills = ""
        if len(subs) > 2:
            pills = '<nav class="pills">' + "".join(f'<a href="#{s["id"]}">{s["label"]}</a>' for s in subs) + "</nav>"
        if "collapsed" in m.group(1):
            parts[i] = (f'<details class="appendix" id="{hid}"><summary><h2>{m.group(2)}</h2>'
                        f'<span class="show">+ show</span><span class="hide">&minus; hide</span></summary>{rest}</details>')
        else:
            parts[i] = m.group(0) + pills + rest
    body = "".join(parts)

    # 5. figures
    ids = {f["id"]: f for f in figs}
    specs = {}

    def refs(text):
        def one(m):
            kind, key = m.group(1), m.group(2)
            if kind == "sec":
                if key not in secs:
                    print(f"  ! unknown section reference @sec:{key}")
                    return m.group(0)
                lab = secs[key]
                return f'<a class="ref" href="#{key}">{"Section " + lab if re.match(r"^[0-9.]+$", lab) else lab}</a>'
            f = ids.get(key)
            if not f or f["_kind"] != kind:
                print(f"  ! unknown reference @{kind}:{key}")
                return m.group(0)
            return f'<a class="ref" href="#{kind}-{key}">{"Fig." if kind == "fig" else "Table"}&nbsp;{f["_n"]}</a>'
        return re.sub(r"@(fig|tab|sec):([\w-]+)", one, text)

    def media(name):
        srcp = post_dir / name
        if not srcp.exists():
            sys.exit(f"  ! media file not found: {name}")
        dst = out_dir / name
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(srcp, dst)
        return html.escape(name)

    def figure_html(spec):
        n, kind, typ = spec["_n"], spec["_kind"], spec.get("type", "line")
        fid = f'{kind}-{spec["id"]}'
        cap = md_inline(spec["caption"], math) if spec.get("caption") else ""
        if kind == "tab":
            rows = load_rows(post_dir, spec["data"], spec.get("where"))
            cols = spec.get("columns") or (list(rows[0].keys()) if rows else [])
            head = "".join(f"<th>{html.escape(str(c))}</th>" for c in cols)
            trs = "".join("<tr>" + "".join(
                f'<td class="{"n" if isinstance(r.get(c), (int, float)) else ""}">{md_inline(r.get(c, ""), math)}</td>'
                for c in cols) + "</tr>" for r in rows)
            return (f'<figure class="tab" id="{fid}"><figcaption><em>Table {n}:</em> {cap}</figcaption>'
                    f'<div class="tscroll"><table><thead><tr>{head}</tr></thead><tbody>{trs}</tbody></table></div></figure>')
        tag = f" &mdash; {html.escape(str(spec['tag']).upper())}" if spec.get("tag") else ""
        head = f'<p class="fmeta">FIG. {n:02d}{tag}</p>'
        if spec.get("title"):
            head += f'<p class="ftitle">{md_inline(spec["title"], math)}</p>'
        if spec.get("subtitle"):
            head += f'<p class="fsub">{md_inline(spec["subtitle"], math)}</p>'
        bare = False
        if typ in ("image", "video", "filmstrip", "svg"):
            if typ == "svg":
                srcs = spec.get("srcs") or [spec["src"]]
                chart = '<div class="media">' + "".join((post_dir / s).read_text(encoding="utf-8") for s in srcs) + "</div>"
            else:
                # clips: [{src, label, badge, poster}] ; `src` / `srcs` still work for plain files
                clips = spec.get("clips") or [{"src": s} for s in (spec.get("srcs") or [spec["src"]])]
                cells = []
                for c in clips:
                    if typ == "video":
                        poster = f' poster="{media(c["poster"])}"' if c.get("poster") else ""
                        ctl = " controls" if spec.get("controls") else ""
                        box = (f'<video data-src="{media(c["src"])}"{poster}{ctl} muted loop playsinline preload="none"></video>'
                               '<span class="clip-load">Loading&hellip;</span>')
                    else:
                        box = f'<img src="{media(c["src"])}" alt="{html.escape(str(c.get("alt", spec.get("alt", ""))))}" loading="lazy">'
                    badge = f'<span class="clip-badge">{html.escape(str(c["badge"]))}</span>' if c.get("badge") else ""
                    label = f'<p class="clip-label">{md_inline(c["label"], math)}</p>' if c.get("label") else ""
                    cells.append(f'<div class="clip"><div class="clip-box">{box}{badge}</div>{label}</div>')
                ncol = int(spec.get("columns") or min(len(clips), 5 if typ == "filmstrip" else 3))
                extra = ' data-animate="1"' if typ == "filmstrip" and spec.get("animate", True) else ""
                chart = (f'<div class="media {typ}"{extra} style="grid-template-columns:repeat({ncol},minmax(0,1fr))">'
                         + "".join(cells) + "</div>")
                bare = not spec.get("title")
        else:
            base = {k: v for k, v in spec.items() if k not in FRAME_KEYS and not k.startswith("_")}
            base["type"] = typ
            views = []
            for v in spec.get("views") or [{}]:
                one = deep_merge(base, {k: val for k, val in v.items() if k not in ("data", "where")})
                data, where = v.get("data", spec.get("data")), v.get("where", spec.get("where"))
                if data:
                    one["rows"] = load_rows(post_dir, data, where)
                load_nested(post_dir, one)
                views.append(one)
            specs[fid] = views
            chart = f'<div class="controls"></div><div class="chart" data-fig="{fid}"></div>'
        source = spec.get("source")
        foot = (f'<p class="fsrc"><span>{"Source: " + md_inline(source, math) if source else ""}</span>'
                f'<span>{html.escape(cfg["name"])}</span></p>')
        if spec.get("bare") and typ not in ("image", "video", "filmstrip", "svg"):
            return f'<figure class="fig" id="{fid}"><div class="plate">{chart}</div></figure>'
        if bare:
            return f'<figure class="fig bare" id="{fid}">{chart}<figcaption><em>Fig. {n}:</em> {cap}</figcaption></figure>'
        return (f'<figure class="fig" id="{fid}"><div class="plate">{head}{chart}{foot}</div>'
                f'<figcaption><em>Fig. {n}:</em> {cap}</figcaption></figure>')

    body = re.sub(r"<p>QRFIGURE(\d+)X</p>", lambda m: figure_html(figs[int(m.group(1))]), body)
    body = refs(body)

    # 6. page furniture
    findings = ""
    if meta.get("findings"):
        items = "".join(f"<li>{refs(md_inline(f, math))}</li>" for f in meta["findings"])
        findings = f'<section class="findings"><p class="fmeta">KEY FINDINGS</p><ul>{items}</ul></section>'
    toc_html = '<nav class="toc"><p class="fmeta">ON THIS PAGE</p><ol>' + "".join(
        f'<li><a href="#{t["id"]}">{re.sub(r"<[^>]+>", "", t["title"])}</a></li>' for t in toc) + "</ol></nav>"
    cover = ""
    if meta.get("cover"):
        cover = f'<img class="cover" src="{media(meta["cover"])}" alt="{html.escape(str(meta.get("cover_alt", "")))}">'
    intro = f'<p class="lede">{refs(md_inline(meta["summary"], math))}</p>' if meta.get("summary") else ""
    byline = " &middot; ".join(html.escape(str(x)) for x in (meta.get("date"), meta.get("author") or cfg.get("author")) if x)

    page = (THEME / "template.html").read_text(encoding="utf-8")
    fill = {
        "TITLE": html.escape(str(meta.get("title", slug))), "SITE": html.escape(cfg["name"]),
        "DESCRIPTION": html.escape(re.sub(r"\s+", " ", str(meta.get("summary", "")))[:300]),
        "BYLINE": byline, "COVER": cover, "INTRO": intro, "FINDINGS": findings, "TOC": toc_html,
        "BODY": body, "FOOTER": html.escape(str(cfg.get("footer", ""))), "HOME": "../index.html",
        "CSS": (THEME / "report.css").read_text(encoding="utf-8"),
        "JS": (THEME / "charts.js").read_text(encoding="utf-8"),
        "SPECS": json.dumps(specs, separators=(",", ":")).replace("</", "<\\/"),
        "MATHJAX": html.escape(cfg["mathjax"]),
    }
    page = re.sub(r"\{\{(\w+)\}\}", lambda m: fill.get(m.group(1), ""), page)
    page = restore_math(page, math)
    (out_dir / "index.html").write_text(page, encoding="utf-8")
    print(f"  built {out_dir / 'index.html'}  ({counters['fig']} figures, {counters['tab']} tables)")
    return {"slug": slug, "title": meta.get("title", slug), "date": str(meta.get("date", "")),
            "summary": meta.get("summary", ""), "sort": str(meta.get("sort", meta.get("date", "")))}


def build_index(posts, cfg):
    items = "".join(
        f'<li><a href="{p["slug"]}/index.html"><span class="fmeta">{html.escape(p["date"])}</span>'
        f'<span class="ptitle">{html.escape(str(p["title"]))}</span>'
        f'<span class="psum">{html.escape(str(p["summary"]))}</span></a></li>' for p in posts)
    page = (THEME / "template.html").read_text(encoding="utf-8")
    fill = {"TITLE": html.escape(cfg["name"]), "SITE": html.escape(cfg["name"]), "HOME": "index.html",
            "BODY": f'<ul class="posts">{items}</ul>', "FOOTER": html.escape(str(cfg.get("footer", ""))),
            "CSS": (THEME / "report.css").read_text(encoding="utf-8"), "JS": "", "SPECS": "{}",
            "MATHJAX": "", "DESCRIPTION": html.escape(cfg["name"])}
    page = re.sub(r"\{\{(\w+)\}\}", lambda m: fill.get(m.group(1), ""), page)
    (DIST / "index.html").write_text(page, encoding="utf-8")
    print(f"  built {DIST / 'index.html'}")


def main():
    global DIST
    ap = argparse.ArgumentParser(
        description="Build Markdown reports with interactive figures into self-contained HTML pages.",
        epilog="examples:\n"
               "  python build.py                            build every post in ./posts (or the library's posts)\n"
               "  python build.py posts/my-post              build one post\n"
               "  python build.py --posts figures/posts --out figures/html\n"
               "  python build.py new my-post --posts figures/posts",
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("items", nargs="*", help="post folders to build, or: new NAME")
    ap.add_argument("--posts", help="folder that holds the posts (default: ./posts if it exists, else the library's posts/)")
    ap.add_argument("--out", help="output folder (default: dist/ next to build.py)")
    ap.add_argument("--site", help="site.yaml to use (default: ./site.yaml if it exists, else the library's)")
    a = ap.parse_args()
    cfg = site_config(a.site)
    posts_dir = Path(a.posts) if a.posts else (Path.cwd() / "posts" if (Path.cwd() / "posts").is_dir() else ROOT / "posts")
    DIST = Path(a.out).resolve() if a.out else DIST
    if a.items and a.items[0] == "new":
        if len(a.items) < 2:
            sys.exit("usage: python build.py new my-post-name [--posts DIR]")
        dst = posts_dir / a.items[1]
        if dst.exists():
            sys.exit(f"{dst} already exists")
        shutil.copytree(ROOT / "templates" / "post", dst)
        print(f"Created {dst}. Edit post.md, add CSV files to data/, then run: python build.py {dst}")
        return
    DIST.mkdir(parents=True, exist_ok=True)
    if a.items:
        for item in a.items:
            build_post(item, cfg)
        return
    posts = [build_post(p, cfg) for p in sorted(posts_dir.iterdir())
             if (p / "post.md").exists() and not p.name.startswith("_")]
    build_index(sorted(posts, key=lambda p: p["sort"], reverse=True), cfg)


if __name__ == "__main__":
    main()
