"""Repair the extracted Warlock TrueType container without altering its glyphs.

The source-derived font lacks its required `post` table. Browsers reject that otherwise
valid font and silently render the source code strings in a fallback serif face.
"""

from __future__ import annotations

import struct
from pathlib import Path


FONT = Path(__file__).resolve().parents[1] / "public" / "fonts" / "Warlock Font.ttf"
CHECKSUM_MAGIC = 0xB1B0AFBA


def checksum(data: bytes) -> int:
    padded = data + b"\0" * ((-len(data)) % 4)
    return sum(struct.unpack(f">{len(padded) // 4}I", padded)) & 0xFFFFFFFF


def main() -> None:
    data = FONT.read_bytes()
    sfnt, count = struct.unpack_from(">IH", data, 0)
    if sfnt != 0x00010000:
        raise ValueError("Expected a TrueType font")

    records: list[tuple[bytes, int, int, int]] = []
    for index in range(count):
        offset = 12 + index * 16
        tag, table_sum, table_offset, length = struct.unpack_from(">4sIII", data, offset)
        records.append((tag, table_sum, table_offset, length))

    if any(tag == b"post" for tag, *_ in records):
        print("Warlock font already has a post table; no changes made.")
        return

    # PostScript table v3 contains the required metrics but no glyph names.
    post = struct.pack(">IihhIIIII", 0x00030000, 0, -100, 50, 0, 0, 0, 0, 0)
    header_size = 12 + (count + 1) * 16
    old_table_start = min(offset for _, _, offset, _ in records)
    shift = header_size - old_table_start
    moved = data[old_table_start:]
    post_offset = header_size + len(moved)
    post_offset += (-post_offset) % 4

    new_count = count + 1
    max_power = 1 << (new_count.bit_length() - 1)
    header = struct.pack(">IHHHH", sfnt, new_count, max_power * 16, max_power.bit_length() - 1, new_count * 16 - max_power * 16)

    repaired: list[tuple[bytes, int, int, int]] = []
    for tag, table_sum, table_offset, length in records:
        repaired.append((tag, table_sum, table_offset + shift, length))
    repaired.append((b"post", checksum(post), post_offset, len(post)))
    repaired.sort(key=lambda record: record[0])

    directory = b"".join(struct.pack(">4sIII", *record) for record in repaired)
    output = bytearray(header + directory + moved)
    output.extend(b"\0" * (post_offset - len(output)))
    output.extend(post)

    head_record = next(record for record in repaired if record[0] == b"head")
    head_offset = head_record[2]
    struct.pack_into(">I", output, head_offset + 8, 0)
    head_checksum = checksum(output[head_offset:head_offset + head_record[3]])
    record_offset = 12 + repaired.index(head_record) * 16
    struct.pack_into(">I", output, record_offset + 4, head_checksum)
    struct.pack_into(">I", output, head_offset + 8, (CHECKSUM_MAGIC - checksum(output)) & 0xFFFFFFFF)

    FONT.write_bytes(output)
    print(f"Repaired {FONT} ({len(data)} -> {len(output)} bytes)")


if __name__ == "__main__":
    main()
