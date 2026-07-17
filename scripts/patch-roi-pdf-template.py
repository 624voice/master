#!/usr/bin/env python3
"""Patch ROI PDF template: remove dummy logo and replace Helvetica with Inter."""

from __future__ import annotations

from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "public/templates/624-voice-roi-report-template.pdf"
INTER_REG = ROOT / "public/fonts/Inter-Regular.ttf"
INTER_BOLD = ROOT / "public/fonts/Inter-Bold.ttf"

# Dummy vector logo bounds (fitz top-left coordinates).
DUMMY_LOGO_RECT = fitz.Rect(58, 25, 120, 70)


def int_to_rgb(color: int) -> tuple[float, float, float]:
    r = ((color >> 16) & 255) / 255
    g = ((color >> 8) & 255) / 255
    b = (color & 255) / 255
    return (r, g, b)


def overlaps_any(rect: fitz.Rect, others: list[fitz.Rect]) -> bool:
    return any(rect.intersects(other) for other in others)


def patch_page(page: fitz.Page) -> None:
    widget_rects = [fitz.Rect(w.rect) for w in page.widgets()]
    text_ops: list[dict] = []

    for block in page.get_text("dict")["blocks"]:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                text = span["text"]
                if not text.strip():
                    continue
                bbox = fitz.Rect(span["bbox"])
                if overlaps_any(bbox, widget_rects):
                    continue
                text_ops.append(
                    {
                        "text": text,
                        "bbox": bbox,
                        "size": span["size"],
                        "font": span["font"],
                        "color": int_to_rgb(span["color"]),
                    }
                )
                page.add_redact_annot(bbox, fill=(1, 1, 1))

    page.apply_redactions()

    for op in text_ops:
        fontfile = str(
            INTER_BOLD if "Bold" in op["font"] else INTER_REG
        )
        x0, _, _, y1 = op["bbox"]
        page.insert_text(
            (x0, y1),
            op["text"],
            fontfile=fontfile,
            fontsize=op["size"],
            color=op["color"],
        )


def cover_dummy_logo(page: fitz.Page) -> None:
    shape = page.new_shape()
    shape.draw_rect(DUMMY_LOGO_RECT)
    shape.finish(color=(1, 1, 1), fill=(1, 1, 1))
    shape.commit(overlay=True)


def main() -> None:
    if not TEMPLATE.exists():
        raise SystemExit(f"Template not found: {TEMPLATE}")
    if not INTER_REG.exists() or not INTER_BOLD.exists():
        raise SystemExit("Inter font files missing in public/fonts/")

    doc = fitz.open(TEMPLATE)
    cover_dummy_logo(doc[0])
    for page in doc:
        patch_page(page)
    temp = ROOT / "public/templates/624-voice-roi-report-template.patched.pdf"
    doc.save(str(temp), garbage=4, deflate=True)
    doc.close()
    temp.replace(TEMPLATE)
    print(f"Patched template: {TEMPLATE}")


if __name__ == "__main__":
    main()
