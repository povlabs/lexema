// The shape a lookup returns. Written so the states that matter cannot be
// confused with one another — each gets its own case rather than sharing a
// nullable field. The reasoning is in docs/LOOKUP_DESIGN.md.

import type { ArticleDisplay } from "../core/types.js";

/** One article as `it-articles/v1` produced it, re-exported for the page. */
export type { ArticleDisplay };

/**
 * Where a value came from, precise enough to check it against the archive. These
 * are the four coordinates the schema names `release_id`, `line_no`,
 * `json_pointer` and `line_sha256` (`.glossary/TERMS.md`), in camelCase: the
 * release that pins the bytes, the physical line inside it, the pointer to the
 * field, and the line's digest. Line numbers only mean
 * something inside one release, so the release travels with every one of them
 * (docs/RECORD_IDENTITY.md#identity).
 */
export interface SourceRef {
  /** The release whose archive these coordinates are in. */
  releaseId: string;
  /** Line number in that release's .jsonl.gz, 1-based. */
  lineNo: number;
  /** JSON Pointer into that line. `""` is the whole record. */
  jsonPointer: string;
  /** sha256 of the raw line bytes, so the claim can be checked against R2. */
  lineSha256: string;
}

/** One occurrence of the searched surface on one record. */
export interface Evidence {
  /**
   * 'headword'      — this record IS about the surface.
   * 'embedded-form' — it merely lists the surface in a table. It may or may not
   *                   be the base word; `studentessa` lists `studenti`.
   */
  origin: "headword" | "embedded-form";
  /** Verbatim source spelling, which can differ from what was typed. */
  surface: string;
  /** The exact field this occurrence was read from. */
  ref: SourceRef;
  /** The conjugation table an embedded form came from, when the source names one. */
  formSource: string | null;
}

/**
 * Grammar, with the source's silence distinguished from its speech. A dimension
 * with no claim at all was never expected here — different again from
 * `missing`, which means we looked and the source said nothing.
 */
export type GrammarClaim =
  | { status: "stated"; dimension: string; value: string; sourceText: string; ref: SourceRef }
  | { status: "unclassified"; sourceText: string; ref: SourceRef }
  | { status: "missing"; dimension: string; ref: SourceRef };

/** Grammar claims, split by what they are about. */
export interface Grammar {
  /** About the record itself. */
  record: GrammarClaim[];
  /** About one `forms[]` entry, keyed by its index. */
  byForm: Map<number, GrammarClaim[]>;
  /** About one sense, keyed by its index. */
  bySense: Map<number, GrammarClaim[]>;
}

/**
 * One `forms[]` entry of a record, as the source spells it.
 *
 * The entry is evidence of what the source listed, never a claim that this
 * record is the base word: `studentessa` lists `studenti`. What the source said
 * *about* the entry is in `claims`, which is the same list `grammar.byForm`
 * holds under `index`.
 */
export interface SourceForm {
  /** Index into the record's `forms[]`, which is the index in the pointer. */
  index: number;
  /** Verbatim source spelling, never cleaned. */
  surface: string;
  /** The entry this was read from: `/forms/3/form`. */
  ref: SourceRef;
  /** The conjugation table the source names for this entry, when it names one. */
  formSource: string | null;
  /** Grammar the source states about this entry, and the silences it left. */
  claims: GrammarClaim[];
}

/** A string the source wrote, verbatim, and the field it was read from. */
export interface SourceText {
  text: string;
  ref: SourceRef;
}

/** One `sounds[].ipa`, with the qualifier the source wrote beside it, if any. */
export interface Pronunciation {
  ipa: string;
  /** The source's own `sense` on the sound: `italiano standard`. */
  note: string | null;
  ref: SourceRef;
}

/** One `hyphenations[].parts`, never empty. */
export interface Hyphenation {
  parts: [string, ...string[]];
  ref: SourceRef;
}

