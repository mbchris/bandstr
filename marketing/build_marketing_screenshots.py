#!/usr/bin/env python3
"""Compose upload-ready App Store screenshots from raw simulator captures.

Mirrors the pipeline used in the localplay project: raw captures live in
`raw/<device>/`, this script places each one on a branded background with a
headline and writes the App Store Connect sizes into `screenshots/<device>/`.

Requires Pillow:  pip3 install --user Pillow
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent

ICON = REPO / "packages/web/src-capacitor/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
FONT = "/System/Library/Fonts/SFNS.ttf"
ROUNDED_FONT = "/System/Library/Fonts/SFNSRounded.ttf"

# App Store Connect portrait slots.
IPAD_13 = (2064, 2752)
IPHONE_69 = (1320, 2868)
# App Store Connect's 6.5-inch slot only accepts these dimensions.
IPHONE_65 = (1284, 2778)

# Brand palette, taken from packages/web/src/css/quasar.variables.scss.
SLATE = (22, 27, 34)
INDIGO = (99, 102, 241)

PANELS = [
    ("01-setlist.png", "Die Setlist,\ndie alle sehen.", "setlist.png"),
    ("02-calendar.png", "Proben und Gigs.\nAn einem Ort.", "calendar.png"),
    ("03-voting.png", "Songideen bewerten,\nstatt diskutieren.", "voting.png"),
    ("04-band.png", "Die Band,\nsauber organisiert.", "band.png"),
    ("05-dashboard.png", "Alles Wichtige\nauf einen Blick.", "dashboard.png"),
]

EN_PANELS = [
    ("01-setlist.png", "One setlist.\nEveryone sees it.", "setlist.png"),
    ("02-calendar.png", "Rehearsals and gigs.\nAll in one place.", "calendar.png"),
    ("03-voting.png", "Rate song ideas\ninstead of debating.", "voting.png"),
    ("04-band.png", "Your band,\nproperly organized.", "band.png"),
    ("05-dashboard.png", "Everything that matters,\nat a glance.", "dashboard.png"),
]


def background(size: tuple[int, int]) -> Image.Image:
    """Vertical slate-to-indigo gradient with two soft glows."""
    width, height = size
    base = Image.new("RGB", (1, height))
    pixels = base.load()
    for y in range(height):
        t = y / max(height - 1, 1)
        # Ease the ramp so the top stays dark enough for white headlines.
        e = t * t * (3 - 2 * t)
        pixels[0, y] = tuple(round(SLATE[i] + (INDIGO[i] - SLATE[i]) * e * 0.62) for i in range(3))
    base = base.resize(size, Image.Resampling.BILINEAR).convert("RGBA")

    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    r = width * 0.62
    draw.ellipse((-r * 0.35, height * 0.30, r * 1.05, height * 0.30 + r * 1.4), fill=(99, 102, 241, 90))
    draw.ellipse((width - r * 0.75, -r * 0.30, width + r * 0.55, r * 0.85), fill=(244, 63, 94, 46))
    glow = glow.filter(ImageFilter.GaussianBlur(width // 6))
    return Image.alpha_composite(base, glow)


def rounded(image: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width, image.height), radius=radius, fill=255)
    result = image.convert("RGBA")
    result.putalpha(mask)
    return result


def make_panel(
    filename: str,
    headline: str,
    screenshot_name: str,
    raw_dir: Path,
    output_dir: Path,
    size: tuple[int, int],
) -> None:
    scale = size[0] / IPAD_13[0]
    base = background(size)
    draw = ImageDraw.Draw(base)

    icon_px = round(104 * scale)
    margin = round(120 * scale)
    icon = rounded(Image.open(ICON).convert("RGBA").resize((icon_px, icon_px), Image.Resampling.LANCZOS), round(icon_px * 0.23))
    base.alpha_composite(icon, (margin, round(96 * scale)))
    draw.text(
        (margin + icon_px + round(36 * scale), round(118 * scale)),
        "bandstr",
        font=ImageFont.truetype(ROUNDED_FONT, round(56 * scale)),
        fill=(255, 255, 255, 238),
    )
    draw.multiline_text(
        (margin, round(232 * scale)),
        headline,
        font=ImageFont.truetype(FONT, round(96 * scale)),
        fill="white",
        spacing=round(8 * scale),
    )

    source = Image.open(raw_dir / screenshot_name).convert("RGB")
    target_width = round(size[0] * 0.83)
    target_height = round(source.height * target_width / source.width)
    source = rounded(source.resize((target_width, target_height), Image.Resampling.LANCZOS), round(54 * scale))
    x, y = (size[0] - target_width) // 2, round(560 * scale)

    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (x - round(18 * scale), y + round(18 * scale), x + target_width + round(18 * scale), y + target_height + round(44 * scale)),
        radius=round(68 * scale),
        fill=(0, 0, 0, 150),
    )
    base = Image.alpha_composite(base, shadow.filter(ImageFilter.GaussianBlur(round(34 * scale))))
    base.alpha_composite(source, (x, y))

    output_dir.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(output_dir / filename, quality=96, optimize=True)


def cover_resize(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    ratio = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def make_app_store_compatible_iphone_set(source_dir: Path, output_dir: Path) -> int:
    """Re-export the 6.9-inch artwork at the size the 6.5-inch slot accepts."""
    if not source_dir.exists():
        return 0
    output_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for source_path in sorted(source_dir.glob("*.png")):
        image = cover_resize(Image.open(source_path).convert("RGB"), IPHONE_65)
        image.save(output_dir / source_path.name, quality=96, optimize=True)
        print(f"  {output_dir / source_path.name}  {IPHONE_65[0]}x{IPHONE_65[1]}")
        count += 1
    return count


def build(panels, raw_dir: Path, output_dir: Path, size: tuple[int, int]) -> int:
    built = 0
    for filename, headline, screenshot_name in panels:
        if not (raw_dir / screenshot_name).exists():
            print(f"  skip {filename}: missing raw capture {raw_dir / screenshot_name}")
            continue
        make_panel(filename, headline, screenshot_name, raw_dir, output_dir, size)
        print(f"  {output_dir / filename}  {size[0]}x{size[1]}")
        built += 1
    return built


if __name__ == "__main__":
    total = 0
    print("iPad 13-inch (2064x2752):")
    total += build(PANELS, ROOT / "raw" / "ipad-13", ROOT / "screenshots" / "ipad-13", IPAD_13)
    total += build(EN_PANELS, ROOT / "raw" / "en" / "ipad-13", ROOT / "screenshots" / "en" / "ipad-13", IPAD_13)
    print("iPhone 6.9-inch (1320x2868):")
    total += build(PANELS, ROOT / "raw" / "iphone-6.9", ROOT / "screenshots" / "iphone-6.9", IPHONE_69)
    total += build(EN_PANELS, ROOT / "raw" / "en" / "iphone-6.9", ROOT / "screenshots" / "en" / "iphone-6.9", IPHONE_69)
    print("iPhone 6.5-inch (1284x2778):")
    total += make_app_store_compatible_iphone_set(
        ROOT / "screenshots" / "iphone-6.9", ROOT / "screenshots" / "iphone-6.5"
    )
    total += make_app_store_compatible_iphone_set(
        ROOT / "screenshots" / "en" / "iphone-6.9", ROOT / "screenshots" / "en" / "iphone-6.5"
    )

    print(f"\n{total} screenshot(s) written.")
