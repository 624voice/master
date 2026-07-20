#!/usr/bin/env python3
"""Prepare the static 5-page Revenue Gap Report PDF with AcroForm text fields."""

from __future__ import annotations

from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/templates/624-voice-revenue-gap-report-source.pdf"
OUTPUT = ROOT / "public/templates/624-voice-revenue-gap-report.pdf"


def sample_fill_color(page: fitz.Page, rect: fitz.Rect) -> tuple[float, float, float]:
    clip = fitz.Rect(rect.x0, rect.y0, rect.x1, rect.y1)
    if clip.width < 2 or clip.height < 2:
        clip = fitz.Rect(rect.x0, rect.y0, rect.x0 + 8, rect.y0 + 8)
    pix = page.get_pixmap(clip=clip)
    samples = pix.samples
    n = pix.n
    count = len(samples) // n
    if count == 0:
        return (1.0, 1.0, 1.0)
    r = g = b = 0.0
    for i in range(0, len(samples), n):
        r += samples[i]
        g += samples[i + 1]
        b += samples[i + 2]
    return (r / count / 255, g / count / 255, b / count / 255)


def cover_placeholder_logo(page: fitz.Page) -> None:
    """Remove the vector placeholder logo so the real PNG can be drawn at fill time."""
    logo_rect = fitz.Rect(54.0, 48.0, 84.0, 78.0)
    page.add_redact_annot(logo_rect, fill=(1.0, 1.0, 1.0))
    page.apply_redactions()


def fix_guarantee_card_overlap(page: fitz.Page) -> None:
    """Clip the guarantee card bottom border so it does not overlap the footer."""
    overlap = fitz.Rect(54.0, 742.0, 558.0, 760.0)
    page.add_redact_annot(overlap, fill=(1.0, 1.0, 1.0))
    page.apply_redactions()


def add_field(
    page: fitz.Page,
    name: str,
    rect: fitz.Rect,
    *,
    text_color: tuple[float, float, float] | None = None,
    fill_color: tuple[float, float, float] | None = None,
) -> None:
    bg = fill_color if fill_color is not None else sample_fill_color(page, rect)
    page.add_redact_annot(rect, fill=bg)
    page.apply_redactions()

    widget = fitz.Widget()
    widget.field_type = fitz.PDF_WIDGET_TYPE_TEXT
    widget.field_name = name
    widget.rect = rect
    widget.field_value = ""
    widget.text_color = text_color or (0.0, 0.0, 0.0)
    widget.fill_color = None
    widget.border_color = None
    widget.border_width = 0
    widget.text_fontsize = 0
    page.add_widget(widget)


