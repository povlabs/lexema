// Curated corrections: facts the source states wrongly, set right by hand in the
// master (#420), each with the evidence it was checked against.
//
// Rule `it-plural-gloss/v1` (#145) fills a noun's plural cell from a record
// that glosses itself "plurale di <word>". On release it-0c432803, 22 of those
// pairs disagreed with their own tags, and Huey checked each one against
// Wiktionary on 2026-10-03: eight declaring records state the wrong gender or
// number (`ammaliatrice` says "plurale di ammaliatore" and is its feminine
// singular), and four nouns are tagged with the wrong gender (`fissazione` is
// tagged masculine). The other ten pairs are right and are not listed here.
// His ruling: "fix it now", in our curated master, which may carry hand-added
// facts that cite their evidence (#18). Wiktionary still carries every one of
// these errors, so no newer release will fix them.
//
// Eight more declaring records are right on their noun's page and wrong on
// their own: real plurals tagged singular, so `costruttrici`'s own page said
// "la costruttrici" (#449). Huey's ruling on 2026-10-03 added a correction of
// each one's number to plural, checked against Wiktionary the same way. Their
// gloss already says plural, so their noun's page does not move.
//
// Those 20 were checked one by one. A scan found 292 such "plurale di" records
// tagged singular (#483), and Huey ruled to correct the rest by one rule (ADR
// 0027's 2026-10-03 amendment). A plural's number and gender change only where
// the record's own en.wiktionary page confirms them. A real singular noun whose
// gloss wrongly says "plurale di" may instead be confirmed by its lemma's
// it.wiktionary table of forms (`{{Tabs}}`); six of those fifteen cite only that
// page. Rule `it-plural-gloss-number/v3` (pluralGlossNumber.ts) makes those
// entries from pinned revisions (pluralGlossEvidence.ts); they follow the hand
// entries in `CURATED_CORRECTIONS` and travel the same layer. v2 (#515) makes
// every entry v1 made, and also takes a gloss naming the feminine singular and
// a plural filed under the neighbouring part of speech, on Huey's ruling. v3
// (#516) makes every entry v2 made, and also corrects a real singular adjective
// with that wrong gloss, confirmed by its own en.wiktionary page only.
//
// A correction is a layer beside the record, never an edit of it. It names one
// record by release, archive line and line digest, and the record's line in
// `source_record_json` stays byte for byte. The seed writes it as a
// `corrected_claim` row (src/import/correctedLayer.ts), `pnpm run
// correct:records` writes it into a master seeded before it
// (src/import/correctRecords.ts), and a lookup reads it in place of the
// source's own claim in that dimension (`correctRecordClaims` in
// src/lookup/types.ts). A record a later release replaces does not inherit it:
// the update reports it instead (src/update/apply.ts). The page shows the
// corrected fact as data and says nothing about the correction (ADR 0016).
//
// The list holds a sense's `form_of` edge too (ADR 0030, #722): `aerei`'s noun
// says "plurale di aereo" and declares no edge, and `parti`'s two senses
// about `parto` name `neonato` and `Parti`. Huey ruled on 2026-10-07 (#708,
// questions 7 to 9) that a correction may add the missing edge, or fix the
// wrong one, where the gloss names the word after "di" and that word's own
// forms table lists the record's word. Such an entry cites the two Wiktionary
// pages those facts come from, each at the revision the archive was extracted
// from: the record's own page, which shows the gloss (`edge.gloss`), and the
// word's page, whose table lists it (`evidence`; Huey's ruling of 2026-10-08,
// https://github.com/povlabs/lexema/issues/722#issuecomment-6058471600). Rule
// `it-form-of-gloss-edge/v1` (formOfGlossEdge.ts) made the added edges from
// its pinned scan (formOfGlossEdgeEvidence.ts); `parti`'s two fixed ones are
// hand entries. Huey ruled on 2026-10-08 (#733,
// https://github.com/povlabs/lexema/issues/733#issuecomment-6066281058) to fix
// every other edge that names another word under the same two conditions, so
// `it-form-of-gloss-edge/v2` makes v1's edges and replaces those too, each
// keeping the source's edge verbatim (`edge.replaces`), as `parti`'s entries
// do. The seed writes each as a `corrected_edge` row, a hidden record
// gets none, and a lookup reads it in place of the sense's own edges
// (src/lookup/correctedEdge.ts).
//
// An edge may also be removed (#755). `mele`'s senses 1 to 3 gloss meanings,
// "guance, soprattutto nei bambini:", yet carry edges to a word of their gloss,
// `bambini`. Huey ruled on 2026-10-09
// (https://github.com/povlabs/lexema/issues/755#issuecomment-6076090404; ADR
// 0030's amendment of that day) that such an edge is removed, or, where the
// record also has a real form sense, pointed at the record's own base word,
// `mela`. Rule `it-form-of-meaning-edge/v1` (formOfMeaningEdge.ts) makes both
// from its pinned scan (formOfMeaningEdgeEvidence.ts): a pointed edge is an
// edge correction like v2's, whose gloss is the form sense's, and a removed
// one an `EdgeRemoval`, which keeps the source's edge verbatim
// (`edge.removes`) and cites the record's own page. The seed writes it as a
// `corrected_edge` row that names no word, and a lookup reads the sense as
// having no edge.
//
// The list holds a second kind (#450): a definition of a page-only entry (ADR
// 0024) that the Wiktionary page itself states wrongly. `grufolare`'s page
// gives the sense of *grugnire*, and `tremare`'s first sense is a fragment
// with no verb. Huey ruled on 2026-10-03 to correct them like the plurals, and
// that the builder may draft the wording from cited dictionaries for him to
// approve word for word on the pull request (ADR 0008's 2026-10-03
// amendment). Such a correction names its entry by page title and dump
// revision, and the definition by its place, its page line and the text the
// page shows there. The seed writes it as a `corrected_definition` row beside
// the entry's own rows (src/import/correctedDefinitions.ts), `pnpm run
// correct:records` writes it into a master seeded before it, and a lookup
// reads its wording in place of the page's (src/lookup/pageEntry.ts). An entry
// recovered from another revision, or no longer recovered at all, does not get
// it: the seed and the run report it instead (ADR 0025).
//
// A third kind sets cells of a verb's conjugation table (ADR 0030, #723).
// `assorbire`'s plural essere cells read `siamo assorbito, assorti, assorti`:
// a singular participle and a repeated word. The source has that text from
// the it.wiktionary conjugation page, whose template renders it, so no page
// shows the right cell. Huey ruled on 2026-10-08 that the fix may use the
// regular essere spelling all the same, in all 21 such cells, citing that page
// (ADR 0030's 2026-10-08 amendment). Such a correction names its record like
// a record's gender or number, and each cell by its place in `forms[]` and
// the text the line holds there. The seed writes one `corrected_form` row per
// cell (src/import/correctedLayer.ts), `pnpm run correct:records` writes them
// into a master seeded before it, and a lookup reads the cell in place of the
// source's spelling (`formsOf` in src/lookup/lookup.ts).
//
// The same kind sets the tables of ten pronominal verbs (#839). Their
// it.wiktionary conjugation pages pass `avere` to `{{It-conj}}`, so the source
// reads `mi ho abbagliato` and names avere the auxiliary; Italian builds these
// on essere, `mi sono abbagliato`. Huey ruled on 2026-10-17
// (https://github.com/povlabs/lexema/issues/839#issuecomment-6233239777) to
// set every compound cell and the auxiliary to essere, citing each page, as
// for `assorbire`. Each cell reads what rule `it-pronominal-conjugation/v1`
// builds for its place from the base verb's table (test/pronominalAvereCells.test.ts).
//
// The same kind sets a noun's or adjective's listed form (#830). `eguale`'s
// page writes `{{Pn}} ''m'' e ''f sing'' {{Linkp|equivalenti}}`: its plural
// is `eguali`, and `equivalenti` is another word. Huey ruled on 2026-10-17
// (https://github.com/povlabs/lexema/issues/830#issuecomment-6233334459; ADR
// 0027's amendment of that day) to set the form right, citing that page and
// en.wiktionary's `eguali`. The cell is stored and read as a table cell's,
// and the gender grid places it in every gender the record states, as the
// cited `m e f` says (web/lib/dictionary/genderGrid.ts).
//
// A fourth kind hides one recovered definition that states no dictionary word
// (#773). Rule `recovered-prose-line/v1` reads `diplomatizzare`'s Verbo line 3,
// `{{Transitivo|it}}hhhhhhhh`, as a definition by layout alone (ADR 0029), so
// the page showed the keyboard test text `hhhhhhhh`. Huey ruled on 2026-10-09
// (https://github.com/povlabs/lexema/issues/773#issuecomment-6082693102; ADR
// 0030's amendment of that day) to hide it with a cited correction. Such an
// entry names the record as the other kinds do, and the line by its place on
// the record's own page, with its wikitext and text verbatim; it cites that
// page at the revision the line was read from, and the ruling. The seed writes
// it as a `hidden_recovered_definition` row beside the record
// (src/import/correctedLayer.ts), `pnpm run correct:records` writes it into a
// master seeded before it, and a lookup reads the record as having no such
// definition (`placeRecovered` in src/lookup/recovered.ts). The
// `recovered_definition` row and its labels stay as the rule wrote them. A
// line read from another revision, another text, or no longer read at all
// does not get it: the seed and the run report it instead (ADR 0025). Like
// every correction, it is not carried onto a record that replaces its record:
// the replacing record shows the definition, and the update reports the hide.
//
// A fifth kind hides one sense of a record (#857). `gaio`'s adjective record
// has as its sense 0 the gloss `Ultima_Sfaccim`: its it.wiktionary page, at
// revision 4057291, has `# [[Ultima_Sfaccim]]` at line 6, a stray link where
// a definition should be, so the word page showed it as gaio's first meaning.
// Huey ruled on 2026-10-17
// (https://github.com/povlabs/lexema/issues/857#issuecomment-6237103400; ADR
// 0030's amendment of that day) to hide it with a cited correction. Such an
// entry names the record as the other kinds do, and the sense by its place in
// `senses` with its one gloss verbatim; it cites the page line the sense was
// read from, at that revision, and the ruling. Only a sense that declares no
// `form_of` edge may be hidden, so no edge points at a sense no page shows
// (`senseHideMisquote`). The seed writes it as a `hidden_sense` row beside
// the record (src/import/correctedLayer.ts), `pnpm run correct:records`
// writes it into a master seeded before it, and a lookup reads the record as
// having no such sense (`readSenseRows` picks `HIDING_SENSE_GLOSS_SQL` in
// src/lookup/lookup.ts). The `sense` row and its gloss stay as imported.
// The digest pins the line, so a record a later release changes does not
// get it: the seed reports it, and the update reports it for the record
// that replaced its record (ADR 0025, ADR 0027).
//
// A sixth kind sets an adjective's table of forms right by adding forms and
// removing them (#836). `quello`'s adjective record lists `quelli`, the
// pronoun's plural, and none of `quel`, `quell'`, `quei` and `quegli`, the
// forms the adjective takes before a noun; `bello`'s lists none of `bel`,
// `bell'`, `bei` and `begli`. Huey ruled on 2026-10-17
// (https://github.com/povlabs/lexema/issues/836#issuecomment-6237109728; ADR
// 0027's amendment of that day) to add them, citing en.wiktionary, and to
// remove `quelli` from quello's adjective table; its pronoun keeps it. Such
// an entry names the record as the other kinds do, each added form by its
// spelling, gender and number, and each removed form by its place in
// `forms[]` with the text the line holds there; it cites the pages and the
// ruling. The seed writes one `corrected_adjective_form` row per form
// (src/import/correctedLayer.ts), `pnpm run correct:records` writes them into
// a master seeded before it, and a lookup reads them beside the record's own
// forms (`Reading.formCorrection`), which the gender grid places
// (web/lib/dictionary/genderGrid.ts). `lookup_form` stays as imported, so a
// search still reaches the record by a removed form's spelling.

