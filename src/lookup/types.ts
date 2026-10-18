// The shape a lookup returns. Written so the states that matter cannot be
// confused with one another — each gets its own case rather than sharing a
// nullable field. The reasoning is in docs/LOOKUP_DESIGN.md.

import type { ArticleDisplay } from "../core/types.js";
import type { SurfaceWithholding } from "../italian/articles.js";
import type { PronominalPair } from "../italian/pronominalPair.js";
import type { ShapedSpelling } from "../italian/wordShape.js";
import type { AgreeingSpelling } from "../italian/essereAgreement.js";
import type { PhraseGloss } from "../italian/phrase.js";
import type { VerbFormGloss } from "../italian/verbFormGloss.js";

/** One article as `it-articles/v3` produced it, re-exported for the page. */
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

/**
 * One occurrence of the searched surface on one reading: a field of an
 * archive line, or a Wikidata word's lemma or one of its forms (#851).
 */
export type Evidence = ArchiveEvidence | LexemeEvidence;

/**
 * One occurrence of the searched surface on a Wikidata word (ADR 0033, #851):
 * its lemma, pointed at by its lexeme, or one of its forms, pointed at by the
 * form's id. A lexeme names no conjugation table.
 */
export type LexemeEvidence =
  | { origin: "headword"; surface: string; ref: LexemeRef; formSource: null }
  | { origin: "embedded-form"; surface: string; ref: LexemeFormRef; formSource: null };

/** One occurrence of the searched surface on one record. */
export interface ArchiveEvidence {
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
  | { status: "stated"; dimension: string; value: string; sourceText: string; ref: FactRef }
  | { status: "unclassified"; sourceText: string; ref: FactRef }
  | { status: "missing"; dimension: string; ref: FactRef };

/** A claim read off an archive line, which is every claim but a page-only entry's (ADR 0026). */
export type ArchiveClaim = GrammarClaim & { ref: SourceRef };

/** A claim the source states, with its value. */
export type StatedClaim = Extract<GrammarClaim, { status: "stated" }>;

/** Where a corrected claim or definition came from: an entry of the curated list and the revision it cites. */
export interface CorrectionRef {
  /**
   * The list entry (src/italian/curatedCorrections.ts): a record's by release
   * and archive line, `it-0c432803:449969`; a definition's by page revision and
   * place, `page:3906191:0`.
   */
  id: string;
  /** A permanent link to the Wiktionary revision that settles the fact. */
  evidenceUrl: string;
}

/**
 * A fact the source states wrongly, set right by a curated correction (#420):
 * `fissazione` is tagged masculine and is feminine. It stands in for every
 * claim the record states in its dimension, which it keeps as `replaces`, so
 * the source's own words are never lost and never read as the fact. Only a
 * record's own gender or number is corrected this way, never a form's or a
 * sense's; a table cell's spelling is corrected as a `CorrectedSurface`.
 */
export interface CorrectedClaim {
  status: "corrected";
  dimension: "gender" | "number";
  value: string;
  correction: CorrectionRef;
  /** The record's own stated claims in this dimension, as imported; empty when it stated none. */
  replaces: StatedClaim[];
}

/** A claim about the record itself: the source's, or a correction standing in for it. */
export type RecordClaim = GrammarClaim | CorrectedClaim;

/** A claim that gives a value: the source's own statement, or a correction. */
export type AssertedClaim = StatedClaim | CorrectedClaim;

/** Whether `claim` gives a value for its dimension. */
export const asserts = (claim: RecordClaim): claim is AssertedClaim =>
  claim.status === "stated" || claim.status === "corrected";

/**
 * The record's claims as a reader is owed them: each corrected dimension's
 * correction in place of what the source stated or left missing there, and
 * every other claim as it was. Claims of the same dimension are never both a
 * correction and a statement, so nothing downstream has to pick between them.
 */
export function correctRecordClaims(claims: readonly GrammarClaim[], corrections: readonly Omit<CorrectedClaim, "status" | "replaces">[]): RecordClaim[] {
  if (corrections.length === 0) return [...claims];
  const corrected = new Set<string>(corrections.map((correction) => correction.dimension));
  const kept = claims.filter((claim) => claim.status === "unclassified" || !corrected.has(claim.dimension));
  return [
    ...kept,
    ...corrections.map((correction): CorrectedClaim => ({
      status: "corrected",
      ...correction,
      replaces: claims.filter((claim): claim is StatedClaim => claim.status === "stated" && claim.dimension === correction.dimension),
    })),
  ];
}

/** Grammar claims, split by what they are about. */
export interface Grammar {
  /** About the record itself, with any curated correction in place (`correctRecordClaims`). */
  record: RecordClaim[];
  /** About one `forms[]` entry, keyed by its index. */
  byForm: Map<number, GrammarClaim[]>;
  /** About one sense, keyed by its index. */
  bySense: Map<number, GrammarClaim[]>;
}

/**
 * A table cell the source spells wrongly, set right by a curated correction
 * (ADR 0030, #723): `assorbire`'s `siamo assorbito, assorti, assorti` reads
 * `siamo assorbiti, assorti`. It keeps the source's spelling, so the source's
 * words are never lost and never read as the cell.
 */
export interface CorrectedSurface {
  /** The source's spelling of the cell, verbatim. */
  replaces: string;
  correction: CorrectionRef;
}

/**
 * One `forms[]` entry of a record, as the source spells it, or as a curated
 * correction sets it right.
 *
 * The entry is evidence of what the source listed, never a claim that this
 * record is the base word: `studentessa` lists `studenti`. What the source said
 * *about* the entry is in `claims`, which is the same list `grammar.byForm`
 * holds under `index`.
 */
export interface SourceForm {
  /** Index into the record's `forms[]`, which is the index in the pointer. */
  index: number;
  /** Verbatim source spelling, never cleaned; a correction's spelling where `corrected` says so. */
  surface: string;
  /** The correction `surface` comes from, when one sets this cell right; absent for the source's own spelling. */
  corrected?: CorrectedSurface;
  /** The entry this was read from: `/forms/3/form`, or the page line that writes it out (ADR 0026). */
  ref: FactRef;
  /** The conjugation table the source names for this entry, when it names one. */
  formSource: string | null;
  /** Grammar the source states about this entry, and the silences it left. */
  claims: GrammarClaim[];
}

/** A form an adjective's table lacks, added by a curated correction (#836): its spelling, the gender and number it agrees in, and the correction. */
export interface AddedTableForm {
  surface: string;
  gender: "masculine" | "feminine";
  number: "singular" | "plural";
  correction: CorrectionRef;
}

/** A `forms[]` entry of the record that a curated correction takes off its table (#836): its place, its spelling as the source writes it, and the correction. */
export interface RemovedTableForm {
  index: number;
  surface: string;
  correction: CorrectionRef;
}

/**
 * A curated correction of an adjective's table (#836): the forms it adds and
 * the record's forms it removes. The record's `forms` stay as the source
 * lists them; the table a page draws reads this beside them.
 */
export interface FormCorrection {
  added: AddedTableForm[];
  removed: RemovedTableForm[];
}

/**
 * A form's own tags and raw tags, recovered from its claims by pointer. A
 * Wikidata word's form states only tags the closed vocabulary maps, so on it
 * an unclassified claim is a raw tag: the pronoun its row writes (#833).
 */
export function sourceTagsOf(form: SourceForm): { tags: string[]; rawTags: string[] } {
  if (isLexemeFormRef(form.ref)) {
    const said = form.claims.flatMap((claim) => (claim.status === "missing" ? [] : [claim]));
    return {
      tags: said.flatMap((claim) => (claim.status === "stated" ? [claim.sourceText] : [])),
      rawTags: said.flatMap((claim) => (claim.status === "unclassified" ? [claim.sourceText] : [])),
    };
  }
  return sourceTagsAt(
    form.claims.flatMap((claim) => (claim.status === "missing" ? [] : [{ pointer: sourcePointerOf(claim.ref), text: claim.sourceText }])),
  );
}

/**
 * `sourceTagsOf`, from a form's claims as the source wrote them: each one's
 * pointer and text, a `missing` claim already left out.
 */
export function sourceTagsAt(claims: Iterable<{ pointer: string | undefined; text: string }>): { tags: string[]; rawTags: string[] } {
  const tags: string[] = [];
  const rawTags: string[] = [];
  for (const { pointer, text } of claims) {
    // A form a raw page writes out states its tags and nothing else (src/italian/pageFacts.ts).
    if (pointer === undefined || /\/tags\/\d+$/.test(pointer)) tags.push(text);
    else if (/\/raw_tags\/\d+$/.test(pointer)) rawTags.push(text);
  }
  return { tags, rawTags };
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
  ref: FactRef;
}

/** One `hyphenations[].parts`, never empty and never only the missing-hyphenation placeholder (#255). */
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
  refs: [FactRef, ...FactRef[]];
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
  ref: FactRef;
}

