#!/usr/bin/env python3
"""Render each hidden-slide H*.md into a clean slide PDF.

The slide shows ONLY the on-slide title + bullet points (no visual notes,
speaker notes, or why-citizen/why-city sections). Outputs one PDF per slide
plus a combined deck in ./out/. Run with the backend venv:

    backend/.venv/bin/python frontend/hidden-slides/build_slides_pdf.py
"""
from __future__ import annotations

import pathlib
import re

import markdown
from weasyprint import HTML

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

SLIDES = sorted(p for p in HERE.glob("H*.md"))

CSS = """
@page {
  size: 13.333in 7.5in;            /* 16:9 slide */
  margin: 22mm 24mm;
  @bottom-right { content: counter(page); font: 9pt 'Lato', sans-serif; color: #9aa39a; }
}
* { box-sizing: border-box; }
body { font-family: 'Lato', 'Helvetica Neue', sans-serif; color: #1d241c; }
.slide { page-break-after: always; }
.slide:last-child { page-break-after: auto; }
.hero {
  font-size: 27pt; line-height: 1.15; color: #14431f; font-weight: 800;
  margin: 0 0 22pt; padding-bottom: 12pt; border-bottom: 3px solid #2e7d32;
  letter-spacing: -.3pt;
}
ul { list-style: none; margin: 0; padding: 0; }
li {
  font-size: 16pt; line-height: 1.35; margin: 0 0 14pt; padding-left: 26pt; position: relative;
}
li::before {
  content: ""; position: absolute; left: 0; top: 9pt;
  width: 11pt; height: 11pt; background: #2e7d32; border-radius: 2pt;
}
strong { color: #14431f; font-weight: 800; }
em { color: #4a574a; }
"""


def parse(path: pathlib.Path) -> tuple[str, str]:
    text = path.read_text(encoding="utf-8")
    m = re.search(r"\*\*Title on slide:\*\*\s*(.+)", text)
    title = m.group(1).strip() if m else path.stem
    title = title.strip().lstrip("*").rstrip("*").strip().strip('"').strip("“”").strip()
    bm = re.search(r"##\s*Bullet points on slide\s*\n(.*?)(?=\n##\s|\Z)", text, re.S)
    bullets = bm.group(1).strip() if bm else ""
    return title, bullets


def slide_html(title: str, bullets_md: str) -> str:
    bullets = markdown.markdown(bullets_md, extensions=["sane_lists"])
    return f"<div class='slide'><div class='hero'>{title}</div>{bullets}</div>"


def wrap(body: str) -> str:
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<style>{CSS}</style></head><body>{body}</body></html>"
    )


parsed = [parse(p) for p in SLIDES]

for p, (title, bullets) in zip(SLIDES, parsed):
    html = wrap(slide_html(title, bullets))
    out = OUT / f"{p.stem}.pdf"
    HTML(string=html, base_url=str(HERE)).write_pdf(str(out))
    print(f"Wrote {out.relative_to(HERE)}  ({out.stat().st_size // 1024} KB)")

deck = OUT / "betree-hidden-slides.pdf"
combined = "".join(slide_html(t, b) for t, b in parsed)
HTML(string=wrap(combined), base_url=str(HERE)).write_pdf(str(deck))
print(f"Wrote {deck.relative_to(HERE)}  ({deck.stat().st_size // 1024} KB)")
