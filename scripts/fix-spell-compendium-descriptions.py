from __future__ import annotations

import json
import re
import shutil
from collections.abc import Iterable
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TEXT_PATH = ROOT / "tmp" / "pdfs" / "text" / "Spell Compendium (Premium Edition).txt"
SPELLS_PATH = ROOT / "app" / "src" / "data" / "spells.json"
REPORT_PATH = ROOT / "tmp" / "spellcomp-description-report.json"
BACKUP_PATH = ROOT / "app" / "src" / "data" / f"spells.BACKUP-SPELLCOMP-DESCRIPTIONS-{datetime.now().strftime('%Y%m%d-%H%M')}.json"

CHAPTER_START_MARKER = "===== PAGE 6 ====="
CHAPTER_END_MARKER = "===== PAGE 247 ====="

SCHOOLS = (
    "Abjuration",
    "Conjuration",
    "Divination",
    "Enchantment",
    "Evocation",
    "Illusion",
    "Necromancy",
    "Transmutation",
)

STAT_LABELS = (
    "Level",
    "Components",
    "Casting Time",
    "Range",
    "Target",
    "Targets",
    "Effect",
    "Area",
    "Duration",
    "Saving Throw",
    "Spell Resistance",
)

STRUCTURAL_LINES = {
    "SPELL",
    "DESCRIPTIONS",
    "SPELL DESCRIPTIONS",
    "CHAPTER 1",
    "CHAPTER 2",
}

KNOWN_NAME_ALIASES = {
    "embrace": "wintersembrace",
    "mass": "snakesswiftnessmass",
    "fortune": "ruindelversfortune",
    "transformation": "nightstalkerstransformation",
    "eternalfoe": "undeathseternalfoe",
}

STAT_RE = re.compile(rf"^({'|'.join(re.escape(label) for label in STAT_LABELS)}):\s*", re.I)
UPPER_HEADER_RE = re.compile(r"[A-Z0-9 ,'/\-’]+$")
PAGE_RE = re.compile(r"^===== PAGE \d+ =====$")
CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")
SPACED_WORD_RE = re.compile(r"\b(?:[A-Za-z]\s+){3,}[A-Za-z]\b")
SHIFT_TOKEN_RE = re.compile(r"\b[0-9]?[A-ZǦƞÑ]{4,}\b")


def normalize_quotes(text: str) -> str:
    return (
        text.replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
        .replace("—", "-")
        .replace("–", "-")
        .replace("…", "...")
        .replace("ﬁ", "fi")
        .replace("ﬂ", "fl")
        .replace("�", "")
    )


def normalize_name_key(name: str) -> str:
    cleaned = normalize_quotes(name).lower()
    cleaned = re.sub(r"[^a-z0-9]+", "", cleaned)
    return cleaned


def is_structural_line(line: str) -> bool:
    stripped = clean_line(line)
    if not stripped:
        return True
    if stripped in STRUCTURAL_LINES:
        return True
    if PAGE_RE.fullmatch(stripped):
        return True
    if re.fullmatch(r"\d+", stripped):
        return True
    if stripped.startswith("Illus. by "):
        return True
    if re.fullmatch(r"p[qrs]+", stripped, re.I):
        return True
    return False