/**
 * One spelling from a synonym, antonym or derived-word list. The source can
 * list a spelling more than once, so every entry that spelled it keeps its
 * pointer, and a count that disagrees with its pointers is not representable.
 */
export interface RelatedWord {
  word: string;
  refs: [SourceRef, ...SourceRef[]];
}

/**
 * One `synonyms[]` entry exactly as the source lists it, before spellings are
 * collapsed: its word, its `raw_tags`, and where it sits. Position matters —
 * in 207 headwords of release `it-0c432803` a part-of-speech label such as
 * `sostantivo` on one entry opens a group that runs to the next label.
 */
export interface SynonymEntry {
  word: string;
  rawTags: string[];
  ref: SourceRef;
}

/**
 * What the source says about the *headword* rather than about one record of
 * it: read from `source_record_json`, where it is repeated on each record the
 * headword has. A page shows it once per word, not once per reading.
 */
export interface WordFacts {
  pronunciations: Pronunciation[];
  hyphenations: Hyphenation[];
  etymologies: SourceText[];
  synonyms: RelatedWord[];
  /** The same synonyms uncollapsed, in source order, each with its `raw_tags`. */
  synonymList: SynonymEntry[];
  antonyms: RelatedWord[];
  derived: RelatedWord[];
}

export interface Sense {
  index: number;
  /** The sense itself, as a pointer: `/senses/0`. */
  ref: SourceRef;
  /** `senses[].examples[].text`, verbatim and in source order. */
  examples: SourceText[];
  /**
   * Copied source text, never a Lexema definition. May be empty: 667 senses
   * carry no gloss at all, and a non-empty gloss is still not proof of a usable
   * one — `casa` has two that say nothing.
   */
  glosses: { text: string; ref: SourceRef }[];
  /** The source's own vocabulary: 'figuratively', 'form-of', 'scuola'. */
  labels: { kind: "tag" | "raw_tag"; label: string; ref: SourceRef }[];
  /**
   * The recovered items of the list this sense opens with a closing colon, in
   * page order (#123): `accollato`'s `attributo araldico che si applica a:`
   * and the `#*` lines below it. They come from the raw page, not the record,
   * and carry their own refs. Empty for nearly every sense.
   */
  recoveredItems: RecoveredDefinition[];
}

/**
 * Where a recovered value was read: one line of one revision of a raw
 * Wiktionary page. It is a different source from the archive, so it is a
 * different ref from `SourceRef`, and a page can tell the two apart by type.
 */
export interface RecoveredRef {
  wiki: string;
  title: string;
  revisionId: number;
  /** 1-based line in the revision's wikitext. */
  line: number;
}

/** The permanent URL of the page revision a recovered ref names. */
export function recoveredRevisionUrl(ref: RecoveredRef): string {
  return `https://${ref.wiki}/w/index.php?title=${encodeURIComponent(ref.title)}&oldid=${ref.revisionId}`;
}

/** A usage sentence the raw page attaches to a recovered definition. */
export interface RecoveredExample {
  text: string;
  ref: RecoveredRef;
}

/** Which page structure marked the line a definition (`src/italian/wikitext.ts`). */
export type RecoveredRoute =
  | { route: "below-page-control" }
  | { route: "sub-term"; term: string }
  | { route: "lead-in-item" };

/**
 * A definition the raw page states and the extraction dropped (#28), read back
 * from the page. It sits beside the record's senses, never inside them: the
 * record stays as imported, and this carries its own ref.
 */
export type RecoveredDefinition = RecoveredRoute & {
  /** Wiktionary's own words, templates printed, links as their labels. */
  text: string;
  /** Usage labels the line's templates print: `architettura`, `figurato`. */
  labels: string[];
  ref: RecoveredRef;
  examples: RecoveredExample[];
  /**
   * The record's example that carries this text, when the record files it as
   * an example rather than a definition (`lap steel guitar`). A page shows the
   * text once, as this definition, and not again as that example.
   */
  heldAsExample: SourceRef | null;
  /** The recovered items of the list it opens with a closing colon, in page order (#123). */
  items: RecoveredDefinition[];
};