import { evidenceUrl, type Evidence } from "./evidence.js";
import { FORM_OF_GLOSS_EDGE_EVIDENCE } from "./formOfGlossEdgeEvidence.js";
import { formOfGlossEdgeCorrections } from "./formOfGlossEdge.js";
import { FORM_OF_MEANING_EDGE_EVIDENCE } from "./formOfMeaningEdgeEvidence.js";
import { formOfMeaningEdgeCorrections } from "./formOfMeaningEdge.js";
import { PLURAL_GLOSS_EVIDENCE } from "./pluralGlossEvidence.js";
import { pluralGlossCorrections } from "./pluralGlossNumber.js";

/** The dimensions a correction can set, and the values each takes. */
export interface CorrectableValues {
  gender: "masculine" | "feminine";
  number: "singular" | "plural";
}

export type CorrectableDimension = keyof CorrectableValues;

/** The source text a correction overrides: what the record's line holds at `pointer`, verbatim. */
export interface OverriddenText {
  /** RFC 6901 into the record's line: `/tags/1`, or `/senses/0/glosses/0` for a gloss's "plurale di". */
  pointer: string;
  text: string;
}

/** One fact a correction sets, and the source text that stated it wrongly. */
export interface FactOverride<Dimension extends CorrectableDimension> {
  overrides: OverriddenText;
  value: CorrectableValues[Dimension];
}

/** A correction sets the gender, the number, or both; never neither. */
export type CorrectedFacts =
  | { gender: FactOverride<"gender">; number?: FactOverride<"number"> }
  | { gender?: FactOverride<"gender">; number: FactOverride<"number"> };

/** One Wiktionary page revision, and what it shows that settles the fact (src/italian/evidence.ts). */
export type { Evidence };

/** The record a correction is keyed to: a release's archive line, pinned by its digest. */
export interface CorrectedRecord {
  releaseId: string;
  lineNo: number;
  lineSha256: string;
  word: string;
  pos: string;
}

/** A record's own gender or number, set right (#420). */
export interface RecordCorrection {
  record: CorrectedRecord;
  facts: CorrectedFacts;
  /** At least one revision; a correction without evidence is not a correction. */
  evidence: readonly [Evidence, ...Evidence[]];
  entry?: never;
  edge?: never;
  cells?: never;
  hides?: never;
  hidesSense?: never;
  adjectiveForms?: never;
}

/** One cell of a verb's table, set right: the `forms[]` entry at `index`, whose `form` the line spells `replaces`. */
export interface CorrectedCell {
  /** Its place in the record's `forms[]`: the cell at `/forms/<index>/form`. */
  index: number;
  /** What the record's line holds there, verbatim: the wrong spelling. */
  replaces: string;
  /** The cell as it reads once corrected. */
  surface: string;
  /**
   * Set on a verb table's auxiliary cell, `avere` set to `essere` (#839). A
   * lookup never reaches that cell by its spelling (the auxiliary rule of
   * `SEARCH_SQL`, src/lookup/lookup.ts), so it names no word (`cellSpellings`).
   */
  auxiliary?: true;
}

/**
 * Cells of a record's table of forms, set right: a verb's conjugation (ADR
 * 0030, #723), or a noun's or adjective's listed forms (#830).
 */
export interface CellCorrection {
  record: CorrectedRecord;
  /** At least one cell, each at its own place. */
  cells: readonly [CorrectedCell, ...CorrectedCell[]];
  /** At least one revision; a correction without evidence is not a correction. */
  evidence: readonly [Evidence, ...Evidence[]];
  /** The ruling that added it, where the entry names it as data (#830 on); the earlier entries cite theirs beside them. */
  ruling?: RulingUrl;
  facts?: never;
  entry?: never;
  edge?: never;
  hides?: never;
  hidesSense?: never;
  adjectiveForms?: never;
}

/** An it.wiktionary page at one revision, and what it shows that settles the fact. */
export interface ItWiktionaryEvidence extends Evidence {
  wiki: "it.wiktionary.org";
}

/**
 * The two Wiktionary pages an edge correction cites, each at the revision the
 * archive was extracted from (dump `itwiktionary-20260701` for `it-0c432803`):
 * the record's own entry and the target's entry. Huey ruled on 2026-10-08
 * that an edge correction cites the Wiktionary pages it comes from, not lines
 * of Lexema's archive
 * (https://github.com/povlabs/lexema/issues/722#issuecomment-6058471600).
 */
export interface EdgeEvidence {
  /** The record's own page: it shows the gloss that names the target after "di". */
  form: ItWiktionaryEvidence;
  /** The target's page: its forms table lists the record's word. */
  base: ItWiktionaryEvidence;
}

/** The `form_of` edge a correction sets on one sense (ADR 0030). */
export interface CorrectedEdge {
  /** The sense's place in the record's `senses`. */
  sense: number;
  /**
   * The gloss that names the target after "di", verbatim: the sense's own,
   * `/senses/1/glosses/0`, or, for a meaning sense's edge pointed at its
   * record's base word (#755), the record's form sense's, `/senses/0/glosses/0`.
   */
  gloss: OverriddenText;
  /** The edge the source states on the sense, verbatim, when the correction replaces it (question 9); absent when the sense has none. */
  replaces?: OverriddenText;
  /** The word the edge names: the gloss's word after "di". */
  target: string;
  removes?: never;
}

/**
 * A sense's `form_of` edge, added where the source states none or replacing
 * one that names the wrong word (ADR 0030, #722). It cites two Wiktionary
 * pages: the record's own, whose gloss names the target after "di"
 * (`edge.gloss`), and the target's, whose forms table lists the word. ADR
 * 0030 takes the two together as the evidence, and neither alone.
 */
export interface EdgeCorrection {
  record: CorrectedRecord;
  edge: CorrectedEdge;
  evidence: EdgeEvidence;
  facts?: never;
  entry?: never;
  cells?: never;
  hides?: never;
  hidesSense?: never;
  adjectiveForms?: never;
}

/** The `form_of` edge a correction removes from one sense, whose gloss states a meaning, not a form (ADR 0030's 2026-10-09 amendment, #755). */
export interface RemovedEdge {
  /** The sense's place in the record's `senses`. */
  sense: number;
  /** The sense's own gloss, verbatim: `/senses/3/glosses/0`, "percosse". */
  gloss: OverriddenText;
  /** The edge the source states on the sense, verbatim, which the correction removes: `/senses/3/form_of/0/word`, "percosse". */
  removes: OverriddenText;
  target?: never;
  replaces?: never;
}