def collapse_spaced_words(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        token = match.group(0)
        letters = token.split()
        if all(len(part) == 1 for part in letters):
            return "".join(letters)
        return token

    return SPACED_WORD_RE.sub(repl, text)


def clean_line(line: str) -> str:
    line = normalize_quotes(line)
    line = CONTROL_RE.sub("", line)
    line = line.replace("\t", " ")
    line = re.sub(r"\s+", " ", line).strip()
    line = collapse_spaced_words(line)
    line = re.sub(r"\s+([,.;:?!])", r"\1", line)
    line = re.sub(r"\(\s+", "(", line)
    line = re.sub(r"\s+\)", ")", line)
    return line.strip()


def chapter_lines(all_lines: list[str]) -> tuple[list[str], int]:
    start = 0
    end = len(all_lines)
    for index, line in enumerate(all_lines):
        if line.strip() == CHAPTER_START_MARKER:
            start = index
        if line.strip() == CHAPTER_END_MARKER:
            end = index
            break
    return all_lines[start:end], start


def find_headers(lines: list[str]) -> list[dict[str, int | str]]:
    headers: list[dict[str, int | str]] = []
    for level_index, line in enumerate(lines):
        if not line.strip().startswith("Level:"):
            continue

        school_index = None
        for back in range(level_index - 1, max(-1, level_index - 5), -1):
            school_line = lines[back].strip()
            if school_line.startswith(SCHOOLS):
                school_index = back
                break
        if school_index is None:
            continue

        name_parts: list[str] = []
        for back in range(school_index - 1, max(-1, school_index - 5), -1):
            candidate = lines[back].strip()
            if not candidate:
                if name_parts:
                    break
                continue
            if candidate in STRUCTURAL_LINES:
                if name_parts:
                    break
                continue
            if UPPER_HEADER_RE.fullmatch(candidate) and any(ch.isalpha() for ch in candidate) and len(candidate) < 90:
                name_parts.insert(0, candidate)
                continue
            if name_parts:
                break

        if not name_parts:
            continue

        headers.append(
            {
                "name": " ".join(name_parts),
                "start": school_index - len(name_parts),
                "school": school_index,
                "level": level_index,
            }
        )
    return headers


def is_stat_continuation(line: str) -> bool:
    stripped = clean_line(line)
    if not stripped:
        return True
    if STAT_RE.match(stripped):
        return False
    if stripped.startswith(("(", "[", "+", "-", "/", "or ")):
        return True
    if stripped[0].isdigit() or stripped[0].islower():
        return True
    if stripped in {"(harmless)", "touched", "centered on you", "centered on a point in space"}:
        return True
    return False


def is_caption_line(lines: list[str], index: int) -> bool:
    line = clean_line(lines[index])
    if not line:
        return False
    next_line = clean_line(lines[index + 1]) if index + 1 < len(lines) else ""
    prev_line = clean_line(lines[index - 1]) if index > 0 else ""
    return next_line.startswith("Illus. by ") or prev_line.startswith("Illus. by ")


def has_upcoming_stat(block: list[str], start_index: int, window: int = 8) -> bool:
    remaining = window
    for index in range(start_index, len(block)):
        if remaining <= 0:
            break
        line = clean_line(block[index])
        if not line or is_structural_line(block[index]) or is_caption_line(block, index):
            continue
        remaining -= 1
        if STAT_RE.match(line):
            return True
    return False


def description_start(block: list[str], level_index: int) -> int:
    seen_stat = False
    current_index = level_index
    while current_index < len(block):
        stripped = clean_line(block[current_index])
        if not stripped:
            current_index += 1
            continue
        if is_structural_line(block[current_index]) or is_caption_line(block, current_index):
            current_index += 1
            continue
        if STAT_RE.match(stripped):
            seen_stat = True
            current_index += 1
            while current_index < len(block):
                continuation = clean_line(block[current_index])
                if not continuation:
                    current_index += 1
                    continue
                if is_structural_line(block[current_index]) or is_caption_line(block, current_index):
                    current_index += 1
                    continue
                if STAT_RE.match(continuation):
                    break
                if is_stat_continuation(block[current_index]):
                    current_index += 1
                    continue
                if has_upcoming_stat(block, current_index + 1):
                    current_index += 1
                    continue
                return current_index
            continue
        if seen_stat:
            if has_upcoming_stat(block, current_index + 1):
                current_index += 1
                continue
            return current_index
        current_index += 1
    return len(block)


def strip_caption_lines(lines: list[str]) -> list[str]:
    result: list[str] = []
    for index, raw in enumerate(lines):
        line = clean_line(raw)
        if not line:
            continue
        if is_structural_line(raw):
            continue
        next_lines = [
            clean_line(lines[index + offset])
            for offset in range(1, 4)
            if index + offset < len(lines)
        ]
        prev_lines = [
            clean_line(lines[index - offset])
            for offset in range(1, 4)
            if index - offset >= 0
        ]

        if line.startswith("Illus. by "):
            continue
        if any(candidate.startswith("Illus. by ") for candidate in next_lines + prev_lines):
            if len(line) < 90 and not re.search(r"[.,;:!?]", line) and not STAT_RE.match(line):
                continue
        if any(candidate.startswith("Illus. by ") for candidate in next_lines[:1]):
            continue
        result.append(line)
    return result


def join_lines(lines: Iterable[str]) -> str:
    parts: list[str] = []
    for raw in lines:
        line = clean_line(raw)
        if not line:
            continue
        if not parts:
            parts.append(line)
            continue
        if parts[-1].endswith("-"):
            parts[-1] = parts[-1][:-1] + line
        else:
            parts.append(line)
    text = " ".join(parts)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([,.;:?!])", r"\1", text)
    return text


def decode_shift_token(match: re.Match[str]) -> str:
    token = match.group(0)
    token = token.lstrip("0123456789")
    token = token.replace("Ǧ", "").replace("ƞ", "").replace("Ñ", "")
    if not token or not re.fullmatch(r"[A-Z]{4,}", token):
        return match.group(0)

    decoded = "".join(chr(((ord(ch) - ord("A") - 1) % 26) + ord("A")) for ch in token)
    original_vowels = sum(ch in "AEIOUY" for ch in token)
    decoded_vowels = sum(ch in "AEIOUY" for ch in decoded)
    helpful = any(
        piece in decoded
        for piece in (
            "THE",
            "ING",
            "ION",
            "ENT",
            "PORT",
            "SPELL",
            "SAVE",
            "ATTACK",
            "DAMAGE",
            "TARGET",
            "CREATURE",
            "BONUS",
            "ABILITY",
            "IMMUNE",
            "FORM",
            "POWER",
            "LEVEL",
        )
    )
    if decoded_vowels > original_vowels or helpful:
        return decoded
    return match.group(0)


def finalize_description(text: str) -> str:
    text = re.sub(r"\b\d+\s+CHAPTER\s+1\b", "", text)
    text = re.sub(r"\bCHAPTER\s+1\b", "", text)
    text = text.replace("SPELL DESCRIPTIONS", "")
    text = SHIFT_TOKEN_RE.sub(decode_shift_token, text)
    text = re.sub(r"\br\s+", "", text)
    bleed = re.search(
        r"\s+(?:[A-Z][A-Z'’,-]+(?:\s+[A-Z][A-Z'’,-]+){0,4})\s+"
        r"(?:Abjuration|Conjuration|Divination|Enchantment|Evocation|Illusion|Necromancy|Transmutation)\b.*$",
        text,
        re.S,
    )
    if bleed:
        text = text[:bleed.start()].rstrip()
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([,.;:?!])", r"\1", text)
    return text


def extract_entries() -> dict[str, dict[str, object]]:
    all_lines = TEXT_PATH.read_text(encoding="utf-8", errors="replace").splitlines()
    lines, offset = chapter_lines(all_lines)
    headers = find_headers(lines)
    entries: dict[str, dict[str, object]] = {}

    for index, header in enumerate(headers):
        start = int(header["start"])
        next_start = int(headers[index + 1]["start"]) if index + 1 < len(headers) else len(lines)
        block = lines[start:next_start]
        level_offset = int(header["level"]) - start
        desc_start = description_start(block, level_offset)
        raw_description_lines = block[desc_start:]
        cleaned_lines = strip_caption_lines(raw_description_lines)
        description = finalize_description(join_lines(cleaned_lines))
        entries[normalize_name_key(str(header["name"]))] = {
            "name": str(header["name"]),
            "description": description,
            "line": offset + start + 1,
        }
    return entries


def main() -> None:
    if not TEXT_PATH.exists():
        raise SystemExit(f"Missing extracted text file: {TEXT_PATH}")

    extracted = extract_entries()
    spells = json.loads(SPELLS_PATH.read_text(encoding="utf-8"))
    targets = [
        spell
        for spell in spells
        if spell.get("source") == "Spell Compendium (3.5)" and str(spell.get("id", "")).endswith("-spellcompendium35")
    ]

    unresolved: list[dict[str, str]] = []
    updated = 0

    for spell in spells:
        if not (spell.get("source") == "Spell Compendium (3.5)" and str(spell.get("id", "")).endswith("-spellcompendium35")):
            continue
        key = normalize_name_key(spell["name"])
        entry = extracted.get(key)
        if not entry:
            alias_key = KNOWN_NAME_ALIASES.get(key)
            if alias_key:
                entry = extracted.get(alias_key)
        if not entry or not entry["description"]:
            unresolved.append({"id": spell["id"], "name": spell["name"]})
            continue
        spell["description"] = entry["description"]
        updated += 1

    shutil.copyfile(SPELLS_PATH, BACKUP_PATH)
    SPELLS_PATH.write_text(json.dumps(spells, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    report = {
        "target_count": len(targets),
        "updated": updated,
        "unresolved": unresolved,
        "header_count": len(extracted),
        "backup": str(BACKUP_PATH),
        "sample": [
            {
                "id": spell["id"],
                "name": spell["name"],
                "description": spell["description"],
            }
            for spell in spells
            if spell.get("source") == "Spell Compendium (3.5)" and str(spell.get("id", "")).endswith("-spellcompendium35")
        ][:10],
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