/**
 * Every recovered definition on a reading, in page order: the ones at the top
 * of the list, and the items nested under a sense or under another recovered
 * definition.
 */
export function everyRecovered(reading: Pick<Reading, "senses" | "recovered">): RecoveredDefinition[] {
  const withItems = (definition: RecoveredDefinition): RecoveredDefinition[] => [definition, ...definition.items.flatMap(withItems)];
  return [...reading.senses.flatMap((sense) => sense.recoveredItems), ...reading.recovered]
    .flatMap(withItems)
    .sort((a, b) => a.ref.line - b.ref.line);
}

/** A record the source names as the target of a form_of edge. */
export interface LemmaCandidate {
  recordId: number;
  word: string;
  pos: string;
  /** The candidate's own headword field, where `word` was read from. */
  ref: SourceRef;
}

/**
 * Where a lemma's own table spells the searched surface: `andare`'s `forms[]`,
 * with `andavano` at `/forms/16`, for a search of `andavano`.
 *
 * It is the part of the lemma a form reading needs to place itself — the row
 * that says which person, number and tense the form is, and the table it sits
 * in — and nothing else of the lemma: its senses and word-level facts are on
 * its own page.
 */
export interface LemmaListing {
  /** The lemma's whole `forms[]`, in source order. */
  forms: SourceForm[];
  /** The entries of `forms` the query hit, in source order. Never empty. */
  evidence: [Evidence, ...Evidence[]];
}

/**
 * One record a reading's lemma link resolves to, as this lookup found it.
 *
 * A lemma whose own table lists the searched surface matches the query too,
 * but it is not returned as a reading of its own: it is the lemma of the
 * reading that points to it, and it arrives here. `listing` is where its table
 * spells the query, and is absent when its table does not — `sala` the verb
 * record, for `sale`, lists no `sale`.
 */
export interface LemmaTarget extends LemmaCandidate {
  listing: LemmaListing | undefined;
}

/**
 * A declared "this word is a form of that word" link: the reading's lemma. The
 * source names a word, and a word can be several records, so the resolved case
 * carries every candidate and never a winner; an edge resolving to nothing
 * stays visible.
 */
export type LemmaLink =
  | { kind: "dangling"; targetWord: string; ref: SourceRef }
  | { kind: "candidates"; targetWord: string; candidates: LemmaTarget[]; ref: SourceRef };

/**
 * A record that declares itself a form of a word this record spells — the
 * reverse direction of `LemmaLink`, and ambiguous in exactly the same way. The
 * edge names a *word*, so this record is only one candidate target among
 * several, and the candidate set travels with the link.
 *
 * One of these is one *record*, not one edge. A record can say the same thing
 * on several of its senses — `casetta` declares itself a form of `casa` on two
 * of them — and a reader is owed that record once, with how many senses said
 * it. The count is `refs.length` rather than a field beside it, so a count that
 * disagrees with the pointers behind it is not a value this type can hold.
 */
export interface InflectionOf {
  /** The declaring record — the inflected one. */
  recordId: number;
  word: string;
  pos: string;
  /** Every edge on the declaring record that lands here, in source order. */
  refs: [SourceRef, ...SourceRef[]];
  /** The word the edge names, verbatim. */
  targetWord: string;
  /**
   * Every headword record `targetWord` resolves to, in source order. The
   * reading carrying this link is always one of them. More than one means the
   * source did not pick, and a caller must not present this reading as *the*
   * lemma of `word`.
   */
  targetCandidates: LemmaCandidate[];
}

/**
 * A review verdict on one claim. Review never edits the source: a disputed
 * claim stays visible with its dispute attached.
 */
export interface Review {
  /** The claim under review, not the whole record. */
  ref: SourceRef;
  status: "disputed" | "corroborated";
  note: string;
  evidenceUrl: string;
  reviewedAt: string;
  reviewedBy: string;
}