/** The page an edge removal cites: the record's own, at the revision the archive was extracted from, showing the sense's gloss. */
export interface RemovalEvidence {
  form: ItWiktionaryEvidence;
  base?: never;
}

/**
 * A sense's `form_of` edge, removed: its gloss states a meaning, so the word
 * the edge names is not a word the record is a form of (#755). A lookup reads
 * the sense as having no edge where the source states one. It cites the
 * record's own page, which shows the gloss.
 */
export interface EdgeRemoval {
  record: CorrectedRecord;
  edge: RemovedEdge;
  evidence: RemovalEvidence;
  facts?: never;
  entry?: never;
  cells?: never;
  hides?: never;
  hidesSense?: never;
  adjectiveForms?: never;
}

/** A correction of one sense's `form_of` edge: one that sets it, or one that removes it. Each is one `corrected_edge` row. */
export type SenseEdgeCorrection = EdgeCorrection | EdgeRemoval;

/** The page-only entry (ADR 0024) a definition correction is keyed to: the dump's revision of its page. */
export interface CorrectedPageEntry {
  wiki: "it.wiktionary.org";
  title: string;
  revisionId: number;
  pos: "verb";
}

/** The definition a correction stands in for, as that revision states it. */
export interface ReplacedDefinition {
  /** Its 0-based place among the entry's definitions (`entry_definition.definition_index`). */
  index: number;
  /** Its 1-based page line, and that line's wikitext, verbatim. */
  line: number;
  wikitext: string;
  /** The text the page shows for that line, verbatim: the wrong text. */
  text: string;
}

/** One definition of a page-only entry that the page states wrongly, set right (#450). */
export interface DefinitionCorrection {
  entry: CorrectedPageEntry;
  replaces: ReplacedDefinition;
  /** The corrected definition: Lexema's wording, drawn from the evidence and approved by Huey. */
  text: string;
  /** At least one revision; a correction without evidence is not a correction. */
  evidence: readonly [Evidence, ...Evidence[]];
  record?: never;
  facts?: never;
  edge?: never;
  cells?: never;
  hides?: never;
  hidesSense?: never;
  adjectiveForms?: never;
}

/** A ruling comment on a Lexema issue, by its permanent link. */
export type RulingUrl = `https://github.com/povlabs/lexema/issues/${number}#issuecomment-${number}`;

/** One Wiktionary page at one revision, cited as a whole. */
export type WiktionaryPage = Omit<ItWiktionaryEvidence, "shows">;

/** The recovered definition a hide names: one line of the record's own page, as the cited revision states it. */
export interface HiddenRecoveredLine {
  /** Its 1-based page line (`recovered_definition.page_line`), and that line's wikitext, verbatim. */
  line: number;
  wikitext: string;
  /** The text the recovered layer reads off that line, verbatim: the text the hide keeps off the page. */
  text: string;
}

/** What a hide cites: the record's own page at the revision the line was read from, which shows it, and the ruling that hides it. */
export interface HideEvidence {
  page: WiktionaryPage;
  ruling: RulingUrl;
}

/**
 * One recovered definition, hidden: its line states no dictionary word, only
 * keyboard test text (#773, ADR 0030's amendment of 2026-10-09). It names the
 * record the definition was recovered for, and the line by its place on the
 * cited page revision with its wikitext and text verbatim. A lookup reads the
 * record as having no such definition; the `recovered_definition` row stays.
 */
export interface RecoveredDefinitionHide {
  record: CorrectedRecord;
  hides: HiddenRecoveredLine;
  evidence: HideEvidence;
  facts?: never;
  entry?: never;
  edge?: never;
  cells?: never;
  hidesSense?: never;
  adjectiveForms?: never;
}

/** The sense a sense hide names: its place in the record's `senses`, its one gloss, and the page line it was read from. */
export interface HiddenSense {
  /** Its place in the record's `senses`: the sense at `/senses/<index>`. */
  index: number;
  /** Its gloss as the record's line holds it, verbatim: `/senses/0/glosses/0`, "Ultima_Sfaccim". The sense has no other gloss. */
  gloss: OverriddenText;
  /** The 1-based line of the record's own page the sense was read from, and that line's wikitext, verbatim. */
  line: number;
  wikitext: string;
}

/**
 * One sense of a record, hidden: its line on the page states no definition,
 * only a stray link (#857, ADR 0030's amendment of 2026-10-17). It names the
 * record, and the sense by its place in the record's `senses` with its one
 * gloss verbatim; it cites the page line the sense was read from, at the
 * revision in the dump the archive was extracted from, and the ruling. A
 * lookup reads the record as having no such sense; the `sense` row and its
 * gloss stay.
 */
export interface SenseHide {
  record: CorrectedRecord;
  hidesSense: HiddenSense;
  evidence: HideEvidence;
  facts?: never;
  entry?: never;
  edge?: never;
  cells?: never;
  hides?: never;
  adjectiveForms?: never;
}

/** A form an adjective's table lacks, added (#836): its spelling, and the gender and number it agrees in. */
export interface AddedForm {
  surface: string;
  gender: CorrectableValues["gender"];
  number: CorrectableValues["number"];
}

/** A `forms[]` entry of the record that is no form of the adjective, removed (#836). */
export interface RemovedForm {
  /** Its place in the record's `forms[]`: the entry at `/forms/<index>`. */
  index: number;
  /** What the record's line holds at `/forms/<index>/form`, verbatim: `quelli`, the pronoun's plural. */
  removes: string;
}

/** What an adjective-forms correction does to the table: it adds forms, removes forms, or both; never neither. */
export type AdjectiveFormChanges =
  | { adds: readonly [AddedForm, ...AddedForm[]]; removes?: readonly [RemovedForm, ...RemovedForm[]] }
  | { adds?: readonly [AddedForm, ...AddedForm[]]; removes: readonly [RemovedForm, ...RemovedForm[]] };

/**
 * An adjective's table of forms, set right by adding the forms it lacks and
 * removing the ones that are not its own (#836, ADR 0027's amendment of
 * 2026-10-17). `quello`'s adjective record gains `quel`, `quell'`, `quei`
 * and `quegli` and loses `quelli`, its pronoun's plural. It cites the pages
 * that list the forms, and the ruling. A lookup reads the record's own forms
 * beside it; `lookup_form` and `source_record_json` stay as imported.
 */
export interface AdjectiveFormsCorrection {
  record: CorrectedRecord & { pos: "adj" };
  adjectiveForms: AdjectiveFormChanges;
  /** At least one revision; a correction without evidence is not a correction. */
  evidence: readonly [Evidence, ...Evidence[]];
  ruling: RulingUrl;
  facts?: never;
  entry?: never;
  edge?: never;
  cells?: never;
  hides?: never;
  hidesSense?: never;
}

/** One entry of the curated list: a record's gender or number, cells of its table of forms, a sense's `form_of` edge set or removed, a page-only entry's definition, a recovered definition hidden, a sense hidden, or an adjective's forms added and removed. */
export type CuratedCorrection =
  | RecordCorrection
  | CellCorrection
  | EdgeCorrection
  | EdgeRemoval
  | DefinitionCorrection
  | RecoveredDefinitionHide
  | SenseHide
  | AdjectiveFormsCorrection;

/** An entry keyed to one archive line as a whole: a record's gender or number, or cells of its table. */
export type LineCorrection = RecordCorrection | CellCorrection;

export const isDefinitionCorrection = (correction: CuratedCorrection): correction is DefinitionCorrection =>
  correction.entry !== undefined;

export const isCellCorrection = (correction: CuratedCorrection): correction is CellCorrection =>
  correction.cells !== undefined;

export const isEdgeCorrection = (correction: CuratedCorrection): correction is EdgeCorrection => correction.edge?.target !== undefined;

export const isEdgeRemoval = (correction: CuratedCorrection): correction is EdgeRemoval => correction.edge?.removes !== undefined;

const isSenseEdgeCorrection = (correction: CuratedCorrection): correction is SenseEdgeCorrection => correction.edge !== undefined;

export const isRecoveredHide = (correction: CuratedCorrection): correction is RecoveredDefinitionHide => correction.hides !== undefined;

export const isSenseHide = (correction: CuratedCorrection): correction is SenseHide => correction.hidesSense !== undefined;

export const isAdjectiveFormsCorrection = (correction: CuratedCorrection): correction is AdjectiveFormsCorrection => correction.adjectiveForms !== undefined;

/** The entries of `corrections` that correct a record's gender or number. */
export const recordCorrections = (corrections: readonly CuratedCorrection[]): RecordCorrection[] =>
  corrections.filter((correction): correction is RecordCorrection => correction.facts !== undefined);

/** The entries of `corrections` that correct cells of a record's table. */
export const cellCorrections = (corrections: readonly CuratedCorrection[]): CellCorrection[] =>
  corrections.filter(isCellCorrection);

/**
 * The spellings whose lookup reads differently once `correction`'s cells are
 * set: each cell's corrected spelling, which now finds the record, and the
 * spelling it retires, which no longer does. `eguali` and `equivalenti` for
 * eguale's plural (#830). An auxiliary cell names neither, since no lookup
 * reaches it by its spelling.
 */
