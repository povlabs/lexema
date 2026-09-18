#!/usr/bin/env python3
"""Measure how often the Italian Kaikki extraction drops real definitions.

Standard library only. Streams `it-extract.jsonl.gz`; never loads it whole.

Subcommands
-----------
sample        Pick a reproducible random sample of Italian words from the extract.
fetch         Download the wikitext of sampled pages from it.wiktionary and cache it.
classify      Read cached wikitext, label every Italian definition list line, and
              compare the page against the record the extract produced.
regressions   Emit the verified regression fixture for the pages named on the
              command line, keeping page controls, definitions and examples apart.

The classifier labels three kinds of line, and never conflates them:

  control     page furniture -- headword repeats, gender/number stamps, links to
              the plural, "approfondimento"/"citazioni" pointers, picture captions.
  definition  prose that states a meaning.
  example     a usage sentence or quotation illustrating a definition.
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass, field, asdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
EXTRACT = REPO / "it-extract.jsonl.gz"
CACHE = REPO / "fixtures" / "upstream-wikitext"     # rebuildable, not committed
PAGES = REPO / "fixtures" / "upstream-pages"        # saved regression pages
API = "https://it.wiktionary.org/w/api.php"
USER_AGENT = "lexema-definition-loss-study/1.0 (github.com/hueypov/lexema; issue 11)"

# it.wiktionary marks a language section with {{-xx-}} and a part of speech with
# {{-sost-|it}}, {{-agg-|it}} and friends. `form` suffixes mark inflected entries.
LANG_SECTION = re.compile(r"^==\s*\{\{-([a-zA-Z-]+)-\}\}\s*==\s*$", re.M)
POS_TEMPLATE = re.compile(r"^\{\{-([a-z][a-z \-]*?)-\|([a-z-]+)\}\}\s*$", re.M)

# Templates and markup that carry no meaning of their own on a definition line.
CONTROL_TEMPLATES = {
    "pn", "linkp", "tabs", "tabs sost", "w", "vedi", "-sill-", "colore",
    "coloren", "quote", "audio", "ipa", "passo biblico",
}
# Templates that label a definition (domain, register, figurative use). Their
# presence does not make a line meaningful on its own.
LABEL_TEMPLATES = {"term", "glossa", "fig", "est", "pop", "ant", "raro", "spec"}

GRAMMAR_WORDS = {
    "m", "f", "n", "mf", "c", "sing", "sing.", "singolare", "pl", "pl.", "plur",
    "plurale", "inv", "invariabile", "solo", "e", "o", "s", "anche", "pl:",
}

TEMPLATE_RE = re.compile(r"\{\{([^{}|]*)((?:\|[^{}]*)?)\}\}")
BOLD_MARK = "\x00B\x00"
QUOTE_BLOCK = re.compile(r"^\s*\{\{\s*(Quote|Cit|Fonte)\b", re.I)
CATEGORY_RE = re.compile(r"\[\[\s*Categoria:[^\[\]]*\]\]", re.I)
LINK_RE = re.compile(r"\[\[([^\[\]|]*)(?:\|([^\[\]]*))?\]\]")
FILE_RE = re.compile(r"\[\[\s*(?:File|Image|Immagine):[^\[\]]*(?:\[\[[^\[\]]*\]\][^\[\]]*)*\]\]", re.I)


# --------------------------------------------------------------------------
# wikitext helpers
# --------------------------------------------------------------------------


def strip_files(text: str) -> str:
    prev = None
    while prev != text:
        prev, text = text, FILE_RE.sub(" ", text)
    return CATEGORY_RE.sub(" ", text)


def template_names(text: str) -> list[str]:
    return [m.group(1).strip().lower() for m in TEMPLATE_RE.finditer(text)]


def plain_text(text: str) -> str:
    """Render a wikitext line down to the words a reader would actually see.

    Templates are removed rather than expanded: the point is to find out whether
    a line carries prose of its own, and an expanded {{Pn}} would only put the
    headword back and make a control line look like a definition.
    """
    text = strip_files(text)
    text = TEMPLATE_RE.sub(" ", text)
    text = LINK_RE.sub(lambda m: m.group(2) or m.group(1), text)
    text = re.sub(r"'{2,}", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" ;:,.-")


def _split_italics(text: str) -> tuple[list[str], str]:
    """Split a line into its italic runs and the text left outside them.

    Bold is masked first so that `''a '''b''' c''` reads as one italic run, and a
    run left unterminated at end of line still counts -- both shapes occur on
    it.wiktionary and both are parsed as italic by the real extractor.
    """
    text = strip_files(text).replace("'''", BOLD_MARK)
    parts = text.split("''")
    runs, outside = [], []
    for index, part in enumerate(parts):
        (runs if index % 2 else outside).append(part.replace(BOLD_MARK, ""))
    return [r for r in runs if r.strip()], plain_text(" ".join(outside))


def italic_runs(text: str) -> list[str]:
    """Italic runs as they appear in markup.

    A run is counted even when it renders to nothing once templates are removed
    (`''{{Pn}}''` is a real italic node to the extractor, so it still yields an
    example and no definition is lost there).
    """
    return _split_italics(text)[0]


# --------------------------------------------------------------------------
# line classification
# --------------------------------------------------------------------------


@dataclass
class Line:
    marker: str          # "#", "#*", "#**", "#:" ...
    depth: int
    raw: str
    kind: str            # control | definition | example
    text: str
    has_italic: bool
    extractable: bool    # would wiktextract's example reader keep any text?


def classify_line(marker: str, body: str, word: str) -> Line:
    depth = len(marker)
    visible = plain_text(body)
    italics = italic_runs(body)
    names = set(template_names(body))
    meaningful = visible
    # Drop the headword itself and bare grammar stamps before judging the line.
    if meaningful.lower().startswith(word.lower()):
        meaningful = meaningful[len(word):]
    tokens = [t for t in re.split(r"[\s,;]+", meaningful.lower()) if t]
    tokens = [t for t in tokens if t not in GRAMMAR_WORDS and t != word.lower()]

    is_control = not tokens

    if depth > 1 and marker[1:2] in "*:":
        # Below a `#`, wiktextract routes the line to the example reader, which
        # keeps italic runs only. So italics here mean "usage sentence the
        # extractor can keep"; their absence means prose it will silently drop.
        kind = "control" if is_control and not italics else (
            "example" if italics else "definition")
    elif is_control:
        kind = "control"
    else:
        kind = "definition"

    # wiktextract's it/example.py only emits an Example when it meets an ITALIC
    # node; a `#*` line with no italics produces nothing at all.
    extractable = bool(italics)
    return Line(marker, depth, body.strip(), kind, visible, bool(italics), extractable)


@dataclass
class Continuation:
    """Prose wrapped onto the physical line after a `#` item.

    The list parser ends a list item at the newline, so this text never reaches
    the sense it belongs to. A separate loss route from the `#*` one.
    """
    after: str
    text: str
    kind: str  # prose | quotation


@dataclass
class PosSection:
    pos_template: str
    lines: list[Line] = field(default_factory=list)
    continuations: list[Continuation] = field(default_factory=list)

    @property
    def top_level_definitions(self) -> list[Line]:
        return [l for l in self.lines if l.depth == 1 and l.kind == "definition"]

    @property
    def lost_definitions(self) -> list[Line]:
        """Definitions the extractor cannot reach.

        Two routes, both proven from wiktextract's it extractor source:
          * a definition below `#` -- `#*`/`#:` children go to the example
            reader, which keeps only italic runs, so plain prose vanishes;
          * a definition on a `#*` line under a control `#` line -- same route.
        Only `##` children are read back as sub-senses.
        """
        out = []
        for l in self.lines:
            if l.depth > 1 and l.kind == "definition" and l.marker[1:2] in "*:":
                out.append(l)
        return out

    @property
    def lost_examples(self) -> list[Line]:
        """Examples the extractor cannot reach.

        `#**` sits one level below the `#*` the reader looks at, so it is only
        ever read as a translation of an example -- and when the `#*` above it
        produced no example, it is dropped with it.
        """
        return [l for l in self.lines
                if l.kind == "example" and (l.depth > 2 or not l.extractable)]


def parse_italian_sections(wikitext: str, word: str) -> list[PosSection]:
    """Return the Italian part-of-speech sections of a page, with their lists."""
    spans = [(m.group(1).lower(), m.start(), m.end()) for m in LANG_SECTION.finditer(wikitext)]
    sections: list[PosSection] = []
    for i, (code, _start, end) in enumerate(spans):
        if code != "it":
            continue
        stop = spans[i + 1][1] if i + 1 < len(spans) else len(wikitext)
        body = wikitext[end:stop]
        current: PosSection | None = None
        for raw_line in body.splitlines():
            line = raw_line.rstrip()
            pos_match = POS_TEMPLATE.match(line.strip())
            if pos_match and pos_match.group(2) == "it":
                current = PosSection(pos_template=pos_match.group(1))
                sections.append(current)
                continue
            if line.strip().startswith("{{-") and not pos_match:
                # a non-POS subsection (-sill-, -pron-, -sin- ...) closes the list
                current = None
                continue
            if current is None:
                continue
            m = re.match(r"^(#+[*:]*)\s*(.*)$", line)
            if m:
                current.lines.append(classify_line(m.group(1), m.group(2), word))
            elif current.lines and line.strip():
                # Prose wrapped onto the next physical line, outside the list.
                kind = "quotation" if QUOTE_BLOCK.match(line) else "prose"
                text = plain_text(line)
                # Leftover markup and stray fragments are not lost prose; only
                # count a wrapped line that reads as a sentence of its own.
                if text and len(text.split()) >= 4:
                    current.continuations.append(
                        Continuation(after=current.lines[-1].text, text=text, kind=kind))
    return [s for s in sections if s.lines]


# --------------------------------------------------------------------------
# extract-side reading
# --------------------------------------------------------------------------


def iter_italian(path: Path = EXTRACT):
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, 1):
            if '"lang_code": "it"' not in line and '"lang_code":"it"' not in line:
                continue
            record = json.loads(line)
            if record.get("lang_code") == "it":
                yield lineno, record


def is_lemma(record: dict) -> bool:
    if "form-of" in (record.get("tags") or []):
        return False
    return not any("form-of" in (s.get("tags") or []) for s in record.get("senses") or [])


def records_for(words: set[str]) -> dict[str, list[dict]]:
    found: dict[str, list[dict]] = {w: [] for w in words}
    for lineno, record in iter_italian():
        if record["word"] in found:
            record["_line"] = lineno
            found[record["word"]].append(record)
    return found


# --------------------------------------------------------------------------
# commands
# --------------------------------------------------------------------------


def cmd_sample(args) -> None:
    """Sample records, then deduplicate words: page rates are descriptive only."""
    rng = random.Random(args.seed)
    reservoir: list[str] = []
    seen = 0
    for _lineno, record in iter_italian():
        if args.stratum == "lemma" and not is_lemma(record):
            continue
        if args.stratum == "inflected" and is_lemma(record):
            continue
        seen += 1
        if len(reservoir) < args.size:
            reservoir.append(record["word"])
        else:
            j = rng.randrange(seen)
            if j < args.size:
                reservoir[j] = record["word"]
    out = {"stratum": args.stratum, "seed": args.seed, "population": seen,
           "words": sorted(set(reservoir))}
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"stratum={args.stratum} population={seen} sampled={len(out['words'])} -> {args.out}")


def api_fetch(titles: list[str]) -> dict[str, dict]:
    params = {
        "action": "query", "format": "json", "formatversion": "2",
        "prop": "revisions", "rvprop": "content|ids|timestamp", "rvslots": "main",
        "titles": "|".join(titles),
    }
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params),
                                 headers={"User-Agent": USER_AGENT})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.load(resp)
            break
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 503) or attempt == 5:
                raise
            wait = 5 * 2 ** attempt
            print(f"  HTTP {exc.code}, waiting {wait}s")
            time.sleep(wait)
    out = {}
    for page in data.get("query", {}).get("pages", []):
        if page.get("missing"):
            out[page["title"]] = {"missing": True}
            continue
        rev = page["revisions"][0]
        out[page["title"]] = {
            "revid": rev["revid"], "timestamp": rev["timestamp"],
            "wikitext": rev["slots"]["main"]["content"],
        }
    return out


def cache_path(word: str) -> Path:
    safe = urllib.parse.quote(word, safe="")
    return CACHE / f"{safe}.json"


def cmd_fetch(args) -> None:
    words = json.loads(Path(args.sample).read_text(encoding="utf-8"))["words"] \
        if args.sample else args.words
    CACHE.mkdir(parents=True, exist_ok=True)
    todo = [w for w in words if not cache_path(w).exists()]
    print(f"{len(words)} words, {len(todo)} to download")
    for i in range(0, len(todo), 40):
        batch = todo[i:i + 40]
        for title, payload in api_fetch(batch).items():
            payload["word"] = title
            cache_path(title).write_text(
                json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  {min(i + 40, len(todo))}/{len(todo)}")
        time.sleep(2.0)


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float, float]:
    if n == 0:
        return (0.0, 0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / d
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return p, max(0.0, centre - half), min(1.0, centre + half)


def cmd_classify(args) -> None:
    meta = json.loads(Path(args.sample).read_text(encoding="utf-8"))
    words = meta["words"]
    cached = {}
    for w in words:
        p = cache_path(w)
        if p.exists():
            cached[w] = json.loads(p.read_text(encoding="utf-8"))
    print(f"cached pages: {len(cached)}/{len(words)}")

    extract = records_for(set(cached))

    affected, examples_only, clean, no_italian, missing = [], [], [], [], []
    continuation_loss = []
    for word, payload in sorted(cached.items()):
        if payload.get("missing"):
            missing.append(word)
            continue
        sections = parse_italian_sections(payload["wikitext"], word)
        if not sections:
            no_italian.append(word)
            continue
        lost_defs = [l for s in sections for l in s.lost_definitions]
        lost_ex = [l for s in sections for l in s.lost_examples]
        conts = [c for s in sections for c in s.continuations if c.kind == "prose"]
        if conts:
            continuation_loss.append(word)
        entry = {
            "word": word, "revid": payload.get("revid"),
            "lost_definitions": [l.text for l in lost_defs],
            "lost_examples": [l.text for l in lost_ex],
            "wrapped_prose": [c.text for c in conts],
            "extract_glosses": [g for r in extract.get(word, [])
                                for s in r.get("senses", []) for g in (s.get("glosses") or [])],
        }
        if lost_defs:
            affected.append(entry)
        elif lost_ex:
            examples_only.append(entry)
        else:
            clean.append(word)

    n = len(affected) + len(examples_only) + len(clean)
    report = {
        "stratum": meta["stratum"], "seed": meta["seed"],
        "record_sampling_population": meta["population"],
        "measurement_unit": "distinct pages from a record-weighted sample; not a uniform page sample",
        "classification": "heuristic flags, not hand-verified definition losses",
        "pages_cached": len(cached), "pages_classified": n,
        "pages_missing_upstream": len(missing),
        "pages_without_italian_section": len(no_italian),
        "definition_loss": len(affected),
        "example_loss_only": len(examples_only),
        "clean": len(clean),
        "pages_with_wrapped_prose": len(continuation_loss),
    }
    for label, k in (("definition_loss", len(affected)),
                     ("example_loss_only", len(examples_only))):
        report[label + "_rate"] = round(k / n, 4) if n else 0.0
        # No record projection: classification covers every POS on each page.
    report["affected_pages"] = affected
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    for key, value in report.items():
        if key != "affected_pages":
            print(f"{key}: {value}")
    print(f"\nwrote {args.out}")


def cmd_regressions(args) -> None:
    """Emit draft cases. Human semantic labels must be reviewed before committing."""
    cases = []
    all_records = records_for(set(args.words))
    for word in args.words:
        payload = json.loads(cache_path(word).read_text(encoding="utf-8"))
        sections = parse_italian_sections(payload["wikitext"], word)
        records = all_records.get(word, [])
        case = {
            "word": word,
            "source": {
                "wiki": "it.wiktionary.org",
                "revid": payload["revid"],
                "timestamp": payload["timestamp"],
                "url": f"https://it.wiktionary.org/w/index.php?title="
                       f"{urllib.parse.quote(word)}&oldid={payload['revid']}",
                "licence": "CC BY-SA 4.0",
            },
            "sections": [],
            "extract": [
                {"line": r["_line"], "pos": r["pos"],
                 "glosses": [g for s in r["senses"] for g in (s.get("glosses") or [])],
                 "examples": [e.get("text", "") for s in r["senses"]
                              for e in (s.get("examples") or [])]}
                for r in records
            ],
        }
        for section in sections:
            case["sections"].append({
                "pos_template": section.pos_template,
                "page_controls": [l.text for l in section.lines if l.kind == "control"],
                "definitions": [
                    {"text": l.text, "marker": l.marker,
                     "reachable_by_extractor": l.depth == 1}
                    for l in section.lines if l.kind == "definition"],
                "examples": [
                    {"text": l.text, "marker": l.marker,
                     "reachable_by_extractor": l.depth == 2 and l.extractable}
                    for l in section.lines if l.kind == "example"],
            })
        cases.append(case)
        PAGES.mkdir(parents=True, exist_ok=True)
        header = (f"<!-- it.wiktionary.org/wiki/{word} revision {payload['revid']} "
                  f"({payload['timestamp']}), CC BY-SA 4.0. Saved verbatim. -->\n")
        (PAGES / (urllib.parse.quote(word, safe="") + ".wikitext")).write_text(
            header + payload["wikitext"], encoding="utf-8")
    Path(args.out).write_text(json.dumps(cases, ensure_ascii=False, indent=2), encoding="utf-8")
    for case in cases:
        lost = sum(1 for s in case["sections"] for d in s["definitions"]
                   if not d["reachable_by_extractor"])
        total = sum(len(s["definitions"]) for s in case["sections"])
        print(f"{case['word']}: {lost}/{total} definitions unreachable, "
              f"extract glosses={[g for e in case['extract'] for g in e['glosses']]}")
    print(f"\nwrote {args.out}")


def cmd_verify(args) -> None:
    """Re-run every regression case from saved pages and the extract. No network."""
    cases = json.loads(Path(args.cases).read_text(encoding="utf-8"))
    records = records_for({c["word"] for c in cases})
    failures = []
    for case in cases:
        word = case["word"]
        saved = PAGES / (urllib.parse.quote(word, safe="") + ".wikitext")
        wikitext = re.sub(r"^<!--.*?-->\n", "", saved.read_text(encoding="utf-8"), count=1)
        sections = parse_italian_sections(wikitext, word)

        expected_lost = sorted(d["text"] for s in case["sections"]
                               for d in s["definitions"] if not d["reachable_by_extractor"])
        # Human labels are independent of the italic-based classifier. Check
        # every saved line, including controls and retained definitions/examples.
        actual_lines = [sorted(l.text for l in s.lines) for s in sections]
        expected_lines = [sorted(s['page_controls'] +
                          [d['text'] for d in s['definitions'] + s['examples']])
                          for s in case['sections']]
        if actual_lines != expected_lines:
            failures.append(f"{word}: saved page content changed")
        if [s.pos_template for s in sections] != [s['pos_template'] for s in case['sections']]:
            failures.append(f"{word}: page POS sections changed")

        actual_records = [
            {'line': r['_line'], 'pos': r['pos'],
             'glosses': [g for s in r.get('senses', []) for g in s.get('glosses', [])],
             'examples': [e.get('text', '') for s in r.get('senses', []) for e in s.get('examples', [])],
             'translations': [e['translation'] for s in r.get('senses', [])
                              for e in s.get('examples', []) if 'translation' in e]}
            for r in records.get(word, [])]
        expected_records = [dict(r, translations=r.get('translations', [])) for r in case['extract']]
        if not actual_records or actual_records != expected_records:
            failures.append(f"{word}: required records or retained fields changed")

        # Every definition the page states must be absent from the extract when
        # we call it unreachable, and present when we call it reachable.
        glosses = " || ".join(g for r in records.get(word, [])
                             for s in r.get("senses", []) for g in (s.get("glosses") or []))
        for text in expected_lost:
            # Probe the longest clause, not the opening words: a lost definition
            # often restates the sub-headword that the `#` line above already
            # contributed as a gloss, and that repeat proves nothing.
            clauses = [c.strip() for c in re.split(r"[,;:]", text)]
            probe = max(clauses, key=len)[:40]
            if len(probe) >= 12 and probe in glosses:
                failures.append(
                    f"{word}: {probe!r} was expected missing but the extract has it")

        status = "LOSS" if expected_lost else "ok"
        print(f"{status:5} {word:18} {len(expected_lost)} definition(s) unreachable")

    if failures:
        print("\nFAILED:")
        for f in failures:
            print("  " + f)
        return 1
    print(f"\n{len(cases)} regression cases verified against saved upstream pages.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("sample")
    p.add_argument("--stratum", choices=["lemma", "inflected", "all"], default="lemma")
    p.add_argument("--size", type=int, default=400)
    p.add_argument("--seed", type=int, default=11)
    p.add_argument("--out", required=True)
    p.set_defaults(func=cmd_sample)

    p = sub.add_parser("fetch")
    p.add_argument("--sample")
    p.add_argument("words", nargs="*")
    p.set_defaults(func=cmd_fetch)

    p = sub.add_parser("classify")
    p.add_argument("--sample", required=True)
    p.add_argument("--out", required=True)
    p.set_defaults(func=cmd_classify)

    p = sub.add_parser("regressions")
    p.add_argument("words", nargs="+")
    p.add_argument("--out", required=True)
    p.set_defaults(func=cmd_regressions)

    p = sub.add_parser("verify")
    p.add_argument("--cases", default=str(REPO / "fixtures" / "definition-loss-regressions.json"))
    p.set_defaults(func=cmd_verify)

    args = parser.parse_args()
    return args.func(args) or 0


if __name__ == "__main__":
    sys.exit(main())