/**
 * Why no article is shown, named precisely enough to say it in a sentence.
 *
 * Each case is the *first* thing that stopped the rule, so at most one is ever
 * true at a time: a surface the rule refuses can only be reported once gender
 * and number were both usable, because `generateItalianArticles` checks them
 * first (`src/italian/articles.ts`).
 */
export type ArticleWithholding =
  | { reason: "no-gender-or-number-stated" }
  | { reason: "gender-not-stated" }
  | { reason: "number-not-stated" }
  | { reason: "gender-is-not-masculine-or-feminine"; statedGender: string }
  | { reason: "number-is-not-singular-or-plural"; statedNumber: string }
  | { reason: "surface-not-handled"; surface: string };

/**
 * The articles Lexema derived for a noun reading, or the reason it derived none.
 *
 * Two states, never one list that means two things: a derived set is a non-empty
 * tuple, and a withholding carries its reason. There is no case for "not a
 * noun", because only a noun reading carries this field at all.
 */
export type ReadingArticles =
  | { status: "derived"; articles: [ArticleDisplay, ...ArticleDisplay[]] }
  | { status: "withheld"; withholding: ArticleWithholding };

declare const nonNounPos: unique symbol;

/**
 * A part of speech the source stated that is not `noun`.
 *
 * No string literal is assignable to the brand, so an `OtherReading` cannot be
 * written with a `pos` of `"noun"` — which is what stops a noun reading arriving
 * without the articles every noun reading has. `readingPartOfSpeech`
 * (`src/lookup/articles.ts`) is the one place that mints one, on the branch that
 * has just proved the part of speech is not `noun`.
 */
export type NonNounPos = string & { readonly [nonNounPos]: true };

/** What every reading carries, whatever part of speech it is. */
interface ReadingFacts {
  recordId: number;
  /** The whole record, as a pointer: every ref below shares its line. */
  ref: SourceRef;
  /** The record's own headword, verbatim. */
  word: string;
  posTitle: string;
  /** The headword-level fields this record's archive line carries. */
  wordFacts: WordFacts;

  /**
   * True when at least one piece of evidence is a headword hit — that is, when
   * this record is *about* the searched surface rather than merely listing it.
   * A caller must not present `word` as the lemma of the query when this is
   * false.
   */
  isAboutQuery: boolean;

  /** Every occurrence of the surface on this record, in source order. */
  evidence: Evidence[];

  senses: Sense[];
  /**
   * Every `forms[]` entry this record carries, in source order. Empty when the
   * source listed none — which is a fact about the source, not a gap to fill.
   */
  forms: SourceForm[];
  grammar: Grammar;
  /**
   * The lemma this record declares it is a form of, one link per `form_of`
   * edge. A lemma the query also matched through its table is here, with its
   * `listing`, rather than in the result's `readings`.
   */
  lemmaLinks: LemmaLink[];
  /** Records declaring themselves forms of this one. */
  inflections: InflectionOf[];
  /** Review verdicts on this record's claims. Empty until #12 writes any. */
  reviews: Review[];
  /**
   * Definitions the raw page states that the record does not carry, in page
   * order. Empty for nearly every record, and for every record whose raw page
   * this release did not read. An item of a list a definition opens with a
   * colon is not here but under that definition, in a sense's
   * `recoveredItems` or a recovered definition's `items`, when recovery
   * matched the definition; when it did not, the item is here.
   */
  recovered: RecoveredDefinition[];
}

interface NounPartOfSpeech {
  pos: "noun";
  /**
   * Articles for this reading, derived by `it-articles/v1` from the gender and
   * number the source states — or the reason there are none. Nothing here comes
   * from the release: the source carries no article field at all.
   */
  articles: ReadingArticles;
}

interface OtherPartOfSpeech {
  pos: NonNounPos;
  articles?: never;
}

