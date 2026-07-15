#!/usr/bin/env python3
"""Render docs/ops-guide-print.html → docs/OPS_GUIDE.pdf (Korean-safe via Chromium)."""

from __future__ import annotations

import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "docs" / "ops-guide-print.html"
OUT = ROOT / "docs" / "OPS_GUIDE.pdf"
DESKTOP_COPY = Path.home() / "Desktop" / "Han-ops" / "OPS_GUIDE.pdf"


def build() -> None:
    if not HTML.exists():
        raise FileNotFoundError(f"Missing template: {HTML}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    url = HTML.as_uri()

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(url, wait_until="networkidle")
        page.pdf(
            path=str(OUT),
            format="A4",
            print_background=True,
            margin={"top": "14mm", "right": "12mm", "bottom": "16mm", "left": "12mm"},
        )
        browser.close()

    DESKTOP_COPY.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(OUT, DESKTOP_COPY)
    print(f"Created: {OUT}")
    print(f"Copied:  {DESKTOP_COPY}")


if __name__ == "__main__":
    build()
