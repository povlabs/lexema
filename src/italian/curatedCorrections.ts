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

export interface CuratedCorrection {
  record: CorrectedRecord;
  facts: CorrectedFacts;
  /** At least one revision; a correction without evidence is not a correction. */
  evidence: readonly [Evidence, ...Evidence[]];
}

/** A correction's id, stored on each of its rows: `it-0c432803:449969`. */
export const correctionId = (correction: Pick<CuratedCorrection, "record">): string =>
  `${correction.record.releaseId}:${correction.record.lineNo}`;

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
export function correctedFacts(correction: CuratedCorrection): CorrectedFact[] {
  const { gender, number } = correction.facts;
  return [
    ...(gender === undefined ? [] : [{ dimension: "gender" as const, ...gender }]),
    ...(number === undefined ? [] : [{ dimension: "number" as const, ...number }]),
  ];
}

const IT = "it-0c432803";

const tag = (index: number, text: string): OverriddenText => ({ pointer: `/tags/${index}`, text });
const firstGloss = (text: string): OverriddenText => ({ pointer: "/senses/0/glosses/0", text });

/** The committed list. Add an entry only with its evidence, and only on a ruling. */
export const CURATED_CORRECTIONS: readonly CuratedCorrection[] = [
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
];