/** The part of a reading that follows from its part of speech, and nothing else. */
export type ReadingPartOfSpeech = NounPartOfSpeech | OtherPartOfSpeech;

/** A record the source states is a noun. Articles are a noun fact, so it has them. */
export type NounReading = ReadingFacts & NounPartOfSpeech;

/** A record of any other part of speech. Lexema derives no article for one. */
export type OtherReading = ReadingFacts & OtherPartOfSpeech;

/** One source record that matched the query. */
export type Reading = NounReading | OtherReading;

/**
 * Whether this reading is a noun — and so whether it carries articles.
 *
 * The brand on `NonNounPos` is not a unit type, so `reading.pos === "noun"`
 * written at a call site narrows nothing on its own. This is where that
 * comparison lives, once, with the narrowing attached to it.
 */
export function isNounReading(reading: Reading): reading is NounReading {
  return reading.pos === "noun";
}

/**
 * Whether this reading is an adjective — which is the card the page picks for
 * it (#52), and nothing else.
 *
 * It narrows to `OtherReading` because that is all the part of speech settles
 * here: an adjective is not a noun, so it carries no articles. The comparison
 * lives beside `isNounReading` for the same reason that one does — the brand on
 * `NonNounPos` is not a unit type, so a bare `reading.pos === "adj"` written at
 * a call site narrows nothing.
 */
export function isAdjectiveReading(reading: Reading): reading is OtherReading {
  return (reading.pos as string) === "adj";
}

/**
 * Whether this reading is a verb — which is the card the page picks for it
 * (#48), and nothing else.
 *
 * It narrows to `OtherReading` for the reason `isAdjectiveReading` does: a verb
 * is not a noun, so it carries no articles, and the brand on `NonNounPos` is
 * not a unit type, so a bare `reading.pos === "verb"` written at a call site
 * narrows nothing.
 */
export function isVerbReading(reading: Reading): reading is OtherReading {
  return (reading.pos as string) === "verb";
}

/**
 * Whether this reading is the query's own form-of record: a record about the
 * searched surface that declares itself a form of some other word (#49).
 *
 * Two facts read together, and neither alone is this one. `isAboutQuery` says
 * the record is about the word that was typed rather than a record that merely
 * lists it, and a `lemmaLinks` entry is the source's own `form_of` edge — so
 * `vado`'s `Voce verbale` record passes and `andare`'s own verb record, which
 * lists `vado` in its table and declares itself a form of nothing, does not.
 *
 * No spelling is compared and no gloss is read: the two fields the lookup
 * already filled are the whole test, which is why it lives here rather than
 * being re-derived at the page that orders on it.
 */
export function isFormOfReading(reading: Reading): boolean {
  return reading.isAboutQuery && reading.lemmaLinks.length > 0;
}

/**
 * Every spelling on this reading the query actually hit, in the two shapes a
 * record spells a word in: its own headword, and its `forms[]` entries.
 *
 * The two come off the same evidence list, split by the kind each occurrence
 * carries. An `embedded-form` occurrence is the surface inside this record's
 * table, and its `ref.jsonPointer` is the same pointer the matching
 * `SourceForm` carries — both read from one `lookup_form` row
 * (`src/db/schema.sql`, view `surface_hit`), so a page marks a form by pointer
 * rather than by spelling: no normalizing, no case guessing, and no risk of
 * outlining a spelling the index never matched. A `headword` occurrence has no
 * `forms[]` entry to point at — its ref is `/word` — so it is its own flag, and
 * a record whose headword is the query is marked where that headword sits.
 */
export interface SearchedSpellings {
  /** True when the query hit this record's own headword. */
  readonly headword: boolean;
  /** The `ref.jsonPointer` of every `forms[]` entry the query hit. */
  readonly formPointers: ReadonlySet<string>;
}

/**
 * Read {@link SearchedSpellings} off a reading's own evidence (#49), or off a
 * lemma's {@link LemmaListing}, which carries evidence of the same kind.
 */
