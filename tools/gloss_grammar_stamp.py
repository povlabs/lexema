#!/usr/bin/env python3
"""Count noun and adjective glosses that end in a gender/number stamp (#308).

Standard library only. Streams `it-extract.jsonl.gz`; never loads it whole.

Wikizionario writes a noun's gender and number as an italic stamp on the
section's first `#` line: `# {{Pn|w}} ''f sing'' {{Linkp|case}}`. That line
states no meaning. The extraction keeps it as a sense anyway, so the stamp ends
up as the last letters of a gloss (`casa ( approfondimento) f sing`) and never
reaches the record's `tags`.

Two passes over each gloss:

  loose   the gloss ends in one or more tokens from the stamp vocabulary
          (m, f, sing, pl, inv, ...). Wide on purpose, to see everything.
  rule    the whole gloss is one page-control line: an optional lead from a
          closed list, then the stamp, and nothing else. This is the candidate
          rule the report proposes.

A loose hit the rule does not take is printed as a rejected hit, so every
record the rule would get wrong, or would miss, is on screen.

Usage: python3 tools/gloss_grammar_stamp.py [path/to/it-extract.jsonl.gz]
"""

from __future__ import annotations

import gzip
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
EXTRACT = REPO / "it-extract.jsonl.gz"
RELEASE_SHA256 = "0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf"

MEASURED_POS = ("noun", "adj")
GENDER_TAGS = {"masculine", "feminine"}
NUMBER_TAGS = {"singular", "plural"}

# Loose pass: any trailing run of these tokens, if it holds a gender or number.
STAMP_VOCABULARY = {"m", "f", "n", "sing", "pl", "inv", "invar", "e", "o", "/",
                    "m.", "f.", "sing.", "pl.", "sg", "plur", "solo"}
STAMP_CORE = {"m", "f", "sing", "pl", "inv", "m.", "f.", "sing.", "pl."}

# Rule pass. The stamp: a gender letter, optionally a number word.
STAMP = r"(?P<gender>[mf])(?: (?P<number>sing|pl))?"
# The placeholder `{{Nodef}}` prints (#255); the stamp can follow it.
NODEF = "definizione mancante; se vuoi, aggiungila tu"
GENDER = {"m": "masculine", "f": "feminine"}
NUMBER = {"sing": "singular", "pl": "plural"}


def rule_pattern(word: str) -> re.Pattern[str]:
    """The whole gloss is a page-control line: lead, then stamp, then nothing.

    The lead is one of a closed list: nothing, the headword, the headword and
    its `( approfondimento)` link, or the no-definition placeholder. Anything
    else before the stamp is prose, and an `m` after prose is a unit (`1 m`).
    """
    head = re.escape(word)
    lead = rf"(?:{head} \( approfondimento\) |{head} |{re.escape(NODEF)} )?"
    return re.compile(rf"^{lead}{STAMP}$")


def loose_tail(gloss: str) -> str | None:
    tokens = gloss.replace("/", " / ").split()
    tail: list[str] = []
    for token in reversed(tokens):
        if token.lower() not in STAMP_VOCABULARY:
            break
        tail.insert(0, token)
    return " ".join(tail) if any(t.lower() in STAMP_CORE for t in tail) else None


def residual(gloss: str, match: re.Match[str]) -> str:
    """The gloss with the stamp taken off, as a page would show it."""
    return gloss[: match.start("gender")].rstrip()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else EXTRACT
    digest = sha256(path)
    if digest != RELEASE_SHA256:
        print(f"refused: {path} is it-{digest[:8]}, not it-{RELEASE_SHA256[:8]}", file=sys.stderr)
        return 2

    totals: Counter[str] = Counter()
    rule_hits: list[dict] = []
    rejected: list[dict] = []
    rule_records: set[int] = set()
    loose_records: set[int] = set()

    with gzip.open(path, "rt", encoding="utf-8") as lines:
        for line_number, line in enumerate(lines, 1):
            record = json.loads(line)
            if record.get("lang_code") != "it":
                continue
            pos = record.get("pos")
            if pos not in MEASURED_POS:
                continue
            tags = set(record.get("tags") or [])
            has_gender = bool(tags & GENDER_TAGS)
            has_number = bool(tags & NUMBER_TAGS)
            totals[f"{pos} records"] += 1
            if not has_gender:
                totals[f"{pos} records with no gender tag"] += 1
            word = record["word"]
            pattern = rule_pattern(word)
            for sense_index, sense in enumerate(record.get("senses") or []):
                for gloss_index, gloss in enumerate(sense.get("glosses") or []):
                    tail = loose_tail(gloss)
                    if tail is None:
                        continue
                    loose_records.add(line_number)
                    row = {
                        "line": line_number,
                        "word": word,
                        "pos": pos,
                        "pointer": f"/senses/{sense_index}/glosses/{gloss_index}",
                        "gloss": gloss,
                        "recordTags": sorted(tags),
                    }
                    match = pattern.match(gloss)
                    if match is None:
                        rejected.append({**row, "tail": tail, "why": "lead is prose, not a page control"})
                        continue
                    gender = GENDER[match.group("gender")]
                    number = NUMBER.get(match.group("number") or "")
                    conflict = (has_gender and gender not in tags) or (
                        number is not None and has_number and number not in tags)
                    if conflict:
                        rejected.append({**row, "tail": tail, "why": "stamp disagrees with a record tag"})
                        continue
                    rule_records.add(line_number)
                    rule_hits.append({
                        **row,
                        "gender": gender,
                        "number": number,
                        "alreadyTagged": has_gender,
                        "shownGloss": residual(gloss, match),
                    })

    summary = {
        "release": f"it-{digest[:8]}",
        "totals": dict(sorted(totals.items())),
        "looseHitRecords": len(loose_records),
        "ruleRecords": len(rule_records),
        "ruleGlosses": len(rule_hits),
        "rejectedGlosses": len(rejected),
    }
    print(json.dumps({"summary": summary, "rule": rule_hits, "rejected": rejected},
                     ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