export const cellSpellings = (correction: CellCorrection): string[] =>
  correction.cells.flatMap((cell) => (cell.auxiliary ? [] : [cell.surface, cell.replaces]));

/** The entries of `corrections` keyed to an archive line as a whole, in list order. */
export const lineCorrections = (corrections: readonly CuratedCorrection[]): LineCorrection[] =>
  corrections.filter((correction): correction is LineCorrection => correction.facts !== undefined || correction.cells !== undefined);

/** The entries of `corrections` that set a sense's `form_of` edge. */
export const edgeCorrections = (corrections: readonly CuratedCorrection[]): EdgeCorrection[] => corrections.filter(isEdgeCorrection);

/** The entries of `corrections` that remove a sense's `form_of` edge (#755). */
export const edgeRemovals = (corrections: readonly CuratedCorrection[]): EdgeRemoval[] => corrections.filter(isEdgeRemoval);

/** The entries of `corrections` that set or remove a sense's `form_of` edge, in list order: what `corrected_edge` holds. */
export const senseEdgeCorrections = (corrections: readonly CuratedCorrection[]): SenseEdgeCorrection[] => corrections.filter(isSenseEdgeCorrection);

/** The entries of `corrections` that correct a page-only entry's definition. */
export const definitionCorrections = (corrections: readonly CuratedCorrection[]): DefinitionCorrection[] =>
  corrections.filter(isDefinitionCorrection);

/** The entries of `corrections` that hide a recovered definition (#773). */
export const recoveredHides = (corrections: readonly CuratedCorrection[]): RecoveredDefinitionHide[] => corrections.filter(isRecoveredHide);

/** The entries of `corrections` that hide a sense of a record (#857). */
export const senseHides = (corrections: readonly CuratedCorrection[]): SenseHide[] => corrections.filter(isSenseHide);

/** The entries of `corrections` that add and remove an adjective's forms (#836). */
export const adjectiveFormsCorrections = (corrections: readonly CuratedCorrection[]): AdjectiveFormsCorrection[] =>
  corrections.filter(isAdjectiveFormsCorrection);

/** One form an adjective-forms correction writes: an added form, or a removed one. Each is one `corrected_adjective_form` row. */
export type AdjectiveFormRow = { added: AddedForm; removed?: never } | { removed: RemovedForm; added?: never };

/** The forms `correction` writes, in row order: the added forms in list order, then the removed ones. */
export const adjectiveFormRows = (correction: AdjectiveFormsCorrection): AdjectiveFormRow[] => [
  ...(correction.adjectiveForms.adds ?? []).map((added) => ({ added })),
  ...(correction.adjectiveForms.removes ?? []).map((removed) => ({ removed })),
];

/** Why an adjective-forms correction does not match the record's line it names. */
export type AdjectiveFormsMisquote =
  /** The line is not an adjective's record. */
  | "not-an-adjective"
  /** A removed form's place in `forms[]` does not hold the text the entry quotes. */
  | "removed-form-differs"
  /** An added form is already on the line, at the same spelling, gender and number: nothing to add. */
  | "form-already-listed"
  /** The entry adds one form twice. */
  | "form-added-twice";

/**
 * Whether `correction` quotes `line`, the record's archive line it names: an
 * adjective's record, each removed form at its place with the text it
 * quotes, and each added form one the line does not list already. The digest
 * already pins the line, so any answer but `undefined` is an entry that
 * misquotes its own record, and nothing writes it.
 */
export function adjectiveFormsMisquote(correction: AdjectiveFormsCorrection, line: string): AdjectiveFormsMisquote | undefined {
  const record = JSON.parse(line) as { pos?: unknown; forms?: { form?: unknown; tags?: unknown[] }[] };
  if (record.pos !== "adj") return "not-an-adjective";
  const forms = record.forms ?? [];
  const { adds = [], removes = [] } = correction.adjectiveForms;
  if (removes.some((removed) => forms[removed.index]?.form !== removed.removes)) return "removed-form-differs";
  const listed = (added: AddedForm): boolean =>
    forms.some((form) => form.form === added.surface && (form.tags ?? []).includes(added.gender) && (form.tags ?? []).includes(added.number));
  if (adds.some(listed)) return "form-already-listed";
  const keys = adds.map((added) => `${added.surface} ${added.gender} ${added.number}`);
  if (new Set(keys).size !== keys.length) return "form-added-twice";
  return undefined;
}

/** Why a sense hide does not match the record's line it names. */
export type SenseHideMisquote =
  /** The line holds no sense at the hide's place. */
  | "no-sense"
  /** The sense's glosses are not the one gloss the hide quotes, at its pointer. */
  | "gloss-differs"
  /** The sense declares a `form_of` edge: hiding it would leave an edge to a sense no page shows. */
  | "sense-has-edge";

/**
 * Whether `hide` quotes `line`, the record's archive line it names: a sense
 * at its place whose only gloss is the one it quotes, at the pointer it
 * names, and which declares no `form_of` edge. The digest already pins the
 * line, so any answer but `undefined` is an entry that misquotes its own
 * record, and nothing writes it.
 */
export function senseHideMisquote(hide: SenseHide, line: string): SenseHideMisquote | undefined {
  const { index, gloss } = hide.hidesSense;
  const sense = ((JSON.parse(line) as { senses?: { glosses?: unknown[]; form_of?: unknown[] }[] }).senses ?? [])[index];
  if (sense === undefined) return "no-sense";
  const glosses = sense.glosses ?? [];
  if (gloss.pointer !== `/senses/${index}/glosses/0` || glosses.length !== 1 || glosses[0] !== gloss.text) return "gloss-differs";
  if ((sense.form_of ?? []).length > 0) return "sense-has-edge";
  return undefined;
}

/** One recovered definition of a record as a dictionary holds it: the page revision it was read from, its line, and that line's wikitext and text. */
export interface RecoveredLine extends HiddenRecoveredLine {
  revisionId: number;
}

/** Why a hide does not reach a record's recovered definitions. */
export type HideMismatch =
  /** The record's definitions were read from another revision of its page: a later dump changed it. */
  | "revision-differs"
  /** Same revision and line, but not the wikitext or text the hide quotes. */
  | "line-differs"
  /** No recovered definition at that line: the rule no longer reads it, or the record has none. */
  | "row-gone";

/**
 * Whether `hide` reaches `recovered`, the recovered definitions of its
 * record: only the line it names, read from the revision it cites, with the
 * very wikitext and text it quotes. Anything else is a line the hide was never
 * checked against, which may state a real definition (ADR 0025).
 */
export function hideMismatch(hide: RecoveredDefinitionHide, recovered: readonly RecoveredLine[]): HideMismatch | undefined {
  const { revisionId } = hide.evidence.page;
  const { line, wikitext, text } = hide.hides;
  const named = recovered.find((definition) => definition.revisionId === revisionId && definition.line === line);
  if (named !== undefined) return named.wikitext === wikitext && named.text === text ? undefined : "line-differs";
  return recovered.some((definition) => definition.revisionId !== revisionId) ? "revision-differs" : "row-gone";
}

/** A page-only entry as a dictionary holds it: its page revision and its definitions, in place order. */
export interface PageEntryDefinitions {
  revisionId: number;
  definitions: readonly { line: number; wikitext: string; text: string }[];
}

/** Why a definition correction does not reach a page-only entry of its title. */
export type DefinitionMismatch =
  /** The entry was read from another revision of the page: a later dump changed it. */
  | "revision-differs"
  /** Same revision, but the definition at the correction's place is not the one it quotes. */
  | "definition-differs";

/**
 * Whether `correction` reaches `entry`, an entry of its title: only the
 * revision it was checked against, with the very line and text it quotes at
 * its place. Anything else is a page the correction was never checked
 * against, which may say something else (ADR 0025).
 */
export function definitionMismatch(correction: DefinitionCorrection, entry: PageEntryDefinitions): DefinitionMismatch | undefined {
  if (entry.revisionId !== correction.entry.revisionId) return "revision-differs";
  const definition = entry.definitions[correction.replaces.index];
  const { line, wikitext, text } = correction.replaces;
  if (definition?.line !== line || definition.wikitext !== wikitext || definition.text !== text) return "definition-differs";
  return undefined;
}

/**
 * A correction's id, stored on each of its rows: a record's release and
 * archive line, `it-0c432803:449969`; the same and `:cells` for cells of its
 * table, `it-0c432803:113784:cells`, so one record may carry both kinds; for
 * an edge set or removed, also its sense, `it-0c432803:77162/senses/1`;
 * for a recovered definition hidden, also its page line,
 * `it-0c432803:573791/page-line/3`; for a sense hidden, its sense and
 * `/hidden`, `it-0c432803:96753/senses/0/hidden`, so it never reads as an
 * edge of that sense; for an adjective's forms added and removed, `:forms`,
 * `it-0c432803:33211:forms`; or a definition's page revision and place,
 * `page:3906191:0`.
 */
export function correctionId(correction: CuratedCorrection): string {
  if (isDefinitionCorrection(correction)) return `page:${correction.entry.revisionId}:${correction.replaces.index}`;
  const line = `${correction.record.releaseId}:${correction.record.lineNo}`;
  if (isSenseEdgeCorrection(correction)) return `${line}/senses/${correction.edge.sense}`;
  if (isRecoveredHide(correction)) return `${line}/page-line/${correction.hides.line}`;
  if (isSenseHide(correction)) return `${line}/senses/${correction.hidesSense.index}/hidden`;
  if (isAdjectiveFormsCorrection(correction)) return `${line}:forms`;
  return `${line}${isCellCorrection(correction) ? ":cells" : ""}`;
}

