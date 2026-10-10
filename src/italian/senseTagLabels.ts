// The Italian label behind each English sense tag the extraction writes (#799).
//
// Wiktextract reads a definition line's usage label — `{{Term|antico|it}}`,
// `{{Fig}}`, `{{Glossa|raro}}` — and stores it on the sense as an English tag:
// `bellare`'s one sense says `tags: ["archaic"]` where the page writes
// `{{Term|antico|it}}`. The word page is Italian (ADR 0015, amended on #791),
// so it shows the label the page wrote, not the tag.
//
// Each row is the one Italian label wiktextract's Italian extractor reads as
// that tag (`TERM_TEMPLATE_TAGS`, `GLOSS_LIST_TEMPLATE_TAGS` and `OTHER_TAGS`
// in wiktextract's extractor/it/tags.py), checked against the release: for
// every Italian sense of it-0c432803 carrying the tag whose record lines up
// with its section's `#` lines in the 2026-07-01 dump, the line's label
// template prints that label. `pejorative` is the one tag two labels map to in
// the extractor (`peggiorativo`, `spregiativo`); every line of the release
// that carries it writes `{{Spreg}}` or `{{Term|spregiativo|it}}`, so it reads
// `spregiativo`. `{{Fig}}` prints `senso figurato` (Template:Fig, read
// 2026-10-10), and `{{Spec pl}}` gives two tags, `especially` and `in-plural`,
// for its one label.
//
// A tag with no row is shown as stored (ADR 0015: a value with no Italian label
// in Lexema's table is never translated on the fly). `form-of` and `no-gloss`
// are the extraction's marks, not a label the page wrote, and show nothing.

export const SENSE_TAG_LABEL_RULE = "it-sense-tag-label/v1" as const;

/** The label each tag stands for, as the page's label template prints it. */
const LABEL_OF_TAG: Readonly<Record<string, string>> = {
  archaic: "antico", // {{Term|antico|it}}, {{Glossa|antico}}
  augmentative: "accrescitivo", // {{Accr}}
  broadly: "per estensione", // {{Est}}, {{Term|per estensione|it}}
  colloquial: "colloquiale", // {{Term|colloquiale|it}}, {{Glossa|colloquiale}}
  diminutive: "diminutivo", // {{Dim}}
  especially: "specialmente al plurale", // {{Spec pl}}, {{Glossa|specialmente al plurale}}, with in-plural
  figuratively: "senso figurato", // {{Fig}}, {{Term|senso figurato|it}}
  formal: "formale", // {{Term|formale|it}}
  informal: "informale", // {{Term|informale|it}}
  "in-plural": "specialmente al plurale", // {{Spec pl}}, with especially
  literally: "letteralmente", // {{Lett}}, {{Term|letteralmente|it}}
  literary: "letterario", // {{Term|letterario|it}}, {{Glossa|letterario}}
  masculine: "maschile", // {{glossa|maschile}}
  neologism: "neologismo", // {{Term|neologismo|it}}
  obsolete: "obsoleto", // {{Term|obsoleto|it}}, {{Obs}}, {{Glossa|obsoleto}}
  offensive: "offensivo", // {{Term|offensivo|it}}
  pejorative: "spregiativo", // {{Spreg}}, {{Term|spregiativo|it}}
  person: "riferito solo a persone", // {{Pers}}
  rare: "raro", // {{Term|raro|it}}, {{Glossa|raro}}
  regional: "regionale", // {{Term|regionale|it}}, {{Glossa|regionale}}
  slang: "gergale", // {{Term|gergale|it}}
  toponymic: "toponimo", // {{Term|toponimo|it}}
  vulgar: "volgare", // {{Term|volgare|it}}, {{Vulg}}
};

/** The extraction's own marks on a sense, which no template printed. */
const MARKS: ReadonlySet<string> = new Set(["form-of", "no-gloss"]);

/** One label as the database stores it: an extraction tag, or a `raw_tags` entry, which is the page's own words. */
export interface StoredSenseLabel {
  kind: "tag" | "raw_tag";
  label: string;
}

/**
 * A sense's labels as the page wrote them, in stored order: each tag as its
 * Italian label, each `raw_tags` entry as it is, and the extraction's marks
 * left out. Two tags read from one template are its one label
 * (`especially` and `in-plural` are one `specialmente al plurale`); the
 * `raw_tags` entries stay exactly as stored.
 */
export function italianSenseLabels(labels: readonly StoredSenseLabel[]): string[] {
  const fromTags = new Set<string>();
  return labels.flatMap(({ kind, label }) => {
    if (kind === "raw_tag") return [label];
    if (MARKS.has(label)) return [];
    const italian = Object.hasOwn(LABEL_OF_TAG, label) ? LABEL_OF_TAG[label] : label;
    if (fromTags.has(italian)) return [];
    fromTags.add(italian);
    return [italian];
  });
}