/**
 * One `proverbs[]` item that gives a row: its phrase under the item rules of
 * src/italian/expressions.ts, and its `sense` verbatim when it has one.
 */
export interface ExpressionItem {
  phrase: string;
  meaning: string | null;
  /** The item: `/proverbs/3`, or the page line that lists it (ADR 0026). */
  ref: FactRef;
}

/**
 * One row of an *Expressions* list (#213): a phrase once, with every distinct
 * meaning the source gives it, in source order. The same phrase listed twice
 * with two meanings is one row (`pancia`'s "mettere su pancia"); listed twice
 * with one meaning, or on every record of a headword, it is still one row.
 * Every item it came from keeps its pointer.
 */
export interface Expression {
  phrase: string;
  /** Distinct, in source order; empty when no item gave one. */
  meanings: string[];
  /** Whether the phrase is itself an Italian headword, so a page links it to its entry. */
  hasEntry: boolean;
  refs: [FactRef, ...FactRef[]];
}

/**
 * One `translations[]` entry of a record (#739), as the source wrote it. The
 * source copies a page's whole translation table onto every record of that
 * page, so this is the record's list, not one meaning's: `sense` is the
 * source's own label for the meaning, a text and never a sense index.
 */
export interface Translation {
  /** The source's `lang_code`, never empty: `en`, `zh-min-nan`. */
  langCode: string;
  /** The source's `lang`, the language's Italian name: `inglese`. Null when the entry gives none. */
  langName: string | null;
  /** The translated word, never empty. */
  word: string;
  /** The source's `sense` label, verbatim: `automobile`. Null when the entry gives none. */
  sense: string | null;
  /** The entry: `/translations/3`. */
  ref: SourceRef;
}

/** A text the source wrote about the word, verbatim, and where it was read. */
export interface WordText {
  text: string;
  ref: FactRef;
}

/**
 * What the source says about the *headword* rather than about one record of
 * it: read from `source_record_json`, where it is repeated on each record the
 * headword has, or, for a page-only entry, from its own raw page (ADR 0026).
 * A page shows it once per word, not once per reading.
 */
export interface WordFacts {
  pronunciations: Pronunciation[];
  /** Never read for a page-only entry: the word page does not show it (ADR 0026). */
  hyphenations: Hyphenation[];
  /** `etymology_texts`, with Wikizionario's "Etimologia/Riferimenti mancante/i" placeholder taken out (#255). */
  etymologies: WordText[];
  synonyms: RelatedWord[];
  /** The same synonyms uncollapsed, in source order, each with its `raw_tags`. */
  synonymList: SynonymEntry[];
  antonyms: RelatedWord[];
  derived: RelatedWord[];
  /** `proverbs[]`, one row per phrase (src/lookup/expressions.ts). */
  expressions: Expression[];
}