/** A permanent link to the revision (src/italian/evidence.ts). */
export { evidenceUrl };

/** One fact a correction sets, flattened: what a `corrected_claim` row stores. */
export interface CorrectedFact {
  dimension: CorrectableDimension;
  value: string;
  overrides: OverriddenText;
}

/** The facts a correction sets, gender first. */
export function correctedFacts(correction: RecordCorrection): CorrectedFact[] {
  const { gender, number } = correction.facts;
  return [
    ...(gender === undefined ? [] : [{ dimension: "gender" as const, ...gender }]),
    ...(number === undefined ? [] : [{ dimension: "number" as const, ...number }]),
  ];
}

const IT = "it-0c432803";

const PARTI: CorrectedRecord = { releaseId: IT, lineNo: 77162, lineSha256: "82f272443a694ca4619ed61e5d9ef96aed36c4fa1204731e5cbe8405648dccd2", word: "parti", pos: "noun" };
/** `parti`'s page at its revision in dump `itwiktionary-20260701`, which `it-0c432803` was extracted from (#701). */
const PARTI_PAGE = { wiki: "it.wiktionary.org", title: "parti", revisionId: 3948893 } as const;
/** `parto`'s page at its revision in the same dump: its forms table lists `parti`. */
const PARTO_LISTS_PARTI: ItWiktionaryEvidence = { wiki: "it.wiktionary.org", title: "parto", revisionId: 3892725, shows: "parti" };
/** `parti`'s page showing `gloss`, and `parto`'s page listing `parti`. */
const partoEvidence = (gloss: string): EdgeEvidence => ({ form: { ...PARTI_PAGE, shows: gloss }, base: PARTO_LISTS_PARTI });
const PARTO_BIRTH = "plurale di parto, nell'accezione di atto biologico di espulsione dal grembo materno di un neonato";
const PARTO_PARTHIAN = "plurale di parto, nell'accezione di persona della popolazione dei Parti";

const tag = (index: number, text: string): OverriddenText => ({ pointer: `/tags/${index}`, text });
const firstGloss = (text: string): OverriddenText => ({ pointer: "/senses/0/glosses/0", text });
/** A real plural whose record is tagged singular at `/tags/<index>` (#449). */
const plural = (index: number): CorrectedFacts => ({ number: { overrides: tag(index, "singular"), value: "plural" } });

/**
 * A plural essere cell of `assorbire` (#723). The line spells it `<auxiliary>
 * assorbito, assorti, assorti`, and it reads `<auxiliary> assorbiti, assorti`:
 * the plural participle first, as in every other plural essere cell, and the
 * second spelling once. `it-essere-agreement/v2` then shows its feminine too.
 */
const assorbireCell = (index: number, auxiliary: string): CorrectedCell => ({
  index,
  replaces: `${auxiliary} assorbito, assorti, assorti`,
  surface: `${auxiliary} assorbiti, assorti`,
});

/** Six spellings of one tense, by row: io, tu, lui/lei, noi, voi, loro. */
type SixRows = readonly [string, string, string, string, string, string];

/** The pronoun before a pronominal verb's finite form, by row. */
const PRONOUNS: SixRows = ["mi", "ti", "si", "ci", "vi", "si"];

/**
 * The compound tenses of an `{{It-conj}}` table, in the order its `forms[]`
 * lists them: each one's first row, counted from the table's first compound
 * cell (passato prossimo `io`), the auxiliary the pages of #839 build it on,
 * and the one essere builds it on. The three simple tenses of the condizionale
 * and congiuntivo sit between them, so the offsets skip 6 and 12 cells.
 */
const COMPOUND_TENSES_ON_AVERE: readonly { offset: number; avere: SixRows; essere: SixRows }[] = [
  // indicativo: passato prossimo, trapassato prossimo, trapassato remoto, futuro anteriore
  { offset: 0, avere: ["ho", "hai", "ha", "abbiamo", "avete", "hanno"], essere: ["sono", "sei", "è", "siamo", "siete", "sono"] },
  { offset: 6, avere: ["avevo", "avevi", "aveva", "avevamo", "avevate", "avevano"], essere: ["ero", "eri", "era", "eravamo", "eravate", "erano"] },
  { offset: 12, avere: ["ebbi", "avesti", "ebbe", "avemmo", "aveste", "ebbero"], essere: ["fui", "fosti", "fu", "fummo", "foste", "furono"] },
  { offset: 18, avere: ["avrò", "avrai", "avrà", "avremo", "avrete", "avranno"], essere: ["sarò", "sarai", "sarà", "saremo", "sarete", "saranno"] },
  // condizionale passato
  { offset: 30, avere: ["avrei", "avresti", "avrebbe", "avremmo", "avreste", "avrebbero"], essere: ["sarei", "saresti", "sarebbe", "saremmo", "sareste", "sarebbero"] },
  // congiuntivo: passato, trapassato
  { offset: 48, avere: ["abbia", "abbia", "abbia", "abbiamo", "abbiate", "abbiano"], essere: ["sia", "sia", "sia", "siamo", "siate", "siano"] },
  { offset: 54, avere: ["avessi", "avessi", "avesse", "avessimo", "aveste", "avessero"], essere: ["fossi", "fossi", "fosse", "fossimo", "foste", "fossero"] },
];

/** A pronominal verb's table whose conjugation page builds it on avere (#839). */
interface AvereTable {
  record: CorrectedRecord;
  /** The page's revision in dump `itwiktionary-20260701`, and its `{{It-conj}}` call, verbatim. */
  page: { revisionId: number; call: string };
  /** The place in `forms[]` of the auxiliary cell, `avere`, and of passato prossimo `io`. */
  auxiliary: number;
  firstCompound: number;
  /** The past participle, masculine singular: `abbagliato`. */
  participle: string;
  /** A second spelling the page's `pp2` adds after the participle in every compound cell: `sottomessosi`. */
  secondParticiple?: string;
}

/**
 * The cells of a pronominal table on avere, set on essere (#839): the
 * auxiliary `avere` reads `essere`, and each compound cell, `mi ho abbagliato`,
 * reads `mi sono abbagliato`, its participle plural on a plural row, as rule
 * `it-pronominal-conjugation/v1` builds it from the base verb's cell. A
 * second spelling the page's `pp2` adds is not part of what the rule builds,
 * and the cell drops it. It cites the page the table came from, which builds
 * every one of those cells on avere: the page carries the error.
 */
function onEssere(table: AvereTable): CellCorrection {
  const { record, page, auxiliary, firstCompound, participle, secondParticiple } = table;
  const plural = `${participle.slice(0, -1)}i`;
  const compound = COMPOUND_TENSES_ON_AVERE.flatMap(({ offset, avere, essere }) =>
    PRONOUNS.map((pronoun, row): CorrectedCell => ({
      index: firstCompound + offset + row,
      replaces: `${pronoun} ${avere[row]} ${participle}${secondParticiple === undefined ? "" : `, ${secondParticiple}`}`,
      surface: `${pronoun} ${essere[row]} ${row < 3 ? participle : plural}`,
    })),
  );
  return {
    record,
    cells: [{ index: auxiliary, replaces: "avere", surface: "essere", auxiliary: true }, ...compound],
    evidence: [{ wiki: "it.wiktionary.org", title: `Appendice:Coniugazioni/Italiano/${record.word}`, revisionId: page.revisionId, shows: page.call }],
  };
}

const SUDDIVIDERSI_PAGE = {
  revisionId: 1871323,
  call: "{{It-conj|suddivid|ersi|avere|\npp=suddiviso|pp2=suddivisosi|\nprem1s=suddivisi|prem3s=suddivise|prem3s2=''|prem3p=suddivisero|prem3p2=''\n}}",
};