export function searchedSpellings(hit: { readonly evidence: readonly Evidence[] }): SearchedSpellings {
  return {
    headword: hit.evidence.some((occurrence) => occurrence.origin === "headword"),
    formPointers: new Set(
      hit.evidence
        .filter((occurrence) => occurrence.origin === "embedded-form")
        .map((occurrence) => occurrence.ref.jsonPointer),
    ),
  };
}

/**
 * Which imported file a page is answering from.
 *
 * Four of these columns are nullable in the schema, and a reader is told so in
 * words rather than shown a blank: `null` here means the import did not know
 * the value, never that it is empty. `archiveSha256` is the one identity the
 * schema requires, so it is the one field that is always a string.
 */
export interface ReleaseInfo {
  releaseId: string;
  normalizer: string;
  sourceUrl: string | null;
  retrievedAt: string | null;
  /** SHA-256 of the compressed archive these bytes came from. */
  archiveSha256: string;
  /** The Wiktionary dump the archive was extracted from, when the import knew it. */
  dump: ReleaseDump | null;
  license: string | null;
  attribution: string | null;
}

/**
 * The Wiktionary dump a release was extracted from. `inferred` is a dump
 * kaikki's build did not name and the import reasoned to; the reasoning is in
 * src/source/archiveFacts.ts, not in the database.
 */
export interface ReleaseDump {
  /** The Wikimedia dump id, e.g. `itwiktionary-20260701`. */
  id: string;
  /** The dump's date, `YYYY-MM-DD`, which its id spells. */
  date: string;
  /** The dump's public page at Wikimedia, which its id also spells. */
  url: string;
  basis: "recorded" | "inferred";
}

/** What the caller asked and what the index was actually probed with. */
export interface QueryInfo {
  /** Exactly what the caller passed, kept so the page can echo it back. */
  raw: string;
  /** The normalized search key the index was probed with. */
  key: string;
  normalizer: string;
}

/** Why a query returned nothing to search for. */
export type RejectedQuery =
  | { reason: "empty" }
  | { reason: "too-long"; length: number; limit: number };

/** The query never reached the index, and why. */
export interface RejectedResult {
  outcome: "rejected";
  query: { raw: string };
  rejection: RejectedQuery;
}

/**
 * The index was probed and at least one record matched. The readings are a
 * non-empty tuple, so `found` with nothing found is not a state this type can
 * express.
 */
export interface FoundResult {
  outcome: "found";
  query: QueryInfo;
  release: ReleaseInfo;
  /**
   * Every record the query matches, in source order. Nothing is ranked away
   * and nothing is merged on matching spelling: `sale` is three records and
   * stays three.
   *
   * A record that matched only through its table, and that a reading about
   * the query names as its lemma, is not one of these: it is that reading's
   * lemma, in `lemmaLinks`. `sala` and `salire` list `sale`, and `sale`'s
   * readings point to them, so they are navigation from `sale`, not readings
   * of it. A record that lists the query and is nobody's lemma here — `bella`
   * for `bello` — stays a reading.
   */
  readings: [Reading, ...Reading[]];
}

/**
 * The index was probed and nothing matched. There is no reading a `not-found`
 * can hold, so `not-found` with readings is not a state this type can express
 * either. `release` is still here: a page showing nothing has to
 * attribute the source it found nothing in.
 */
export interface NotFoundResult {
  outcome: "not-found";
  query: QueryInfo;
  release: ReleaseInfo;
  /**
   * Declared as `never` rather than left out. Omitting it only stops a fresh
   * object literal; a value built elsewhere and carrying `readings` would still
   * be assignable under structural typing. With this field there is no reading
   * any `not-found` can hold, whatever it was built from.
   */
  readings?: never;
}

/** The index was probed, either way. */
export type SearchResult = FoundResult | NotFoundResult;

export type LookupResult = RejectedResult | SearchResult;
