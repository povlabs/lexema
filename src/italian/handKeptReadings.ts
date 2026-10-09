// Hand-kept readings: whole readings the source lacks, kept by hand beside the
// source data on a ruling, each citing the en.wiktionary revision that shows it
// (ADR 0031, #745).
//
// Italian Wiktionary has no pronoun section for `si` and no conjunction section
// for `come`, so no record and no recovery rule (ADR 0024, ADR 0029) can give
// those readings: `si` reads only as the musical note. Huey ruled on 2026-10-09
// that Lexema keeps a short list of such readings
// (https://github.com/povlabs/lexema/issues/745#issuecomment-6080245573). A
// reading is a word, a part of speech and its Italian definitions. The
// definitions are Lexema's wording, paraphrased from the cited revision's sense
// lines and approved by Huey word for word on the pull request that adds them
// (ADR 0008's 2026-10-03 amendment).
//
// A hand-kept reading keys to nothing in the source: no archive line, no raw
// page, no `recovered_entry` row. The seed writes it as `hand_kept_definition`
// rows (src/import/handKeptRows.ts), `pnpm run correct:records` writes it into a
// master seeded before it (src/import/correctRecords.ts), and a lookup reads it
// beside the source's readings of its word (src/lookup/handKept.ts). The page
// shows it as an ordinary reading, with no mark (ADR 0016).

import { evidenceUrl } from "./curatedCorrections.js";
import { POS_BY_TITLE, statedPartOfSpeech, type StatedPartOfSpeech } from "./partOfSpeech.js";

/** One en.wiktionary revision a hand-kept reading cites, and what it shows that settles the reading. */
export interface EnWiktionaryEvidence {
  wiki: "en.wiktionary.org";
  title: string;
  revisionId: number;
  /** When the revision was saved, as the MediaWiki API states it. */
  timestamp: string;
  /** What the revision shows, as written there: the headword line of the reading's section. */
  shows: string;
}

/** One line of the first cited revision: its 1-based place and its wikitext, verbatim. */
export interface CitedLine {
  line: number;
  wikitext: string;
}

/** One definition of a hand-kept reading: Lexema's Italian wording, and the sense line it paraphrases. */
export interface HandKeptDefinition {
  /** Lexema's wording, in Italian, approved by Huey on the pull request that adds it. */
  text: string;
  /** The sense line of the first cited revision the wording paraphrases. */
  paraphrases: CitedLine;
}

/** What a hand-kept reading is made from; `handKeptReading` checks it. */
export interface HandKeptReadingSpec {
  word: string;
  /** A title and its part of speech from the closed set (`POS_BY_TITLE`): a mismatched pair cannot be written. */
  partOfSpeech: StatedPartOfSpeech;
  /** The heading of the first cited revision's section that states the part of speech: `====Pronoun====`. */
  section: CitedLine;
  /** At least one, each paraphrasing its own sense line. */
  definitions: readonly [HandKeptDefinition, ...HandKeptDefinition[]];
  /** At least one revision; a reading without evidence is not kept. The first holds `section` and every sense line. */
  evidence: readonly [EnWiktionaryEvidence, ...EnWiktionaryEvidence[]];
  /** The ruling that added it: a comment on a povlabs/lexema issue. */
  ruling: string;
}

declare const checked: unique symbol;

/** A hand-kept reading `handKeptReading` checked; no other value has this type. */
export type HandKeptReading = Readonly<HandKeptReadingSpec> & { readonly [checked]: true };

/** Why a spec is not a hand-kept reading. */
export class InvalidHandKeptReading extends Error {
  override readonly name = "InvalidHandKeptReading";
}

const PERMANENT_LINK = /^https:\/\/en\.wiktionary\.org\/w\/index\.php\?title=[^&]+&oldid=[1-9]\d*$/;
const RULING = /^https:\/\/github\.com\/povlabs\/lexema\/issues\/\d+#issuecomment-\d+$/;

const isLine = ({ line, wikitext }: CitedLine): boolean => Number.isInteger(line) && line > 0 && wikitext.trim() !== "";

/**
 * The only way to make a `HandKeptReading`. It refuses a spec without a word,
 * with a part of speech outside the closed set, with a blank definition, with
 * two definitions of one sense line, or with evidence that is not a permanent
 * link to an en.wiktionary revision, so none of these is a value a list can hold.
 */
