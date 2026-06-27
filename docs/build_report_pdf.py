#!/usr/bin/env python3
"""Render docs/REPORT.md → docs/BeTree-Report.pdf (styled, print-ready).

Single source of truth is REPORT.md. Run with the backend venv:

    backend/.venv/bin/python docs/build_report_pdf.py
"""
from __future__ import annotations

import pathlib

import markdown
from weasyprint import HTML

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / "REPORT.md"
OUT = HERE / "BeTree-Report.pdf"

CSS = """
@page {
  size: A4;
  margin: 18mm 16mm 20mm 16mm;
  @bottom-center {
    content: "BeTree · HackXplore 2026 · be tree";
    font: 8pt 'Lato', sans-serif; color: #9aa39a;
  }
  @bottom-right { content: counter(page) " / " counter(pages);
    font: 8pt 'Lato', sans-serif; color: #9aa39a; }
}
@page :first { @bottom-center { content: ""; } @bottom-right { content: ""; } }

* { box-sizing: border-box; }
body {
  font-family: 'Lato', 'Helvetica Neue', sans-serif;
  font-size: 10.2pt; line-height: 1.5; color: #1d241c; max-width: 100%;
}
h1, h2, h3 { font-family: 'Lato', sans-serif; color: #14431f; line-height: 1.2; }
h1 { font-size: 23pt; margin: 0 0 2pt; letter-spacing: -.3pt; }
/* Cover-ish first block */
body > h1:first-child { color: #14431f; border-bottom: 3px solid #2e7d32; padding-bottom: 8pt; }
body > p:nth-of-type(1) strong { color: #2e7d32; }
h2 {
  font-size: 14.5pt; margin: 20pt 0 6pt; padding-top: 6pt;
  border-top: 1px solid #d8e2d6; page-break-after: avoid;
}
h3 { font-size: 11.5pt; margin: 13pt 0 3pt; color: #2e7d32; page-break-after: avoid; }
p { margin: 5pt 0; }
a { color: #2e7d32; text-decoration: none; }
strong { color: #14431f; }
em { color: #4a574a; }

hr { border: none; border-top: 1px solid #d8e2d6; margin: 14pt 0; }

table {
  border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9.2pt;
  page-break-inside: avoid;
}
th { background: #14431f; color: #fff; text-align: left; padding: 5pt 7pt; font-weight: 600; }
td { padding: 5pt 7pt; border-bottom: 1px solid #e3e9e1; vertical-align: top; }
tr:nth-child(even) td { background: #f5f8f4; }

blockquote {
  margin: 8pt 0; padding: 6pt 12pt; background: #f0f6ee;
  border-left: 3px solid #2e7d32; color: #36513a; font-size: 9.6pt;
}
code {
  font-family: 'DejaVu Sans Mono', monospace; font-size: 8.6pt;
  background: #eef3ec; padding: 1pt 3pt; border-radius: 3px; color: #1f3d24;
}
img {
  max-width: 64%; display: block; margin: 10pt auto 3pt;
  border-radius: 8px; border: 1px solid #d8e2d6;
}
img + em, p > em:only-child { display: block; text-align: center; color: #6a766a; font-size: 8.8pt; }
ul, ol { margin: 5pt 0; padding-left: 18pt; }
li { margin: 2pt 0; }
h2 { string-set: doctitle content(); }
"""

html_body = markdown.markdown(
    SRC.read_text(encoding="utf-8"),
    extensions=["tables", "fenced_code", "sane_lists", "attr_list"],
)
doc = f"<!doctype html><html><head><meta charset='utf-8'>" \
      f"<style>{CSS}</style></head><body>{html_body}</body></html>"

# base_url = docs/ so the ../3d/SprigInTree.jpeg image resolves.
HTML(string=doc, base_url=str(HERE)).write_pdf(str(OUT))
print(f"Wrote {OUT}  ({OUT.stat().st_size // 1024} KB)")
