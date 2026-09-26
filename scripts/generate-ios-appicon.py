#!/usr/bin/env python3
"""Regenerate the iOS marketing app icon from the bandstr logo artwork.

Capacitor ships a placeholder icon whenever the iOS project is re-created, so
run this after `npx cap add ios` or any regeneration of src-capacitor/ios.

App Store Connect rejects icons with an alpha channel, so the artwork is
flattened onto black (its own frame is already near-black at the edges).

Usage: python3 scripts/generate-ios-appicon.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "bandstr_app_logo.png"
TARGET = ROOT / "packages/web/src-capacitor/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
SIZE = 1024

artwork = Image.open(SOURCE).convert("RGBA")
bbox = artwork.split()[3].getbbox()
if bbox:
    artwork = artwork.crop(bbox)
artwork = artwork.resize((SIZE, SIZE), Image.Resampling.LANCZOS)

canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 255))
canvas.alpha_composite(artwork)
canvas.convert("RGB").save(TARGET, format="PNG", optimize=True)

check = Image.open(TARGET)
print(f"{TARGET.relative_to(ROOT)}  {check.size[0]}x{check.size[1]}  mode={check.mode}")
