// The verb-type parts a Verbo section can be split into, and how a page and an
// archive record each name them (#775).
//
// Italian Wiktionary splits one verb section with the templates of
// `Categoria:Template per i verbi`: `{{Transitivo|it}}` prints a level-4
// heading, `====[[transitivo|Transitivo]]====`, and the lines after it, up to
// the next such template, are the transitive part. Wiktextract makes one record
// of each part and tags it with the part's type (`urgere`, archive lines 43705
// `intransitive` and 43706 `transitive`).

/** A verb-type part, by the word its template's heading links to. */
export type VerbType = "transitivo" | "intransitivo" | "riflessivo" | "reciproco";

/**
 * The tag Wiktextract gives the record of each part. Read off every Italian
 * archive line of it-0c432803 on 2026-10-09: `Verbo` records carry
 * `transitive` 4,514 times, `intransitive` 1,950, `reflexive` 352 and
 * `reciprocal` 2.
 */
const TAG_OF: Readonly<Record<VerbType, string>> = {
  transitivo: "transitive",
  intransitivo: "intransitive",
  riflessivo: "reflexive",
  reciproco: "reciprocal",
};

const VERB_TYPES = Object.keys(TAG_OF) as VerbType[];

/** The verb types a record's `tags` name, in `VerbType` order. A tag that is not a string names none. */
export function verbTypesTagged(tags: unknown): VerbType[] {
  if (!Array.isArray(tags)) return [];
  return VERB_TYPES.filter((type) => tags.includes(TAG_OF[type]));
}

/**
 * `{{Transitivo|it}}`, `{{Intransitivo|it}}`, `{{Riflessivo|it}}` or
 * `{{Reciproco|it}}` at the start of a line, alone or leading its words
 * (`urgere`: `{{Intransitivo|it}} occorrere nell'immediato…`). MediaWiki reads a
 * template name's first letter in either case, and the dump writes
 * `{{riflessivo|it}}` four times.
 */
const OPENS_PART = /^\{\{\s*([Tt]ransitivo|[Ii]ntransitivo|[Rr]iflessivo|[Rr]eciproco)\s*\|\s*it\s*\}\}/;

/** The part a line opens, when it opens one. A list line (`# {{Transitivo|it}} …`) opens none. */
export function verbTypeOpenedBy(line: string): VerbType | undefined {
  const name = OPENS_PART.exec(line.trim())?.[1];
  return name === undefined ? undefined : (name.toLowerCase() as VerbType);
}
