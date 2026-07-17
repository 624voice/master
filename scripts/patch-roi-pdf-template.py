#!/usr/bin/env python3
"""Patch ROI PDF template: remove dummy Claude placeholder logo only."""

from __future__ import annotations

from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "public/templates/624-voice-roi-report-template.pdf"

# Dummy vector logo bounds (fitz top-left coordinates).
DUMMY_LOGO_RECT = fitz.Rect(58, 25, 120, 70)


def cover_dummy_logo(page: fitz.Page) -> None:
    shape = page.new_shape()
    shape.draw_rect(DUMMY_LOGO_RECT)
    shape.finish(color=(1, 1, 1), fill=(1, 1, 1))
    shape.commit(overlay=True)


def main() -> None:
    if not TEMPLATE.exists():
        raise SystemExit(f"Template not found: {TEMPLATE}")

    doc = fitz.open(TEMPLATE)
    cover_dummy_logo(doc[0])
    temp = ROOT / "public/templates/624-voice-roi-report-template.patched.pdf"
    doc.save(str(temp), garbage=4, deflate=True)
    doc.close()
    temp.replace(TEMPLATE)
    print(f"Patched template (logo only): {TEMPLATE}")


if __name__ == "__main__":
    main()
