"""Extract the printed n4 and n30 marks from the Warlock Dispel Magic seal.

These are source notation, not generated artwork. The page-69 seal is the clearest
printed reference for the `aF + d4 x n30` range used by Dispel Magic.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image
import pypdfium2 as pdfium


ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "Source PDFs" / "Warlock_Spell_Compendium_v1_3.pdf"
OUT = ROOT / "app" / "public" / "glyphs" / "warlock"
INK = (91, 11, 32)

# Bounds on the 2.5x raster of PDF page 69 (zero-based page index 68).
GLYPH_BOUNDS = {
    "n4": (322, 781, 354, 808),
    "n30": (357, 826, 407, 870),
}


def is_warlock_ink(red: int, green: int, blue: int) -> bool:
    return red > green * 1.35 and red > blue * 1.2 and red > 45 and green < 110


def main() -> None:
    page = pdfium.PdfDocument(PDF)[68]
    source = page.render(scale=2.5).to_pil().convert("RGBA")
    for name, bounds in GLYPH_BOUNDS.items():
        glyph = source.crop(bounds)
        pixels = glyph.load()
        for y in range(glyph.height):
            for x in range(glyph.width):
                red, green, blue, alpha = pixels[x, y]
                pixels[x, y] = (*INK, alpha if is_warlock_ink(red, green, blue) else 0)
        glyph.save(OUT / f"{name}.png")
        print(f"Extracted {name}.png")


if __name__ == "__main__":
    main()
