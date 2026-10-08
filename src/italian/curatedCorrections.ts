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
// `it-form-of-gloss-edge/v1` (formOfGlossEdge.ts) makes the added edges from
// its pinned scan (formOfGlossEdgeEvidence.ts); the two fixed ones are hand
// entries. The seed writes each as a `corrected_edge` row, a hidden record
// gets none, and a lookup reads it in place of the sense's own edges
// (src/lookup/correctedEdge.ts).
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

import { FORM_OF_GLOSS_EDGE_EVIDENCE } from "./formOfGlossEdgeEvidence.js";
import { formOfGlossEdgeCorrections } from "./formOfGlossEdge.js";
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

/** One Wiktionary page revision, and what it shows that settles the fact. */
export interface Evidence {
  wiki: "it.wiktionary.org" | "en.wiktionary.org";
  title: string;
  revisionId: number;
  /** What the revision shows, as written there. */
  shows: string;
}

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
  /** The sense's gloss that names the target after "di", verbatim: `/senses/1/glosses/0`. */
  gloss: OverriddenText;
  /** The edge the source states on the sense, verbatim, when the correction replaces it (question 9); absent when the sense has none. */
  replaces?: OverriddenText;
  /** The word the edge names: the gloss's word after "di". */
  target: string;
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
}

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
  edge?: never;
}

/** One entry of the curated list: a record's gender or number, a sense's `form_of` edge, or a page-only entry's definition. */
export type CuratedCorrection = RecordCorrection | EdgeCorrection | DefinitionCorrection;

export const isDefinitionCorrection = (correction: CuratedCorrection): correction is DefinitionCorrection =>
  correction.entry !== undefined;

export const isEdgeCorrection = (correction: CuratedCorrection): correction is EdgeCorrection => correction.edge !== undefined;

/** The entries of `corrections` that correct a record's gender or number. */
export const recordCorrections = (corrections: readonly CuratedCorrection[]): RecordCorrection[] =>
  corrections.filter((correction): correction is RecordCorrection => !isDefinitionCorrection(correction) && !isEdgeCorrection(correction));

/** The entries of `corrections` that set a sense's `form_of` edge. */
export const edgeCorrections = (corrections: readonly CuratedCorrection[]): EdgeCorrection[] => corrections.filter(isEdgeCorrection);

/** The entries of `corrections` that correct a page-only entry's definition. */
export const definitionCorrections = (corrections: readonly CuratedCorrection[]): DefinitionCorrection[] =>
  corrections.filter(isDefinitionCorrection);

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
 * archive line, `it-0c432803:449969`; for an edge, also its sense,
 * `it-0c432803:77162/senses/1`; or a definition's page revision and place,
 * `page:3906191:0`.
 */
export const correctionId = (correction: CuratedCorrection): string =>
  isDefinitionCorrection(correction)
    ? `page:${correction.entry.revisionId}:${correction.replaces.index}`
    : isEdgeCorrection(correction)
      ? `${correction.record.releaseId}:${correction.record.lineNo}/senses/${correction.edge.sense}`
      : `${correction.record.releaseId}:${correction.record.lineNo}`;

/** A permanent link to the revision, which stays as it was whatever the page says later. */
export const evidenceUrl = (evidence: Evidence): string =>
  `https://${evidence.wiki}/w/index.php?title=${encodeURIComponent(evidence.title)}&oldid=${evidence.revisionId}`;

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
];

/**
 * The committed list: the hand entries, then the corrections rule
 * `it-plural-gloss-number/v3` makes from its pinned evidence (#483, #515, #516), in archive
 * order, then the edges rule `it-form-of-gloss-edge/v1` adds (#722), in
 * archive order. A record a hand entry names is never also corrected by the
 * first rule, and a sense a hand entry sets never by the second.
 */
export const CURATED_CORRECTIONS: readonly CuratedCorrection[] = [
  ...HAND_CORRECTIONS,
  ...pluralGlossCorrections(PLURAL_GLOSS_EVIDENCE, recordCorrections(HAND_CORRECTIONS)),
  ...formOfGlossEdgeCorrections(FORM_OF_GLOSS_EDGE_EVIDENCE, edgeCorrections(HAND_CORRECTIONS)),
];
