"""Create the default Warlock patron mark without the three optional triangles.

The triangles are part of the earlier extracted center image, but the user chose a
clean patron mark. This only removes those three isolated components; the source
rosette itself is preserved unchanged.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "glyphs" / "warlock" / "Warlock_Center.png"
OUTPUT = ROOT / "public" / "glyphs" / "warlock" / "Warlock_Center_Clean.png"


def main() -> None:
    image = Image.open(SOURCE).convert("RGBA")
    pixels = image.load()
    opaque = {(x, y) for y in range(image.height) for x in range(image.width) if pixels[x, y][3] > 12}
    components: list[list[tuple[int, int]]] = []
    while opaque:
        seed = opaque.pop()
        queue = [seed]
        component = [seed]
        while queue:
            x, y = queue.pop()
            for neighbor in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if neighbor in opaque:
                    opaque.remove(neighbor)
                    queue.append(neighbor)
                    component.append(neighbor)
        components.append(component)

    # Remove only the three detached triangle components. This deliberately
    # preserves the individual petals and internal triangular geometry of the
    # patron rosette.
    triangle_bounds = {(38, 132, 102, 202), (395, 132, 459, 202), (213, 436, 284, 471)}
    for component in components:
        bounds = (
            min(x for x, _ in component), min(y for _, y in component),
            max(x for x, _ in component) + 1, max(y for _, y in component) + 1,
        )
        if bounds in triangle_bounds:
            for x, y in component:
                pixels[x, y] = (0, 0, 0, 0)

    # The source raster also contains faint, detached outline remnants around
    # those same three decorations. These zones sit wholly outside the rosette.
    for x0, y0, x1, y1 in ((20, 115, 125, 230), (387, 115, 492, 230), (190, 425, 315, 490)):
        for y in range(y0, y1):
            for x in range(x0, x1):
                pixels[x, y] = (0, 0, 0, 0)
    image.save(OUTPUT)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
