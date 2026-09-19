// The shape a lookup returns. Written so the states that matter cannot be
// confused with one another — each gets its own case rather than sharing a
// nullable field. The reasoning is in docs/LOOKUP_DESIGN.md.

/** Where a value came from, precise enough to check it against the archive. */
export interface SourceRef {
  /** Line number in the release's .jsonl.gz, 1-based. */
  lineNo: number;
  /** JSON Pointer into that line. */
  pointer: string;
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
  pointer: string;
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

export interface Sense {
  index: number;
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
  lineNo: number;
  word: string;
  pos: string;
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
  lineNo: number;
  word: string;
  pos: string;
  /** Pointer to the edge on the declaring record. */
  pointer: string;
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
  pointer: string;
  status: "disputed" | "corroborated";
  note: string;
  evidenceUrl: string;
  reviewedAt: string;
  reviewedBy: string;
}

/** One source record that matched the query. */
export interface Reading {
  recordId: number;
  lineNo: number;
  /** The record's own headword, verbatim. */
  word: string;
  pos: string;
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
  grammar: Grammar;
  /** Lemma links this record declares. */
  lemmaLinks: LemmaLink[];
  /** Records declaring themselves forms of this one. */
  inflections: InflectionOf[];
  /** Review verdicts on this record's claims. Empty until #12 writes any. */
  reviews: Review[];
}

export interface ReleaseInfo {
  releaseId: string;
  normalizer: string;
  sourceUrl: string | null;
  retrievedAt: string | null;
  license: string | null;
  attribution: string | null;
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
 * The index was probed. `found` and `not-found` carry the same shape on
 * purpose: a page showing nothing still needs the release, so it can attribute
 * the source even when it has no reading to display.
 */
export interface SearchResult {
  outcome: "found" | "not-found";
  query: {
    /** Exactly what the caller passed, kept so the page can echo it back. */
    raw: string;
    /** The normalized search key the index was probed with. */
    key: string;
    normalizer: string;
  };
  release: ReleaseInfo;
  /**
   * Every reading the source supports, in source order. Nothing is ranked away
   * and nothing is merged on matching spelling: `sale` is three records and
   * stays three.
   */
  readings: Reading[];
}

export type LookupResult = RejectedResult | SearchResult;