export function handKeptReading(spec: HandKeptReadingSpec): HandKeptReading {
  const refuse = (why: string): never => {
    throw new InvalidHandKeptReading(`hand-kept reading ${JSON.stringify(spec.word)}: ${why}`);
  };
  if (spec.word === "" || spec.word.trim() !== spec.word) refuse("the word is empty or has surrounding spaces");
  const { posTitle, pos } = spec.partOfSpeech;
  if (!Object.hasOwn(POS_BY_TITLE, posTitle) || POS_BY_TITLE[posTitle] !== pos) refuse(`${posTitle} is not the title of ${pos}`);
  if (!isLine(spec.section)) refuse("its section heading is not a line of the revision");
  if (spec.definitions.length === 0) refuse("it has no definition");
  for (const { text, paraphrases } of spec.definitions) {
    if (text.trim() === "" || text.trim() !== text) refuse("a definition is blank or has surrounding spaces");
    if (!isLine(paraphrases) || paraphrases.line <= spec.section.line) refuse(`a definition paraphrases no sense line of its section: ${paraphrases.line}`);
  }
  if (new Set(spec.definitions.map(({ paraphrases }) => paraphrases.line)).size !== spec.definitions.length) refuse("two definitions paraphrase one line");
  if (spec.evidence.length === 0) refuse("it cites no revision");
  for (const evidence of spec.evidence) {
    if (evidence.wiki !== "en.wiktionary.org" || !PERMANENT_LINK.test(evidenceUrl(evidence))) refuse(`not an en.wiktionary permanent link: ${evidenceUrl(evidence)}`);
    if (evidence.shows.trim() === "" || Number.isNaN(Date.parse(evidence.timestamp))) refuse("its evidence shows nothing, or has no timestamp");
  }
  if (!RULING.test(spec.ruling)) refuse(`no ruling comment: ${spec.ruling}`);
  return Object.freeze({ ...spec }) as HandKeptReading;
}

/** A reading's id, unique in the list and stored on each of its rows: its word and part of speech, `si:pron`. */
export const handKeptId = (reading: Pick<HandKeptReading, "word" | "partOfSpeech">): string => `${reading.word}:${reading.partOfSpeech.pos}`;

/** The first cited revision, which holds the reading's section and every sense line. */
export const sectionEvidence = (reading: HandKeptReading): EnWiktionaryEvidence => reading.evidence[0];

/** `readings` as a list: refused when two share an id, since a word has one reading of each part of speech here. */
function handKeptList(readings: readonly HandKeptReading[]): readonly HandKeptReading[] {
  const ids = readings.map(handKeptId);
  const twice = ids.find((id, i) => ids.indexOf(id) !== i);
  if (twice !== undefined) throw new InvalidHandKeptReading(`the list keeps ${twice} twice`);
  return Object.freeze([...readings]);
}

const RULING_745 = "https://github.com/povlabs/lexema/issues/745#issuecomment-6080245573";

/**
 * The committed list. Add a reading only with its evidence, and only on a
 * ruling; its wording only once Huey approves it on the pull request.
 */
export const HAND_KEPT_READINGS: readonly HandKeptReading[] = handKeptList([
  // it.wiktionary's `si` (revision 3890195) has only `{{-sost-|it}}`, the
  // musical note. en.wiktionary's Etymology 1 is the pronoun. Its fifth sense,
  // dialectal Roman `se` for `ci`, is not kept.
  handKeptReading({
    word: "si",
    partOfSpeech: statedPartOfSpeech("Pronome"),
    section: { line: 952, wikitext: "====Pronoun====" },
    definitions: [
      {
        text: "pronome riflessivo di terza persona, singolare e plurale: sé stesso, sé stessa, sé stessi, sé stesse",
        paraphrases: { line: 955, wikitext: "# {{senseid|it|reflexive}} {{lb|it|reflexive pronoun}} [[oneself]], [[himself]], [[herself]], [[itself]], [[themselves]]" },
      },
      {
        text: "pronome reciproco: l'un l'altro, a vicenda",
        paraphrases: { line: 959, wikitext: "# {{senseid|it|reciprocal}} {{lb|it|reciprocal pronoun}} [[each other]], [[one another]]" },
      },
      {
        text: "con valore impersonale, indica un soggetto generico: uno, la gente",
        paraphrases: { line: 961, wikitext: "# {{senseid|it|indefinite}} {{lb|it|indefinite}} [[one]], [[you]], [[we]], [[they]], [[people]]" },
      },
      {
        text: "con valore passivo, forma il passivo di un verbo (si passivante)",
        paraphrases: { line: 966, wikitext: "# {{senseid|it|passive}} {{lb|it|si passivante}} {{n-g|Used to form the [[passive voice]] of a verb}}; [[it]]" },
      },
    ],
    evidence: [{ wiki: "en.wiktionary.org", title: "si", revisionId: 93469502, timestamp: "2026-10-09T07:58:42Z", shows: "{{head|it|pronouns}}" }],
    ruling: RULING_745,
  }),
  // it.wiktionary's `come` (revision 4075938) has only `{{-avv-|it}}` and
  // `{{-prep-|it}}`. en.wiktionary gives the conjunction one sense.
  handKeptReading({
    word: "come",
    partOfSpeech: statedPartOfSpeech("Congiunzione"),
    section: { line: 1058, wikitext: "===Conjunction===" },
    definitions: [
      {
        text: "non appena, nel momento in cui",
        paraphrases: { line: 1061, wikitext: "# [[as soon as]]" },
      },
    ],
    evidence: [{ wiki: "en.wiktionary.org", title: "come", revisionId: 93379611, timestamp: "2026-10-03T08:45:29Z", shows: "{{head|it|conjunction}}" }],
    ruling: RULING_745,
  }),
]);
