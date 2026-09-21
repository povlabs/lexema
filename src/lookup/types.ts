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

export interface Sense {
  index: number;
  /** The sense itself, as a pointer: `/senses/0`. */
  ref: SourceRef;
  /**
   * Copied source text, never a Lexema definition. May be empty: 667 senses
   * carry no gloss at all, and a non-empty gloss is still not proof of a usable
   * one — `casa` has two that say nothing.
   */
  glosses: { text: string; ref: SourceRef }[];
  /** The source's own vocabulary: 'figuratively', 'form-of', 'scuola'. */
  labels: { kind: "tag" | "raw_tag"; label: string; ref: SourceRef }[];
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
 * A declared "this word is a form of that word" link. The source names a word,
 * and a word can be several records, so the resolved case carries every
 * candidate and never a winner; an edge resolving to nothing stays visible.
 */
export type LemmaLink =
  | { kind: "dangling"; targetWord: string; ref: SourceRef }
  | { kind: "candidates"; targetWord: string; candidates: LemmaCandidate[]; ref: SourceRef };

/**
 * A record that declares itself a form of a word this record spells — the
 * reverse direction of `LemmaLink`, and ambiguous in exactly the same way. The
 * edge names a *word*, so this record is only one candidate target among
 * several, and the candidate set travels with the link.
 */
export interface InflectionOf {
  /** The declaring record — the inflected one. */
  recordId: number;
  word: string;
  pos: string;
  /** The edge on the declaring record. */
  ref: SourceRef;
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
  /** Lemma links this record declares. */
  lemmaLinks: LemmaLink[];
  /** Records declaring themselves forms of this one. */
  inflections: InflectionOf[];
  /** Review verdicts on this record's claims. Empty until #12 writes any. */
  reviews: Review[];
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

export interface ReleaseInfo {
  releaseId: string;
  normalizer: string;
  sourceUrl: string | null;
  retrievedAt: string | null;
  license: string | null;
  attribution: string | null;
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
   * Every reading the source supports, in source order. Nothing is ranked away
   * and nothing is merged on matching spelling: `sale` is three records and
   * stays three.
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