def prepare() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Source PDF not found: {SOURCE}")

    doc = fitz.open(SOURCE)

    cover_placeholder_logo(doc[0])
    fix_guarantee_card_overlap(doc[3])

    # Page 1
    p1 = doc[0]
    add_field(p1, "reportDate", fitz.Rect(455, 62, 562, 77), text_color=(0.45, 0.5, 0.48))
    add_field(
        p1,
        "firstName",
        fitz.Rect(86, 342, 200, 360),
        text_color=(0.66, 0.71, 0.69),
        fill_color=(0.926, 0.937, 0.933),
    )
    add_field(
        p1,
        "lastName",
        fitz.Rect(253, 342, 370, 360),
        text_color=(0.66, 0.71, 0.69),
        fill_color=(0.926, 0.937, 0.933),
    )
    add_field(
        p1,
        "businessName",
        fitz.Rect(420, 342, 545, 360),
        text_color=(0.66, 0.71, 0.69),
        fill_color=(0.926, 0.937, 0.933),
    )
    add_field(
        p1,
        "email",
        fitz.Rect(86, 401, 230, 419),
        text_color=(0.66, 0.71, 0.69),
        fill_color=(0.926, 0.937, 0.933),
    )
    add_field(
        p1,
        "phone",
        fitz.Rect(253, 401, 370, 419),
        text_color=(0.66, 0.71, 0.69),
        fill_color=(0.926, 0.937, 0.933),
    )
    add_field(
        p1,
        "reportId",
        fitz.Rect(420, 401, 545, 419),
        text_color=(0.66, 0.71, 0.69),
        fill_color=(0.926, 0.937, 0.933),
    )
    add_field(
        p1,
        "trade",
        fitz.Rect(68, 456, 240, 476),
        text_color=(0.92, 0.95, 0.94),
        fill_color=(0.086, 0.32, 0.302),
    )
    add_field(
        p1,
        "truckCount",
        fitz.Rect(320, 456, 420, 476),
        text_color=(0.92, 0.95, 0.94),
        fill_color=(0.086, 0.32, 0.302),
    )
    add_field(
        p1,
        "monthlyCalls",
        fitz.Rect(445, 456, 545, 476),
        text_color=(0.92, 0.95, 0.94),
        fill_color=(0.086, 0.32, 0.302),
    )
    add_field(
        p1,
        "moderateHeroTotal",
        fitz.Rect(80, 562, 350, 642),
        text_color=(0.18, 0.84, 0.6),
        fill_color=(0.086, 0.286, 0.271),
    )
    add_field(
        p1,
        "heroTradePill",
        fitz.Rect(108, 650, 200, 668),
        text_color=(0.92, 0.95, 0.94),
        fill_color=(0.086, 0.32, 0.302),
    )
    add_field(
        p1,
        "heroTrucksPill",
        fitz.Rect(224, 650, 290, 668),
        text_color=(0.92, 0.95, 0.94),
        fill_color=(0.086, 0.32, 0.302),
    )
    add_field(
        p1,
        "heroCallsPill",
        fitz.Rect(312, 650, 395, 668),
        text_color=(0.92, 0.95, 0.94),
        fill_color=(0.086, 0.32, 0.302),
    )

    # Page 2
    p2 = doc[1]
    add_field(p2, "summaryConservative", fitz.Rect(50, 148, 160, 164), text_color=(0.2, 0.2, 0.2))
    add_field(p2, "summaryModerate", fitz.Rect(268, 148, 360, 164), text_color=(0.2, 0.2, 0.2))
    add_field(p2, "summaryAggressive", fitz.Rect(470, 148, 565, 164), text_color=(0.2, 0.2, 0.2))

    drivers = [
        ("driver1Volume", fitz.Rect(84, 466, 190, 482)),
        ("driver1Annual", fitz.Rect(495, 456, 562, 478)),
        ("driver2Volume", fitz.Rect(84, 510, 190, 526)),
        ("driver2Annual", fitz.Rect(503, 500, 562, 522)),
        ("driver3Volume", fitz.Rect(84, 554, 175, 570)),
        ("driver3Annual", fitz.Rect(503, 544, 562, 566)),
        ("driver4Volume", fitz.Rect(84, 608, 165, 624)),
        ("driver4Annual", fitz.Rect(503, 594, 562, 616)),
        ("driver5Volume", fitz.Rect(84, 652, 170, 668)),
        ("driver5Annual", fitz.Rect(503, 642, 562, 664)),
    ]
    for name, rect in drivers:
        add_field(p2, name, rect, text_color=(0.2, 0.2, 0.2))

    add_field(p2, "moderateImpactTotal", fitz.Rect(485, 694, 562, 718), text_color=(0.18, 0.84, 0.6))

    scenarios = [
        ("conservativeRange", fitz.Rect(68, 208, 150, 224)),
        ("conservativeTotal", fitz.Rect(68, 226, 200, 266)),
        ("conservativeSlippingAway", fitz.Rect(136, 282, 202, 298)),
        ("conservativeUpside", fitz.Rect(142, 305, 202, 322)),
        ("moderateRange", fitz.Rect(240, 210, 322, 226)),
        ("moderateTotal", fitz.Rect(240, 228, 372, 268)),
        ("moderateSlippingAway", fitz.Rect(308, 284, 374, 300)),
        ("moderateUpside", fitz.Rect(314, 307, 374, 324)),
        ("aggressiveRange", fitz.Rect(412, 208, 500, 224)),
        ("aggressiveTotal", fitz.Rect(412, 226, 540, 266)),
        ("aggressiveSlippingAway", fitz.Rect(480, 282, 546, 298)),
        ("aggressiveUpside", fitz.Rect(480, 305, 546, 322)),
    ]
    for name, rect in scenarios:
        add_field(p2, name, rect, text_color=(0.2, 0.2, 0.2))

    # Page 5
    p5 = doc[4]
    add_field(p5, "closingConservative", fitz.Rect(346, 295, 404, 320), text_color=(0.18, 0.84, 0.6))
    add_field(p5, "closingModerate", fitz.Rect(412, 295, 472, 320), text_color=(0.18, 0.84, 0.6))
    add_field(p5, "closingAggressive", fitz.Rect(486, 295, 546, 320), text_color=(0.18, 0.84, 0.6))

    temp = OUTPUT.with_suffix(".tmp.pdf")
    doc.save(str(temp), garbage=4, deflate=True)
    doc.close()
    temp.replace(OUTPUT)
    print(f"Prepared fillable template: {OUTPUT}")


if __name__ == "__main__":
    prepare()
