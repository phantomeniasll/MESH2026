#!/usr/bin/env python3
"""Render each hidden-slide H*.md into a styled landscape slide PDF.

Outputs one PDF per slide plus a combined deck in ./out/.
Run with the backend venv:

    backend/.venv/bin/python frontend/hidden-slides/build_slides_pdf.py
"""
from __future__ import annotations

import pathlib

import markdown
from weasyprint import HTML

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

SLIDES = sorted(p for p in HERE.glob("H*.md"))

CSS = """
@page {
  size: 13.333in 7.5in;            /* 16:9 slide */
  margin: 11mm 14mm 10mm 14mm;
  @bottom-left  { content: "BeTree · HackXplore 2026 · hidden slide"; font: 8pt 'Lato', sans-serif; color: #9aa39a; }
  @bottom-right { content: counter(page); font: 8pt 'Lato', sans-serif; color: #9aa39a; }
}
* { box-sizing: border-box; }
body { font-family: 'Lato', 'Helvetica Neue', sans-serif; font-size: 10pt; line-height: 1.3; color: #1d241c; }

/* eyebrow / kicker (the "# Hidden Slide N — ..." heading) */
h1 {
  font-size: 10pt; font-weight: 700; letter-spacing: .8pt; text-transform: uppercase;
  color: #2e7d32; margin: 0 0 3pt; border-bottom: 2px solid #2e7d32; padding-bottom: 4pt;
}
/* section labels: Bullet points / What to say / Why ... */
h2 {
  font-size: 9.5pt; color: #14431f; margin: 9pt 0 3pt; text-transform: uppercase;
  letter-spacing: .5pt; border-left: 4px solid #2e7d32; padding-left: 7pt;
}
p { margin: 3pt 0; }
/* the "**Title on slide:** *"..."*" line renders big and hero-like */
p:nth-of-type(2) { font-size: 16pt; line-height: 1.15; color: #14431f; font-weight: 700; margin: 6pt 0 8pt; }
p:nth-of-type(2) em { color: #14431f; font-style: normal; }
strong { color: #14431f; }
em { color: #4a574a; }
ul { margin: 3pt 0; padding-left: 16pt; }
li { margin: 1.5pt 0; }
a { color: #2e7d32; text-decoration: none; }
.slide { page-break-after: always; }
.slide:last-child { page-break-after: auto; }
"""


def md_to_html(path: pathlib.Path) -> str:
    return markdown.markdown(
        path.read_text(encoding="utf-8"),
        extensions=["tables", "fenced_code", "sane_lists", "attr_list"],
    )


def wrap(body: str) -> str:
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<style>{CSS}</style></head><body>{body}</body></html>"
    )


# Per-slide PDFs
for p in SLIDES:
    html = wrap(f"<div class='slide'>{md_to_html(p)}</div>")
    out = OUT / f"{p.stem}.pdf"
    HTML(string=html, base_url=str(HERE)).write_pdf(str(out))
    print(f"Wrote {out.relative_to(HERE)}  ({out.stat().st_size // 1024} KB)")

# Combined deck
combined = "".join(f"<div class='slide'>{md_to_html(p)}</div>" for p in SLIDES)
deck = OUT / "betree-hidden-slides.pdf"
HTML(string=wrap(combined), base_url=str(HERE)).write_pdf(str(deck))
print(f"Wrote {deck.relative_to(HERE)}  ({deck.stat().st_size // 1024} KB)")