export interface Sense {
  index: number;
  /** The sense itself, as a pointer: `/senses/0`. */
  ref: SourceRef;
  /** `senses[].examples[].text`, verbatim and in source order. */
  examples: SourceText[];
  /**
   * Copied source text, never a Lexema definition, with Wikizionario's
   * "definizione mancante; se vuoi, aggiungila tu" taken out (#255): a gloss
   * that was only that is not here, and neither is one that only repeats the
   * headword, as `presina` does (#395). May be empty: 667 senses carry no gloss at
   * all, and a non-empty gloss is still not proof of a usable one — `casa` has
   * two that say nothing.
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

/**
 * Where a fact a page shows was read: a field of an archive line, a line of a
 * raw page for a page-only entry (ADR 0026), a Wikidata word's lexeme, for a
 * fact it states of the whole word, its gender (#849), or one form of the
 * lexeme (ADR 0033, #833). The four are told apart by shape, never by a flag
 * that could disagree with it.
 */
export type FactRef = SourceRef | RecoveredRef | LexemeRef | LexemeFormRef;

/** Whether a fact was read from the archive rather than from a raw page, or from a name entry's Wikidata item or a Wikidata word's lexeme. */
export const isSourceRef = (ref: FactRef | NameRef | LexemeRef): ref is SourceRef => "jsonPointer" in ref;

/** The archive pointer a fact was read at; undefined for a raw page's line, which no query hits. */
export const sourcePointerOf = (ref: FactRef): string | undefined => (isSourceRef(ref) ? ref.jsonPointer : undefined);

/** A key that tells any two facts' places apart, whichever source each was read from. */
export const factRefKey = (ref: FactRef): string =>
  isSourceRef(ref)
    ? `${ref.releaseId}\u0000${ref.lineNo}\u0000${ref.jsonPointer}`
    : isLexemeFormRef(ref)
      ? `${ref.wiki}\u0000${ref.snapshot}\u0000${ref.form}`
      : isLexemeRef(ref)
        ? `${ref.wiki}\u0000${ref.snapshot}\u0000${ref.lexeme}`
        : `${ref.wiki}\u0000${ref.title}\u0000${ref.revisionId}\u0000${ref.line}`;

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
  | { route: "sense-line" }
  | { route: "numbered-prose" }
  | { route: "above-heading-prose" }
  | { route: "below-page-control" }
  | { route: "sub-term"; term: string }
  | { route: "lead-in-item" }
  | { route: "wrapped-prose" }
  | { route: "bullet-line" }
  | { route: "prose-line" }
  /** Not read from a page: a hand-kept reading's definition (ADR 0031), whose ref is the cited revision's sense line it paraphrases. */
  | { route: "hand-kept" };

/**
 * A definition the raw page states and the extraction dropped (#28), read back
 * from the page. It sits beside the record's senses, never inside them: the
 * record stays as imported, and this carries its own ref.
 */
export type RecoveredDefinition = RecoveredRoute & {
  /**
   * Wiktionary's own words, templates printed, links as their labels; or,
   * where `correction` is set, the curated correction's wording in their place.
   */
  text: string;
  /**
   * The curated correction (#450) whose wording `text` is, with the page's
   * own words it stands in for; null when `text` is the page's. Only a
   * page-only entry's definition is ever corrected.
   */
  correction: (CorrectionRef & { replaces: string }) | null;
  /** Usage labels the line's templates print: `architettura`, `senso figurato`. */
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

/**
 * The en.wiktionary revision a hand-kept reading cites (ADR 0031): where its
 * text came from, so what the page's *Fonte* and the API's credit open for
 * it, since it.wiktionary has no page it was read from (Huey's ruling of
 * 2026-10-17 on #856). `citedRevisionUrl` (src/lookup/handKept.ts) is its link.
 */
export interface CitedRevision {
  title: string;
  revisionId: number;
}

/**
 * What an entry is: a source record, pointed at by its archive line; a
 * page-only entry (ADR 0024, #403), pointed at by its page revision; a
 * hand-kept reading (ADR 0031, #745), pointed at by the en.wiktionary revision
 * it cites; a name entry (ADR 0032, #794), pointed at by its Wikidata item; or
 * a Wikidata word (ADR 0033, #812), pointed at by its lexeme. Exactly one of
 * the five.
 */
export type EntryIdentity =
  | ({ recordId: number; entryId?: never; handKeptId?: never; nameItem?: never; description?: never; ref: SourceRef } & NotLexeme)
  | ({ entryId: number; recordId?: never; handKeptId?: never; nameItem?: never; description?: never; ref: PageEntryRef } & NotLexeme)
  | ({ handKeptId: string; recordId?: never; entryId?: never; nameItem?: never; description?: never; ref: PageEntryRef; cites: CitedRevision } & NotLexeme)
  | (NameIdentity & NotLexeme)
  | LexemeIdentity;

/** What every entry but a Wikidata word lacks. */
interface NotLexeme {
  lexeme?: never;
  lexemeGlosses?: never;
}

/**
 * A name entry (ADR 0032, #794): a proper name from Wikidata, pointed at by
 * its item. Its one meaning is the item's Italian description, so a name entry
 * without one is not a value this type can hold.
 */
export interface NameIdentity {
  nameItem: `Q${number}`;
  /** The item's Italian description, as Wikidata states it: the entry's one definition. */
  description: string;
  recordId?: never;
  entryId?: never;
  handKeptId?: never;
  ref: NameRef;
}

/**
 * Where a name entry was read: its Wikidata item, under the release the lookup
 * serves, since it belongs to none. A *Fonte* link opens the item's page.
 */
export interface NameRef {
  releaseId: string;
  wiki: "www.wikidata.org";
  item: `Q${number}`;
  lexeme?: never;
  snapshot?: never;
  title?: never;
  revisionId?: never;
  line?: never;
  lineNo?: never;
  lineSha256?: never;
  jsonPointer?: never;
}

/** Whether an entry is a name entry from Wikidata rather than a reading of Wiktionary's or Lexema's. */
export const isNameEntry = (entry: EntryIdentity): entry is NameIdentity => entry.nameItem !== undefined;

/**
 * A Wikidata word (ADR 0033, #812): an Italian lexeme from Wikidata, pointed
 * at by its lexeme, shown only for a spelling no Wiktionary reading answers.
 * Its definitions are the Italian glosses of its senses, as Wikidata states
 * them, and it may have none.
 */
export interface LexemeIdentity {
  lexeme: `L${number}`;
  /** The Italian gloss of each sense that has one, in Wikidata's order: the word's definitions. */
  lexemeGlosses: LexemeGloss[];
  recordId?: never;
  entryId?: never;
  handKeptId?: never;
  nameItem?: never;
  description?: never;
  ref: LexemeRef;
}

/** The Italian gloss of one sense of a lexeme, and the sense it glosses. */
export interface LexemeGloss {
  sense: `L${number}-S${number}`;
  text: string;
}

/**
 * Where a Wikidata word was read: its lexeme, as the lexeme dump of
 * `snapshot` states it, under the release the lookup serves, since it belongs
 * to none. A *Fonte* link opens the lexeme's page.
 */
export interface LexemeRef {
  releaseId: string;
  wiki: "www.wikidata.org";
  lexeme: `L${number}`;
  /** The date of the lexeme dump the row was taken from. */
  snapshot: string;
  item?: never;
  title?: never;
  revisionId?: never;
  line?: never;
  lineNo?: never;
  lineSha256?: never;
  jsonPointer?: never;
}

/**
 * Where a fact of one form of a Wikidata word was read (#833): its lexeme, as
 * `LexemeRef` names it, and the form's own id there. A form's tags are read
 * off its grammatical features (src/wikidataWords/formFeatures.ts), so each
 * points at the form that states them.
 */
export interface LexemeFormRef extends LexemeRef {
  form: `L${number}-F${number}`;
}

/** Whether a fact was read off a Wikidata word's form. */
export const isLexemeFormRef = (ref: FactRef): ref is LexemeFormRef => "form" in ref;

/** Whether a fact was read off a Wikidata word's lexeme, or one of its forms. */
export const isLexemeRef = (ref: FactRef): ref is LexemeRef | LexemeFormRef => "lexeme" in ref;

/** Whether an entry is a Wikidata word rather than a reading of Wiktionary's or Lexema's, or a name entry. */
export const isWikidataWord = (entry: EntryIdentity): entry is LexemeIdentity => entry.lexeme !== undefined;

/** Whether an entry is from Wikidata, a name entry or a Wikidata word: one Wiktionary does not state. */
export const isFromWikidata = (entry: EntryIdentity): boolean => isNameEntry(entry) || isWikidataWord(entry);

/**
 * Where a page-only entry was read: its page revision and the line that names
 * its part of speech, verbatim. A hand-kept reading's names the en.wiktionary
 * revision it cites and the heading of its section there, under the release
 * the lookup serves, since it belongs to no release.
 */
export interface PageEntryRef {
  releaseId: string;
  wiki: string;
  title: string;
  revisionId: number;
  timestamp: string;
  line: number;
  wikitext: string;
  lineNo?: never;
  lineSha256?: never;
  jsonPointer?: never;
}

/**
 * A record the source names as the target of a form_of edge, or the page-only
 * entry it names. `ref` is the candidate's own headword field, where `word`
 * was read from: the record's line, or the entry's page line.
 */
export type LemmaCandidate = EntryIdentity & {
  word: string;
  pos: string;
};

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
 * A verb lemma's whole `forms[]` when that table spells nothing the query hit:
 * `andare`'s, for `andati`, whose own record says it is a form of `andare`
 * while andare's table lists only `andato` (#666). It is read only for a verb
 * a verb form record about the query names, and only when the lemma has no
 * {@link LemmaListing}, so its page can show the verb's conjugation with
 * nothing marked.
 */
export interface UnlistedTable {
  forms: [SourceForm, ...SourceForm[]];
}

/**
 * A lemma record's own definitions, read as its own page reads them: its
 * senses and the definitions recovered from its raw page. A verb form's block
 * lists them as its *Definitions* (#686).
 */
export type LemmaDefinitions = Pick<ReadingFacts, "senses" | "recovered">;

/**
 * One record a reading's lemma link resolves to, as this lookup found it.
 *
 * A lemma whose own table lists the searched surface matches the query too,
 * but it is not returned as a reading of its own: it is the lemma of the
 * reading that points to it, and it arrives here. `listing` is where its table
 * spells the query, and is absent when its table does not — `sala` the verb
 * record, for `sale`, lists no `sale`. Only then may `unlisted` carry the
 * lemma's table anyway, so a lemma never carries both.
 */
export type LemmaTarget = LemmaCandidate & {
  /**
   * The verb record's own definitions, for a verb a verb form record about the
   * query names, once a page has read them (`withVerbDefinitions`,
   * src/lookup/lookup.ts); absent for every other lemma, and from the lookup.
   */
  definitions?: LemmaDefinitions;
} & ({ listing: LemmaListing; unlisted?: never } | { listing: undefined; unlisted?: UnlistedTable });

/**
 * A declared "this word is a form of that word" link: the reading's lemma. The
 * source names a word, and a word can be several records, so the resolved case
 * carries every candidate and never a winner; an edge resolving to nothing
 * stays visible.
 */
export type LemmaLink =
  | { kind: "dangling"; targetWord: string; ref: FactRef }
  | { kind: "candidates"; targetWord: string; candidates: LemmaTarget[]; ref: FactRef };

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
  /**
   * Where the declaring record says it is the plural of this reading's word:
   * `case` glosses "plurale di casa" (`it-plural-gloss/v1`,
   * src/italian/pluralGloss.ts). Absent for every other gloss: `casetta` says
   * "diminutivo di casa".
   *
   * The gloss names a word, like the edge, so every candidate carries the same
   * one: `temi` says it on both noun records of `tema`. Whose plural it is
   * stays as open as `targetCandidates` leaves it (`namesOneRecordOf`).
   */
  plural: PluralDeclaration | undefined;
}

/**
 * A record's gloss saying it is the plural of a word, and the genders that
 * record states. The gloss is the first one of the first sense, in source
 * order, whose edge lands here and reads so.
 */
export interface PluralDeclaration {
  /** The gloss that says it, as stored: `plurale di casa` at `/senses/0/glosses/0`. */
  gloss: SourceText;
  /** The gender the gloss names: `femminile plurale di …`. Undefined for a bare `plurale di …`. */
  glossGender: "masculine" | "feminine" | undefined;
  /**
   * The declaring record's own gender claims, from its tags, or the curated
   * correction standing in for them (`giocatrici` is tagged masculine and is
   * feminine); empty when it states none.
   */
  recordGenders: AssertedClaim[];
  /**
   * A curated correction of the declaring record's number, which overrides
   * the gloss's "plurale": `ammaliatrice` glosses itself "plurale di
   * ammaliatore" and is its feminine singular. Undefined when none.
   */
  correctedNumber: CorrectedClaim | undefined;
}

/**
 * A declaring record's plural declaration, as a reader is owed it: its stated
 * gender and number claims with its curated corrections in their place
 * (`correctRecordClaims`). A word's own page and a declared lemma's page both
 * build it here, so a corrected record sits in the same cell on each. The
 * number claims are read only so a correction of one can say what it replaces.
 */
export function pluralDeclaration(
  gloss: SourceText,
  glossGender: PluralDeclaration["glossGender"],
  stated: readonly StatedClaim[],
  corrections: readonly Omit<CorrectedClaim, "status" | "replaces">[],
): PluralDeclaration {
  const asserted = correctRecordClaims(stated, corrections).filter(asserts);
  return {
    gloss,
    glossGender,
    recordGenders: asserted.filter((claim) => claim.dimension === "gender"),
    correctedNumber: asserted.find((claim): claim is CorrectedClaim => claim.status === "corrected" && claim.dimension === "number"),
  };
}

/**
 * A record that declares itself a form of a declared lemma, as that lemma's
 * page shows it: the record's own headword, spelled as the source spells it,
 * and its `/word`. The record is a real line, so the form keeps pointing at it.
 */
export interface DeclaredForm {
  surface: string;
  ref: SourceRef;
}

/** A verb form a declared lemma's gloss places, by `it-verb-form-gloss/v1` (src/italian/verbFormGloss.ts). */
export interface DeclaredVerbForm extends DeclaredForm {
  /** The gloss that names the slot, as stored: `gerundio di verbalizzare` at `/senses/0/glosses/0`. */
  gloss: SourceText;
  slot: VerbFormGloss;
}

/** A plural a declared lemma's gloss names, by `it-plural-gloss/v1` (src/italian/pluralGloss.ts). */
export interface DeclaredPluralForm extends DeclaredForm {
  plural: PluralDeclaration;
}

/**
 * One part of speech of a declared lemma: the forms its declaring records of
 * that part of speech place, in source order, and never an empty list. It is
 * not a `Reading`: no record heads the word, so there is no `recordId`, no
 * definition and no grammar of its own to hold. `posTitle` is the Italian
 * section title for the declaring records' `pos` (`Verbo`, `Sostantivo`,
 * `Aggettivo`), as Wikizionario titles a lemma's own section.
 */
export type DeclaredLemmaReading =
  | { pos: "verb"; posTitle: string; word: string; forms: [DeclaredVerbForm, ...DeclaredVerbForm[]] }
  | { pos: "noun" | "adj"; posTitle: string; word: string; forms: [DeclaredPluralForm, ...DeclaredPluralForm[]] };

/**
 * One reading of a declared lemma without its forms (#818): the word as its
 * edges spell it and the part of speech, which name it, its section title,
 * and `credit`, the first record in source order that declares itself a form
 * of this reading. That record's Wiktionary page holds what the reading
 * shows; the lemma's own spelling almost never has a page. A full lookup, a
 * batch lookup and `exists()` each reach it, so the three name and credit one
 * reading alike.
 */
export interface DeclaredLemmaHead {
  word: string;
  pos: DeclaredLemmaReading["pos"];
  posTitle: string;
  credit: string;
}

/** A declared lemma's reading without its forms: they are in source order, so the first is the first record that declares one. */
export const declaredLemmaHead = ({ word, pos, posTitle, forms }: DeclaredLemmaReading): DeclaredLemmaHead => ({ word, pos, posTitle, credit: forms[0].surface });

/**
 * A query that no record heads, lists or spells as a phrase, but that
 * `form_of` edges of served records name (#453): `verbalizzare` has no record,
 * and fifty records say they are its forms. The readings are a non-empty
 * tuple, one per part of speech whose glosses place a form, so a declared
 * lemma with nothing to show is not a value this type can hold.
 *
 * `lookup()` answers it when nothing else does, after every other route and
 * just before `not-found` (#818), so the page and the developer API reach it
 * the same way: the page shows its forms table, and `/v1/lookup` answers one
 * result per reading, with no definition (docs/LOOKUP.md).
 */
export interface DeclaredLemmaResult {
  outcome: "declared-lemma";
  query: QueryInfo;
  release: ReleaseInfo;
  readings: [DeclaredLemmaReading, ...DeclaredLemmaReading[]];
}

/**
 * A review verdict on one claim. Review never edits the source: a verdict is
 * data stored beside the claim, and the result page does not show it.
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
 * and number were both usable, because the rule is only asked about a surface
 * with one gender and one number (`articlesFor`, `src/italian/articles.ts`).
 * `cause` is the rule's own reason for refusing that surface.
 *
 * A record that states two genders (`psichiatra`) or two numbers (`khmer`)
 * is withheld rather than given the articles of whichever came first.
 */
export type ArticleWithholding =
  | { reason: "no-gender-or-number-stated" }
  | { reason: "gender-not-stated" }
  | { reason: "number-not-stated" }
  | { reason: "more-than-one-gender-stated"; statedGenders: [string, string, ...string[]] }
  | { reason: "more-than-one-number-stated"; statedNumbers: [string, string, ...string[]] }
  | { reason: "gender-is-not-masculine-or-feminine"; statedGender: string }
  | { reason: "number-is-not-singular-or-plural"; statedNumber: string }
  | { reason: "surface-not-handled"; surface: string; cause: SurfaceWithholding };

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
type ReadingFacts = EntryIdentity & {
  /** The record's own headword, verbatim. */
  word: string;
  posTitle: string;
  /** The headword-level fields this record's archive line carries. */
  wordFacts: WordFacts;
  /**
   * This record's own `translations[]`, in source order (#739). Never a
   * lemma's: a form-of record that lists none has none. A page-only entry has
   * no archive line, so none.
   */
  translations: Translation[];

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
  /** A curated correction's forms added to and removed from this record's table (#836); absent where none sets it right. */
  formCorrection?: FormCorrection;
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
   * Articles for this reading, derived by `it-articles/v3` from the gender and
   * number the source states, and the record's own IPA where the spelling
   * leaves the first sound open — or the reason there are none. Nothing here
   * comes from the release: the source carries no article field at all.
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

/** Stable within one seeded database, without conflating page entries, hand-kept readings, name entries or Wikidata words with source records. */
export function entryKey(entry: EntryIdentity): string {
  if (entry.recordId !== undefined) return String(entry.recordId);
  if (entry.entryId !== undefined) return `page-${entry.entryId}`;
  if (entry.handKeptId !== undefined) return `kept-${entry.handKeptId}`;
  return entry.nameItem !== undefined ? `name-${entry.nameItem}` : `lexeme-${entry.lexeme}`;
}

/**
 * What an entry's public id is read from: a source record's archive line, or
 * a page-only entry's revision and the 1-based line that states its part of
 * speech. A page states one part of speech per line, so the line tells apart
 * the entries one page gives (`lungo`, ADR 0028).
 */
export type PublicEntryKey = { releaseId: string } & (
  | { lineNo: number; revisionId?: never; pageLine?: never; nameItem?: never; lexeme?: never; declaredLemma?: never }
  | { revisionId: number; pageLine: number; lineNo?: never; nameItem?: never; lexeme?: never; declaredLemma?: never }
  | { nameItem: `Q${number}`; lineNo?: never; revisionId?: never; pageLine?: never; lexeme?: never; declaredLemma?: never }
  | { lexeme: `L${number}`; lineNo?: never; revisionId?: never; pageLine?: never; nameItem?: never; declaredLemma?: never }
  | { declaredLemma: Pick<DeclaredLemmaHead, "word" | "pos">; lineNo?: never; revisionId?: never; pageLine?: never; nameItem?: never; lexeme?: never }
);

/**
 * The id the API names an entry by: `<release>:<lineNo>`,
 * `<release>:page:<revisionId>:<pageLine>`, or, for a name entry (ADR 0032),
 * `<release>:wikidata:<item>`, and for a Wikidata word (ADR 0033),
 * `<release>:wikidata:<lexeme>`. A declared lemma's reading has no line, page
 * or item, so its id is its part of speech and its word (#818):
 * `<release>:declared:<pos>:<word>`, one per part of speech, and never a
 * record's. The part of speech goes first because a word may hold a colon.
 */
export function publicEntryId(key: PublicEntryKey): string {
  if (key.declaredLemma !== undefined) return `${key.releaseId}:declared:${key.declaredLemma.pos}:${key.declaredLemma.word}`;
  if (key.nameItem !== undefined) return `${key.releaseId}:wikidata:${key.nameItem}`;
  if (key.lexeme !== undefined) return `${key.releaseId}:wikidata:${key.lexeme}`;
  return key.lineNo === undefined ? `${key.releaseId}:page:${key.revisionId}:${key.pageLine}` : `${key.releaseId}:${key.lineNo}`;
}

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
 * Whether the search reached this record only through table cells a curated
 * correction spells (ADR 0027, ADR 0030): `eguali` reaches `eguale`, whose
 * source lists `equivalenti` in the cell the correction sets to `eguali`
 * (#830). The searched spelling is the record's only by the correction, so
 * the source names it on no page of its own (#875).
 */
export function isReachedOnlyByCorrection(reading: Reading): boolean {
  const searched = searchedSpellings(reading);
  if (searched.headword || searched.forms.size === 0) return false;
  const cells = reading.forms.filter((form) => isSearchedForm(searched, form.ref));
  return cells.length === searched.forms.size && cells.every((form) => form.corrected !== undefined);
}

/**
 * The readings that are only forms of the query's own readings: on `bello`'s
 * page, the records of `bella`, `belli` and `bellissimo`, which list `bello`
 * in their tables and declare themselves its forms (#622).
 *
 * A reading is one when it is not about the query, so it matched only through
 * its table, and one of its declared lemma candidates is a reading about the
 * query or a reading already found here. The second arm is what takes a chain:
 * `bellissime` is a form of `bellissimo`, which is a form of `bello`.
 *
 * Only declared `form_of` edges count, never a gloss, and only one that lands
 * on a reading of this page: `studentessa` lists `studenti` and is a form of
 * `studente`, which is no reading about `studenti`, so it stays. Nothing is
 * compared by spelling; an entry is matched by its identity.
 */
export function formsOfQueryReadings(readings: readonly Reading[]): ReadonlySet<Reading> {
  return formsReaching(readings, readings.filter((reading) => reading.isAboutQuery).map(entryKey));
}

/**
 * The readings that are only other forms of the query's own lemma: on `bella`'s
 * page, the records of `belli`, `belle` and `bellissimo`, which list `bella` in
 * their tables and declare themselves forms of `bello`, as `bella` does (Huey,
 * 2026-10-05, on #626: "bella is the same as bello").
 *
 * A reading is one when it is not about the query and one of its declared
 * lemma candidates is a record that a reading about the query declares itself
 * a form of, or a reading already found here. The second arm takes a chain:
 * `bellissime` is a form of `bellissimo`, which is a form of `bello`.
 *
 * As in {@link formsOfQueryReadings}, only declared `form_of` edges count,
 * never a gloss, and entries are matched by identity, never by spelling. A
 * record that lists the query and declares no form of such a lemma keeps its
 * reading: a separate noun `bella`, or a proper name.
 */
export function otherFormsOfQueryLemmas(readings: readonly Reading[]): ReadonlySet<Reading> {
  const lemmas = readings
    .filter((reading) => reading.isAboutQuery)
    .flatMap((reading) => reading.lemmaLinks.flatMap((link) => (link.kind === "candidates" ? link.candidates : [])))
    .map(entryKey);
  return formsReaching(readings, lemmas);
}

/**
 * The readings not about the query whose declared lemma candidates reach
 * `seed`, each one found reaching on to the readings that declare themselves
 * its forms.
 */
function formsReaching(readings: readonly Reading[], seed: readonly string[]): ReadonlySet<Reading> {
  const reached = new Set(seed);
  const forms = new Set<Reading>();
  const namesReached = (reading: Reading): boolean =>
    reading.lemmaLinks.some(
      (link) => link.kind === "candidates" && link.candidates.some((candidate) => reached.has(entryKey(candidate))),
    );
  let grew = true;
  while (grew) {
    grew = false;
    for (const reading of readings) {
      if (reading.isAboutQuery || forms.has(reading) || !namesReached(reading)) continue;
      forms.add(reading);
      reached.add(entryKey(reading));
      grew = true;
    }
  }
  return forms;
}

/**
 * The lemmas a form-of record of part of speech `pos` names that are of its
 * own part of speech: `andavano` the verb names `andare`, which is a noun
 * record and a verb record, and the verb is its lemma. When no candidate
 * shares the part of speech, every candidate stays, because the source did not
 * say which. A dangling link names none.
 *
 * Generic over the candidate, so a full reading's links and the light links a
 * batch reads (src/lookup/batch.ts) go through the one rule.
 */
export function lemmasOfPartOfSpeech<C extends { readonly pos: string }>(
  pos: string,
  links: readonly ({ readonly kind: "dangling" } | { readonly kind: "candidates"; readonly candidates: readonly C[] })[],
): C[] {
  const all = links.flatMap((link) => (link.kind === "candidates" ? link.candidates : []));
  const same = all.filter((lemma) => lemma.pos === pos);
  return same.length > 0 ? same : all;
}

/**
 * Whether an incoming edge can mean one record alone among those of part of
 * speech `pos`: its target word resolves to exactly one such record, which is
 * then the reading carrying the link. `case` names `casa`, one noun record.
 * `temi` names `tema`, a masculine noun record and a feminine one, so the edge
 * settles on neither. It is `lemmasOfPartOfSpeech` seen from the other end:
 * a candidate of another part of speech (`tema` the verb form) does not count.
 */
export function namesOneRecordOf(pos: string, inflection: Pick<InflectionOf, "targetCandidates">): boolean {
  return inflection.targetCandidates.filter((candidate) => candidate.pos === pos).length === 1;
}

/**
 * Every spelling on this reading the query actually hit, in the two shapes a
 * record spells a word in: its own headword, and its `forms[]` entries.
 *
 * The two come off the same evidence list, split by the kind each occurrence
 * carries. An `embedded-form` occurrence is the surface inside this record's
 * table, and its ref names the same form the matching `SourceForm` carries:
 * a record's by the JSON pointer both read from one `lookup_form` row
 * (`src/db/schema.sql`, view `surface_hit`), a Wikidata word's by the form's
 * id (#851). So a page marks a form by its {@link SearchedFormKey} rather than
 * by spelling: no normalizing, no case guessing, and no risk of outlining a
 * spelling the index never matched. A `headword` occurrence has no `forms[]`
 * entry to point at — its ref is `/word`, or the lexeme — so it is its own
 * flag, and a record whose headword is the query is marked where that
 * headword sits.
 */
export interface SearchedSpellings {
  /** True when the query hit this record's own headword. */
  readonly headword: boolean;
  /** The key of every form the query hit. */
  readonly forms: ReadonlySet<SearchedFormKey>;
}

/**
 * Which form a search hit, as one string: a record's `forms[]` entry by its
 * JSON pointer, which starts with `/`, or a Wikidata word's form by its id,
 * which starts with `L` (#851). The two shapes cannot meet, and a key is
 * always one of them.
 */
export type SearchedFormKey = `/${string}` | `L${number}-F${number}`;

/** The key a search names a form by, read off where the form was read; none for a raw page's line, or a record's whole line, which no query hits as a form. */
export function searchedFormKey(ref: FactRef): SearchedFormKey | undefined {
  if (isLexemeFormRef(ref)) return ref.form;
  return isSourceRef(ref) && ref.jsonPointer.startsWith("/") ? (ref.jsonPointer as `/${string}`) : undefined;
}

/** Where a form a search can hit was read: a record's `forms[]` entry, or a Wikidata word's form. */
export type SearchableFormRef = SourceRef | LexemeFormRef;

/** `ref`, when the search hit the form read there; undefined otherwise. */
export function searchedFormRef(searched: SearchedSpellings, ref: FactRef): SearchableFormRef | undefined {
  if (!isLexemeFormRef(ref) && !isSourceRef(ref)) return undefined;
  const key = searchedFormKey(ref);
  return key !== undefined && searched.forms.has(key) ? ref : undefined;
}

/** Whether the search hit the form read at `ref`. */
export const isSearchedForm = (searched: SearchedSpellings, ref: FactRef): boolean => searchedFormRef(searched, ref) !== undefined;

/** What a search hit of a table it did not reach: nothing. */
export const NOTHING_SEARCHED: SearchedSpellings = { headword: false, forms: new Set() };

/**
 * Read {@link SearchedSpellings} off a reading's own evidence (#49), or off a
 * lemma's {@link LemmaListing}, which carries evidence of the same kind.
 */
export function searchedSpellings(hit: { readonly evidence: readonly Evidence[] }): SearchedSpellings {
  return {
    headword: hit.evidence.some((occurrence) => occurrence.origin === "headword"),
    forms: new Set(
      hit.evidence.flatMap((occurrence) => {
        const key = occurrence.origin === "embedded-form" ? searchedFormKey(occurrence.ref) : undefined;
        return key === undefined ? [] : [key];
      }),
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

/** One typed word of a phrase search, or an auxiliary and its participle, and the lemma it stood for. */
export interface PhraseWord {
  /** As normalized for the index: `vado`, or `sono andati` for a compound tense. */
  typed: string;
  /** The one typed word whose records name the lemma: `vado`, or the participle `andati` of `sono andati`. */
  inflected: string;
  /** The lemma the headword spells in its place: `andare`. */
  lemma: string;
}

/**
 * A multi-word headword a query reached word by word (#214, rule
 * `it-phrase/v1` in src/italian/phrase.ts): `vado via` is *andare via*. The
 * words are the searched form, recorded as a form match records its surface.
 */
export interface PhraseMatch {
  /** The headword's key, which is the lemmas joined by single spaces: `andare via`. */
  key: string;
  /** The headword as the source spells it. */
  word: string;
  words: [PhraseWord, PhraseWord, ...PhraseWord[]];
}

/**
 * One form entry of a searched expression's inflected word, its lemma replaced
 * by the expression (`phraseGloss`, src/italian/phrase.ts): `vado`'s
 * "prima persona singolare del presente semplice indicativo di andare" reads
 * "… di *andare via*" for `vado via`.
 */
export interface PhraseDefinition extends PhraseGloss {
  /** The gloss the line is built from, where the source writes it. */
  ref: SourceRef;
}

/**
 * A record of a word the expression was searched with, and its form entries
 * that name a lemma of the expression's headword, each rewritten for that
 * headword. The short page a searched expression opens shows these, each after
 * the headword's own meanings (Huey's page-shape rulings on #214, 2026-09-30).
 */
export interface PhraseForm {
  recordId: number;
  /** The inflected word as the source spells it: `vado`. */
  word: string;
  /** The record's own part-of-speech title, verbatim: `Voce verbale`. */
  posTitle: string;
  /** The record itself. */
  ref: SourceRef;
  definitions: [PhraseDefinition, ...PhraseDefinition[]];
}

/**
 * How a found query reached its readings. `surface`: the query itself is a
 * headword or a listed form. `phrase`: it is none, and its words, each read as
 * its lemmas, spell one or more multi-word headwords, which are the readings.
 * `forms` are the searched words' form entries rewritten for those headwords,
 * in source order. `feminine`: it is none, and it is the feminine of an
 * agreeing first spelling verbs' tables list (`sono andata` of `sono andato`,
 * `mi sono arresa` of `mi sono arreso, arresosi`; rule
 * `it-essere-agreement/v2`, #676); the readings are those verbs, and their
 * evidence is only the cells of that spelling that agree. `first-spelling`:
 * it is none, and it is, as typed, the agreeing first spelling of cells that
 * hold more than one (`mi sono arreso` of `mi sono arreso, arresosi`).
 * `shape`: it is none of these, and rule `it-word-shape/v1` reads it as a
 * shape of words the dictionary has (`raccontarvi` of `raccontare`,
 * `quei` of `quello`, #809); `spellings` are the spellings that answered, and the
 * readings are their records. `pronominal`: it is none of these, and rule
 * `it-pronominal-pair/v2` reads it, a reflexive pronoun and a verb form, as a
 * pronominal verb the dictionary has (`mi trasferisco` of `trasferirsi`,
 * #810, #834); `pairs` are the pairs that answered, and the readings are
 * those verbs. `accentless`: nothing answers it, not even a Wikidata word,
 * and it is one word typed without the final accent of one served headword,
 * or of several where the others are recorded as its variants (`perche` of
 * `perché`, `piu` of `più` beside `piú`, #846, src/lookup/accentless.ts);
 * `headword` is that headword as the source writes it, and the readings are
 * its own, as a search for it answers them.
 */
export type FoundRoute =
  | { kind: "surface" }
  | { kind: "phrase"; phrases: [PhraseMatch, ...PhraseMatch[]]; forms: PhraseForm[] }
  | { kind: "feminine"; agreement: AgreeingSpelling }
  | { kind: "first-spelling"; agreement: AgreeingSpelling }
  | { kind: "shape"; spellings: [ShapedSpelling, ...ShapedSpelling[]] }
  | { kind: "pronominal"; pairs: [PronominalPair, ...PronominalPair[]] }
  | { kind: "accentless"; headword: string };

/**
 * The index was probed and at least one record matched. The readings are a
 * non-empty tuple, so `found` with nothing found is not a state this type can
 * express.
 */
export interface FoundResult {
  outcome: "found";
  query: QueryInfo;
  release: ReleaseInfo;
  route: FoundRoute;
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
export type SearchResult = FoundResult | DeclaredLemmaResult | NotFoundResult;

export type LookupResult = RejectedResult | SearchResult;