/** The entries written by hand. Add an entry only with its evidence, and only on a ruling. */
export const HAND_CORRECTIONS: readonly CuratedCorrection[] = [
  {
    record: { releaseId: IT, lineNo: 17564, lineSha256: "79650fc40a3d288aa01b50197e66dcb4fa6d0a81fa2065bdf3a01d156e6dc8cd", word: "fiaschetteria", pos: "noun" },
    facts: { gender: { overrides: tag(0, "masculine"), value: "feminine" } },
    evidence: [
      { wiki: "en.wiktionary.org", title: "fiaschetteria", revisionId: 90584835, shows: "{{it-noun|f}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 138314, lineSha256: "d8504c0e1c66596e314528f0a7ef5f1f41ac68f23ccc433e353aed27f9381e51", word: "fissazione", pos: "noun" },
    facts: { gender: { overrides: tag(0, "masculine"), value: "feminine" } },
    evidence: [
      { wiki: "en.wiktionary.org", title: "fissazione", revisionId: 90568134, shows: "{{it-noun|f}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 244674, lineSha256: "98150b3702e89aecbfe5c0cd9633e034a23e9ffe104bab34f1eb43508b76a6c8", word: "rimbalzo", pos: "noun" },
    facts: { gender: { overrides: tag(0, "feminine"), value: "masculine" } },
    evidence: [
      { wiki: "en.wiktionary.org", title: "rimbalzo", revisionId: 71135348, shows: "{{it-noun|m}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 423567, lineSha256: "d98a944fee38e10b3a6586df1dbac0a0467094b4c1ca43dc17ea808cea8c9a81", word: "giocatrici", pos: "noun" },
    facts: { gender: { overrides: tag(1, "masculine"), value: "feminine" } },
    evidence: [
      { wiki: "it.wiktionary.org", title: "giocatrice", revisionId: 3695021, shows: "{{-sost form-|it}} {{Pn}} '' f sing''" },
      { wiki: "en.wiktionary.org", title: "giocatrice", revisionId: 71373720, shows: "{{it-noun|f}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 447845, lineSha256: "a3582f36838123e27bf09338b34f22f57e98654d00a794ea59a32b1f336e4e6c", word: "predatrici", pos: "noun" },
    facts: { gender: { overrides: tag(1, "masculine"), value: "feminine" } },
    evidence: [
      { wiki: "it.wiktionary.org", title: "predatore", revisionId: 3976963, shows: "{{Tabs|predatore|predatori|predatrice|predatrici}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 449250, lineSha256: "adf585d57d7f9b5700e5f87e414ca0d424eed2b87f7b9aee0be7e97a86e84481", word: "sudafricana", pos: "noun" },
    facts: { number: { overrides: firstGloss("plurale di sudafricano"), value: "singular" } },
    evidence: [
      { wiki: "it.wiktionary.org", title: "sudafricano", revisionId: 3957423, shows: "{{Tabs|sudafricano|sudafricani|sudafricana|sudafricane}}" },
      { wiki: "en.wiktionary.org", title: "sudafricana", revisionId: 84291671, shows: "{{it-noun|f}} # {{female equivalent of|it|sudafricano}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 449969, lineSha256: "64238ccdbc3b7cc39c8f3544cbe423f9e9ac5c34708a015b2bc2d3484612d54b", word: "ammaliatrice", pos: "noun" },
    facts: { number: { overrides: firstGloss("plurale di ammaliatore"), value: "singular" } },
    evidence: [
      { wiki: "it.wiktionary.org", title: "ammaliatore", revisionId: 3256005, shows: "{{Tabs|ammaliatore|ammaliatori|ammaliatrice|ammaliatrici}}" },
      { wiki: "en.wiktionary.org", title: "ammaliatrice", revisionId: 60757213, shows: "{{it-noun|f}} # {{female equivalent of|it|ammaliatore}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 453220, lineSha256: "dcbbfcec05b979039a8f688eb99b1399ff4512d6c9b770b1ab49fe6c37f4f67f", word: "congiuntivi", pos: "noun" },
    facts: {
      gender: { overrides: tag(0, "feminine"), value: "masculine" },
      number: { overrides: tag(2, "singular"), value: "plural" },
    },
    evidence: [
      { wiki: "it.wiktionary.org", title: "congiuntivo", revisionId: 3890350, shows: "{{-sost-|it}} {{Pn|w}} ''m sing''; {{Tabs|congiuntivo|congiuntivi|congiuntiva|congiuntive}}" },
      { wiki: "en.wiktionary.org", title: "congiuntivo", revisionId: 88502924, shows: "===Noun=== {{it-noun|m}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 462691, lineSha256: "0dbbebb11ad5a040b0587663b3446eeb9a465e20b36e27f0f18ab85c7f4ce9d9", word: "nozione", pos: "noun" },
    facts: { gender: { overrides: tag(0, "masculine"), value: "feminine" } },
    evidence: [
      { wiki: "en.wiktionary.org", title: "nozione", revisionId: 93134164, shows: "{{it-noun|f}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 584883, lineSha256: "a07ce171b76355c0ae4b5135a341fdb88fa3978519e954c5a525173df6505c42", word: "amorevolezze", pos: "noun" },
    facts: { gender: { overrides: tag(1, "masculine"), value: "feminine" } },
    evidence: [
      { wiki: "it.wiktionary.org", title: "amorevolezza", revisionId: 3982133, shows: "{{-sost-|it}} {{Pn}}  ''f sing''" },
      { wiki: "en.wiktionary.org", title: "amorevolezza", revisionId: 90578054, shows: "{{it-noun|f}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 595081, lineSha256: "9b1109b0e183359fc4e15b611eeb555664aa254af2fb9ce97e0dca747206ffe3", word: "maniaci", pos: "noun" },
    facts: {
      gender: { overrides: tag(0, "feminine"), value: "masculine" },
      number: { overrides: tag(2, "singular"), value: "plural" },
    },
    evidence: [
      { wiki: "it.wiktionary.org", title: "maniaco", revisionId: 4011461, shows: "{{-sost-|it}} {{Pn}} ''m sing''; {{Tabs|maniaco|maniaci|maniaca|maniaci}}" },
      { wiki: "en.wiktionary.org", title: "maniaco", revisionId: 88485155, shows: "===Noun=== {{it-noun|m|f=+}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 605508, lineSha256: "a5a37edf4f6cbc5abd12f192297cdb721ab7bcb4eb5d73996e9ab1eb0a74a485", word: "romantica", pos: "noun" },
    facts: { number: { overrides: firstGloss("plurale di romantico"), value: "singular" } },
    evidence: [
      { wiki: "it.wiktionary.org", title: "romantico", revisionId: 4011823, shows: "{{Tabs|romantico|romantici|romantica|romantiche}}" },
      { wiki: "en.wiktionary.org", title: "romantica", revisionId: 90337391, shows: "===Noun=== {{it-noun|f}} # {{female equivalent of|it|romantico}}" },
    ],
  },
  // #449: real plurals tagged singular, set to plural.
  {
    record: { releaseId: IT, lineNo: 53931, lineSha256: "5c71cd082fe584bde19f1c7f0926910771f11531aae14ea102169505a7a3eafa", word: "scolare", pos: "noun" },
    facts: plural(2),
    evidence: [
      { wiki: "it.wiktionary.org", title: "scolare", revisionId: 3879641, shows: "{{-sost form-|it}} {{Pn}} ''f sing'' {{Tabs|scolaro|scolari|scolara|scolare}} # plurale di [[scolara]]" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 90588, lineSha256: "623df5fab95b9a83a210ca90b5f245e3ae0f4a72c6d0d97fcf9a930286164cf4", word: "ricoverati", pos: "noun" },
    facts: plural(2),
    evidence: [
      { wiki: "it.wiktionary.org", title: "ricoverati", revisionId: 3869797, shows: "{{-sost form-|it}} {{Pn}} ''m sing'' {{Tabs|ricoverato|ricoverati|ricoverata|ricoverate}} # plurale maschile di [[ricoverato]]" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 439467, lineSha256: "232dac803227560a5661589ad8efea4a43c902b4141dfbcb666f4ed8d8b69737", word: "portatrici", pos: "noun" },
    facts: plural(2),
    evidence: [
      { wiki: "en.wiktionary.org", title: "portatrici", revisionId: 62806891, shows: "===Noun=== {{head|it|noun form|g=f}} # {{plural of|it|portatrice}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 447524, lineSha256: "a2ed8543187f3e0e81625636473bcf3a737b8bcec20ea008c106032c5d31263a", word: "mosse", pos: "noun" },
    facts: plural(2),
    evidence: [
      { wiki: "en.wiktionary.org", title: "mosse", revisionId: 92438364, shows: "====Noun==== {{head|it|noun form|g=f-p}} # {{plural of|it|mossa}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 449506, lineSha256: "f24ce401f420d8d546a0d9c5ed13794534ca4dab613526e01053fbae4558adde", word: "costruttrici", pos: "noun" },
    facts: plural(2),
    evidence: [
      { wiki: "it.wiktionary.org", title: "costruttrici", revisionId: 3279198, shows: "{{-sost form-|it}} {{Pn}} ''f sing'' {{Tabs|costruttore|costruttori|costruttrice|costruttrici}} #plurale di [[costruttrice]]" },
      { wiki: "en.wiktionary.org", title: "costruttrici", revisionId: 63070366, shows: "===Noun=== {{head|it|noun form|g=f}} # {{plural of|it|costruttrice}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 596016, lineSha256: "0e176579819b32c7ae855745e25b808f0b502e9ccf1a4c79321f181ce793df3e", word: "curde", pos: "noun" },
    facts: plural(2),
    evidence: [
      { wiki: "it.wiktionary.org", title: "curde", revisionId: 3860884, shows: "{{-sost form-|it}} {{Pn}} ''f sing'' {{Tabs|curdo|curdi|curda|curde}}" },
      { wiki: "en.wiktionary.org", title: "curde", revisionId: 92322356, shows: "===Noun=== {{head|it|noun form|g=f}} # {{plural of|it|curda}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 599446, lineSha256: "ffa06e61b7476047224fd5888ad3479f21b4b25faf29571d0581b2bc909c141f", word: "anfitrioni", pos: "noun" },
    facts: plural(2),
    evidence: [
      { wiki: "it.wiktionary.org", title: "anfitrioni", revisionId: 3889151, shows: "{{-sost form-|it}} {{Pn}} ''m sing'' {{Tabs|anfitrione|anfitrioni|anfitriona|anfitrione}} #plurale di [[anfitrione]]" },
      { wiki: "en.wiktionary.org", title: "anfitrioni", revisionId: 62798877, shows: "===Noun=== {{head|it|noun form|g=m}} # {{plural of|it|anfitrione}}" },
    ],
  },
  {
    record: { releaseId: IT, lineNo: 605544, lineSha256: "32b50f544c93c1f858526ef6cec905b3387b388a9049045e0952f9554b4a0d04", word: "scontente", pos: "noun" },
    facts: plural(2),
    evidence: [
      { wiki: "it.wiktionary.org", title: "scontente", revisionId: 3959957, shows: "{{-sost form-|it}} {{Pn}} ''f sing'' {{Tabs|scontento|scontenti|scontenta|scontente}} #femminile plurale di [[scontento]]" },
    ],
  },
  // Huey's ruling on #708, question 9, 2026-10-07 (ADR 0030): `parti`'s two
  // senses about `parto` name `neonato` and `Parti`, and parto's table lists parti.
  {
    record: PARTI,
    edge: {
      sense: 1,
      gloss: { pointer: "/senses/1/glosses/0", text: PARTO_BIRTH },
      replaces: { pointer: "/senses/1/form_of/0/word", text: "neonato" },
      target: "parto",
    },
    evidence: partoEvidence(PARTO_BIRTH),
  },
  {
    record: PARTI,
    edge: {
      sense: 2,
      gloss: { pointer: "/senses/2/glosses/0", text: PARTO_PARTHIAN },
      replaces: { pointer: "/senses/2/form_of/0/word", text: "Parti" },
      target: "parto",
    },
    evidence: partoEvidence(PARTO_PARTHIAN),
  },
  // Huey's rulings on #450, 2026-10-03: correct both, with wording the builder drafts and he approves.
  {
    entry: { wiki: "it.wiktionary.org", title: "grufolare", revisionId: 3906191, pos: "verb" },
    // The sound pigs make is grugnire's sense; grufolare is rooting about with the snout.
    replaces: { index: 0, line: 4, wikitext: "# [[verso]] prodotto dai [[suini]]", text: "verso prodotto dai suini" },
    text: "frugare nel terreno con il grugno, come fa il maiale in cerca di cibo",
    evidence: [
      { wiki: "en.wiktionary.org", title: "grufolare", revisionId: 71335228, shows: "# {{lb|it|intransitive}} to [[root]] about" },
      { wiki: "it.wiktionary.org", title: "grugnire", revisionId: 3977394, shows: "# ''(maiale)'' [[emettere]] grugniti" },
    ],
  },
  {
    entry: { wiki: "it.wiktionary.org", title: "tremare", revisionId: 4002473, pos: "verb" },
    // A fragment with no verb. Sense 2, `# {{Fig}} essere agitato da scosse continue`, is right and stays.
    replaces: {
      index: 0,
      line: 4,
      wikitext: "#convulso dei muscoli per effetto del freddo, della paura, di una malattia",
      text: "convulso dei muscoli per effetto del freddo, della paura, di una malattia",
    },
    text: "essere scosso da piccoli movimenti involontari e ripetuti dei muscoli, per effetto del freddo, della paura o di una malattia",
    evidence: [
      { wiki: "en.wiktionary.org", title: "tremare", revisionId: 88487832, shows: "# {{lb|it|intransitive}} to [[tremble]], [[shake]], [[shiver]], [[shudder]]" },
      { wiki: "it.wiktionary.org", title: "tremare", revisionId: 4002473, shows: "{{Trad1|fare movimenti avanti e indietro in rapida successione}}; ''(per freddo, febbre)'' [[rabbrividire]]" },
    ],
  },
  // Huey's rulings on #723, 2026-10-08: the regular essere spelling in all 21
  // plural essere cells, though no page shows it, citing the Wiktionary page
  // the cells came from, which carries the same error (ADR 0030's amendment).
  {
    record: { releaseId: IT, lineNo: 113784, lineSha256: "1f057ca7b26bb6ecb67d929a3ad485cfb02a517b037ca9c048ec1fbc1e985ee9", word: "assorbire", pos: "verb" },
    cells: [
      // indicativo: passato prossimo, trapassato prossimo, trapassato remoto, futuro anteriore
      assorbireCell(36, "siamo"), assorbireCell(38, "siete"), assorbireCell(40, "sono"),
      assorbireCell(48, "eravamo"), assorbireCell(50, "eravate"), assorbireCell(52, "erano"),
      assorbireCell(60, "fummo"), assorbireCell(62, "foste"), assorbireCell(64, "furono"),
      assorbireCell(72, "saremo"), assorbireCell(74, "sarete"), assorbireCell(76, "saranno"),
      // condizionale passato
      assorbireCell(90, "saremmo"), assorbireCell(92, "sareste"), assorbireCell(94, "sarebbero"),
      // congiuntivo: passato, trapassato
      assorbireCell(114, "siamo"), assorbireCell(116, "siate"), assorbireCell(118, "siano"),
      assorbireCell(126, "fossimo"), assorbireCell(128, "foste"), assorbireCell(130, "fossero"),
    ],
    evidence: [
      {
        wiki: "it.wiktionary.org",
        title: "Appendice:Coniugazioni/Italiano/assorbire",
        revisionId: 2506943,
        // The page the source read the table from. Its template renders `siamo
        // assorbito, assorti, assorti` in every plural essere cell: the page
        // carries the error this entry corrects.
        shows: "{{It-conj|assorb|ire|essere o avere |pp2 = assorto}}",
      },
    ],
  },
  // Huey's ruling on #773, 2026-10-09: hide diplomatizzare's Verbo line 3, keyboard test text.
  {
    record: { releaseId: IT, lineNo: 573791, lineSha256: "7a098fb60ee87155211d80eb3a9ef39d982af2ad242f5d8e5651d451720c3488", word: "diplomatizzare", pos: "verb" },
    hides: { line: 3, wikitext: "{{Transitivo|it}}hhhhhhhh", text: "hhhhhhhh" },
    evidence: {
      page: { wiki: "it.wiktionary.org", title: "diplomatizzare", revisionId: 3978915 },
      ruling: "https://github.com/povlabs/lexema/issues/773#issuecomment-6082693102",
    },
  },
  // Huey's ruling on #839, 2026-10-17
  // (https://github.com/povlabs/lexema/issues/839#issuecomment-6233239777):
  // ten pronominal verbs' tables on essere, in archive order. Each page's
  // revision in dump `itwiktionary-20260701` passes `avere`, mangiarsi's too,
  // though its page passes `essere` today; so every one of them is corrected.
  onEssere({
    record: { releaseId: IT, lineNo: 40838, lineSha256: "aeaa99add26cc33a35ef580bffad5ae3f4dcefd153a17939f35a0a8a3ea2d524", word: "rimediarsi", pos: "verb" },
    page: { revisionId: 1871438, call: "{{It-conj|rimedi|iarsi|avere}}" },
    auxiliary: 1,
    firstCompound: 29,
    participle: "rimediato",
  }),
  onEssere({
    record: { releaseId: IT, lineNo: 43665, lineSha256: "2cd40d13d6db7fd0785c211a64666ee0d51e38e65517b558913c38b5bd6c5cab", word: "sottomettersi", pos: "verb" },
    page: {
      revisionId: 3674754,
      call: "{{It-conj|sottomett|ersi|avere|\npp=sottomesso|pp2=sottomessosi|\nprem1s=sottomisi|prem3s=sottomise|prem3s2=''|prem3p=sottomisero|prem3p2=''\n}}",
    },
    auxiliary: 1,
    firstCompound: 30,
    participle: "sottomesso",
    secondParticiple: "sottomessosi",
  }),
  onEssere({
    record: { releaseId: IT, lineNo: 46649, lineSha256: "d7ed86c20d9e262cd3be02551bc47d015ea35dbe72dfcd7210d80d3994409b17", word: "abbagliarsi", pos: "verb" },
    page: { revisionId: 1871502, call: "{{It-conj|abbagli|iarsi|avere}}" },
    auxiliary: 1,
    firstCompound: 29,
    participle: "abbagliato",
  }),
  onEssere({
    record: { releaseId: IT, lineNo: 47444, lineSha256: "d80db5710223066cc57ead0e34f06b50b016f2c36b802fb85466488cb8fcf5f0", word: "abbracciarsi", pos: "verb" },
    page: { revisionId: 1871503, call: "{{It-conj|abbracc|ciarsi|avere}}" },
    auxiliary: 1,
    firstCompound: 29,
    participle: "abbracciato",
  }),
  onEssere({
    record: { releaseId: IT, lineNo: 48343, lineSha256: "08478bfc91b9811a22e0e74511b18bb67de4f05773d28bc08b30259be97055e8", word: "dominarsi", pos: "verb" },
    page: { revisionId: 1871550, call: "{{It-conj|domin|arsi|avere}}" },
    auxiliary: 1,
    firstCompound: 29,
    participle: "dominato",
  }),
  onEssere({
    record: { releaseId: IT, lineNo: 48582, lineSha256: "770259d98ca1562b9566bcf156e8c8ff82e52750b74fdfd1c0af7a22a913be27", word: "incontrarsi", pos: "verb" },
    page: { revisionId: 1886367, call: "{{It-conj|incontr|arsi|avere}}" },
    auxiliary: 1,
    firstCompound: 29,
    participle: "incontrato",
  }),
  onEssere({
    record: { releaseId: IT, lineNo: 49460, lineSha256: "7a6d74ab506b2f0bfbad6bdf5f4dd86a6c0245328e82a6d046d3a9443f4b075f", word: "rovesciarsi", pos: "verb" },
    page: { revisionId: 3502745, call: "{{It-conj|rovesc|ciarsi|avere}}" },
    auxiliary: 1,
    firstCompound: 29,
    participle: "rovesciato",
  }),
  // suddividersi's two records hold the same table, from the same page.
  onEssere({
    record: { releaseId: IT, lineNo: 106940, lineSha256: "b75a48cff15d983069b27524bfff43f49dfec274a8219896c9ce3291547e9cb0", word: "suddividersi", pos: "verb" },
    page: SUDDIVIDERSI_PAGE,
    auxiliary: 1,
    firstCompound: 30,
    participle: "suddiviso",
    secondParticiple: "suddivisosi",
  }),
  onEssere({
    record: { releaseId: IT, lineNo: 106941, lineSha256: "0cd1f78127048cb25efe7abbfafe74b90e974f5813390990b014add6228e57c1", word: "suddividersi", pos: "verb" },
    page: SUDDIVIDERSI_PAGE,
    auxiliary: 1,
    firstCompound: 30,
    participle: "suddiviso",
    secondParticiple: "suddivisosi",
  }),
  onEssere({
    record: { releaseId: IT, lineNo: 404796, lineSha256: "448d18dd411759894fe0b97bc787356b3c3073e62943da82b84b6238af8ffeb8", word: "mangiarsi", pos: "verb" },
    page: { revisionId: 1886364, call: "{{It-conj|mang|giarsi|avere}}" },
    auxiliary: 1,
    firstCompound: 29,
    participle: "mangiato",
  }),
  onEssere({
    record: { releaseId: IT, lineNo: 404816, lineSha256: "76a7cb8441575a2bfff936010efccd3a5b2b36ae1a770fab4e735f2a986d2d21", word: "staccarsi", pos: "verb" },
    page: { revisionId: 1886422, call: "{{It-conj|stacc|carsi|avere}}" },
    auxiliary: 1,
    firstCompound: 29,
    participle: "staccato",
  }),
  // Huey's ruling on #830, 2026-10-17: eguale's plural is eguali, not equivalenti.
  {
    record: { releaseId: IT, lineNo: 486085, lineSha256: "f33cc0ccd484485a3a595751d91f148189125e908ca8b38fb2ba2a47c959c8d0", word: "eguale", pos: "adj" },
    cells: [{ index: 0, replaces: "equivalenti", surface: "eguali" }],
    evidence: [
      // The page the source read the form from, at its revision in dump
      // `itwiktionary-20260701`: it names equivalenti the plural of a word
      // both masculine and feminine.
      { wiki: "it.wiktionary.org", title: "eguale", revisionId: 3907185, shows: "{{Pn}} ''m'' e ''f sing'' {{Linkp|equivalenti}}" },
      { wiki: "en.wiktionary.org", title: "eguali", revisionId: 68995164, shows: "===Adjective=== {{head|it|adjective form}} # {{plural of|it|eguale}}" },
    ],
    ruling: "https://github.com/povlabs/lexema/issues/830#issuecomment-6233334459",
  },
  // Huey's ruling on #857, 2026-10-17: hide gaio's adjective sense 0, a stray
  // link where a definition should be. It is the only sense of that shape on
  // it-0c432803 (ADR 0030's amendment of that day).
  {
    record: { releaseId: IT, lineNo: 96753, lineSha256: "876c64ad8a6a60f9f04e07e3d88464a9ee5f783a7d17d5aaf1c0dbd670b77d66", word: "gaio", pos: "adj" },
    hidesSense: { index: 0, gloss: { pointer: "/senses/0/glosses/0", text: "Ultima_Sfaccim" }, line: 6, wikitext: "# [[Ultima_Sfaccim]]" },
    evidence: {
      page: { wiki: "it.wiktionary.org", title: "gaio", revisionId: 4057291 },
      ruling: "https://github.com/povlabs/lexema/issues/857#issuecomment-6237103400",
    },
  },
  // Huey's ruling on #836, 2026-10-17: quello's and bello's adjective tables
  // gain the forms they take before a noun, citing en.wiktionary, and
  // quello's loses `quelli`, its pronoun's plural. bello keeps `belli`
  // ("sono belli"). `quell'` and `bell'` stand before a vowel of either
  // gender, so each is added masculine and feminine singular, as the cited
  // pages give them.
  {
    record: { releaseId: IT, lineNo: 33211, lineSha256: "d496c574b2efa879af4bf9d1dd9f1994e42b0ba2c320c853d621dd77dedf02e2", word: "quello", pos: "adj" },
    adjectiveForms: {
      adds: [
        { surface: "quel", gender: "masculine", number: "singular" },
        { surface: "quell'", gender: "masculine", number: "singular" },
        { surface: "quell'", gender: "feminine", number: "singular" },
        { surface: "quei", gender: "masculine", number: "plural" },
        { surface: "quegli", gender: "masculine", number: "plural" },
      ],
      removes: [{ index: 0, removes: "quelli" }],
    },
    evidence: [
      {
        wiki: "en.wiktionary.org",
        title: "quello",
        revisionId: 90494248,
        shows:
          "===Determiner=== … * Adjectival forms: ** {{l|it|quel}}: masculine singular before a consonant (except [[impure s]], gn, pn, ps, x, z) ** {{l|it|quello}}: masculine singular before [[impure s]], gn, pn, ps, x, z ** {{l|it|quell'}}: masculine/feminine singular before a vowel or h ** {{l|it|quella}}: feminine singular before a consonant ** {{l|it|quei}}: masculine plural before a consonant (except [[impure s]], gn, pn, ps, x, z) ** {{l|it|quegli}}: masculine plural before a vowel, [[impure s]], gn, pn, ps, x, z ** {{l|it|quelle}}: feminine plural",
      },
      // The page the source read the table from, at its revision in dump
      // `itwiktionary-20260701`: it gives the adjective the pronoun's table.
      { wiki: "it.wiktionary.org", title: "quello", revisionId: 4042892, shows: "{{-agg dim-|it}} {{Pn}} ''m sing'' {{Tabs|quello|quelli|quella|quelle}}" },
    ],
    ruling: "https://github.com/povlabs/lexema/issues/836#issuecomment-6237109728",
  },
  {
    record: { releaseId: IT, lineNo: 33645, lineSha256: "3d945653779dd001abb341b95a8e7bb41b93b17a2d626c1f78cdaef63fa0d119", word: "bello", pos: "adj" },
    adjectiveForms: {
      adds: [
        { surface: "bel", gender: "masculine", number: "singular" },
        { surface: "bell'", gender: "masculine", number: "singular" },
        { surface: "bell'", gender: "feminine", number: "singular" },
        { surface: "bei", gender: "masculine", number: "plural" },
        { surface: "begli", gender: "masculine", number: "plural" },
      ],
    },
    evidence: [
      {
        wiki: "en.wiktionary.org",
        title: "bello",
        revisionId: 91582021,
        shows:
          "====Inflection==== … ! <small>Masculine<br>singular</small> | '''bello''' | '''{{l|it|bel}}''' | '''bello''' | align=\"center\" rowspan=2 |'''{{l|it|bell'|bell’}} ''' |- ! <small>Feminine<br>singular</small> | colspan=3 |'''{{l|it|bella}}''' |- ! <small>Masculine<br>plural</small> | '''{{l|it|belli}}''' | '''{{l|it|bei}}''' | colspan=2 |'''{{l|it|begli}}'''",
      },
    ],
    ruling: "https://github.com/povlabs/lexema/issues/836#issuecomment-6237109728",
  },
];

/**
 * The committed list: the hand entries, then the corrections rule
 * `it-plural-gloss-number/v3` makes from its pinned evidence (#483, #515, #516), in archive
 * order, then the edges rule `it-form-of-gloss-edge/v2` adds or replaces
 * (#722, #733), in archive order, then the meaning senses' edges rule
 * `it-form-of-meaning-edge/v1` removes or points at the record's base word
 * (#755), in archive order. A record a hand entry names is never also
 * corrected by the first rule, a sense a hand entry sets never by the second,
 * and a sense either sets never by the third.
 */
const HAND_EDGES = edgeCorrections(HAND_CORRECTIONS);
const GLOSS_EDGES = formOfGlossEdgeCorrections(FORM_OF_GLOSS_EDGE_EVIDENCE, HAND_EDGES);

export const CURATED_CORRECTIONS: readonly CuratedCorrection[] = [
  ...HAND_CORRECTIONS,
  ...pluralGlossCorrections(PLURAL_GLOSS_EVIDENCE, recordCorrections(HAND_CORRECTIONS)),
  ...GLOSS_EDGES,
  ...formOfMeaningEdgeCorrections(FORM_OF_MEANING_EDGE_EVIDENCE, [...HAND_EDGES, ...GLOSS_EDGES]),
];
