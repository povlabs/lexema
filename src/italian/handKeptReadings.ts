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
// A reading may be another spelling of a word the source has: `eguaglianza`,
// the Constitution's spelling of `uguaglianza`, which the source lacks (Huey's
// ruling of 2026-10-17 on #830). Its cited sense line says so,
// `# {{alt form|it|uguaglianza}}`, and its definition writes that word; the
// lookup gives the reading a lemma link to it, so its page leads there as a
// form record's leads to its lemma (`alternativeOf`).
//
// A reading may also fill a reading the source has but leaves empty (Huey's
// ruling of 2026-10-18 on #803, ADR 0031's amendment of that day). Italian
// Wiktionary's `in ritardo` has a section for each of its two readings, and
// under each only `{{Nodef|it}}`; `quindici`'s noun section has its headword
// line and nothing below. Each such reading names the empty section it fills
// (`source`), and a lookup shows its definitions as the record's own
// (src/lookup/handKept.ts), not as a reading of their own.
//
// A hand-kept reading keys to nothing in the source: no archive line, no raw
// page, no `recovered_entry` row. The seed writes it as `hand_kept_definition`
// rows (src/import/handKeptRows.ts), `pnpm run correct:records` writes it into a
// master seeded before it (src/import/correctRecords.ts), and a lookup reads it
// beside the source's readings of its word (src/lookup/handKept.ts). The page
// shows it as an ordinary reading, with no mark (ADR 0016).

import { evidenceUrl } from "./evidence.js";
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

/**
 * The it.wiktionary section a hand-kept reading fills (#803): the dump's
 * revision of the word's page, and the heading of the section of the
 * reading's part of speech, under which no line defines anything.
 */
export interface EmptySection {
  kind: "empty";
  wiki: "it.wiktionary.org";
  title: string;
  revisionId: number;
  /** The section's heading, verbatim: `{{-loc agg-|it}}`. */
  heading: CitedLine;
}

/**
 * What Italian Wiktionary has of a hand-kept reading: no section of its part
 * of speech, so no record (`si`'s pronoun, ADR 0031), or a section, with its
 * record, that defines nothing (`in ritardo`, #803).
 */
export type SourceSection = { kind: "none" } | EmptySection;

/** What a hand-kept reading is made from; `handKeptReading` checks it. */
export interface HandKeptReadingSpec {
  word: string;
  /** A title and its part of speech from the closed set (`POS_BY_TITLE`): a mismatched pair cannot be written. */
  partOfSpeech: StatedPartOfSpeech;
  /** What the source has of the reading: nothing, or a section it fills. */
  source: SourceSection;
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

/** An en.wiktionary permanent link: a title and a revision id. */
export const PERMANENT_LINK = /^https:\/\/en\.wiktionary\.org\/w\/index\.php\?title=[^&]+&oldid=[1-9]\d*$/;
/** A ruling: a comment on a povlabs/lexema issue. */
export const RULING = /^https:\/\/github\.com\/povlabs\/lexema\/issues\/\d+#issuecomment-\d+$/;

const isLine = ({ line, wikitext }: CitedLine): boolean => Number.isInteger(line) && line > 0 && wikitext.trim() !== "";

/** A sense line that says its word is another spelling of an Italian word: `# {{alt form|it|uguaglianza}}`. */
const ALTERNATIVE_FORM = /^#\s*\{\{(?:alt form|alt sp|alternative form of|alternative spelling of)\|it\|([^|{}]+)(?:\|[^{}]*)?\}\}\s*$/;

/**
 * The word a cited sense line names its reading another spelling of:
 * `uguaglianza` for `# {{alt form|it|uguaglianza}}` (#830). The reading
 * leads to that word as a form record leads to its lemma
 * (src/lookup/handKept.ts). None for a line that defines.
 */
export function alternativeOf(line: Pick<CitedLine, "wikitext">): string | undefined {
  return ALTERNATIVE_FORM.exec(line.wikitext)?.[1].trim() || undefined;
}

/** The words `reading` leads to, as another spelling of each: `uguaglianza` for `eguaglianza` (#830). None for a reading that only defines. */
export const wordsLedTo = (reading: Pick<HandKeptReadingSpec, "definitions">): string[] =>
  reading.definitions.flatMap(({ paraphrases }) => alternativeOf(paraphrases) ?? []);

const isLetter = (char: string | undefined): boolean => char !== undefined && /\p{L}/u.test(char);

/** Whether `text` writes `word` as a whole word, so a page can link it there. */
function writes(text: string, word: string): boolean {
  for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + 1)) {
    if (!isLetter(text[at - 1]) && !isLetter(text[at + word.length])) return true;
  }
  return false;
}

/**
 * The only way to make a `HandKeptReading`. It refuses a spec without a word,
 * with a part of speech outside the closed set, with a blank definition, with
 * two definitions of one sense line, with a definition of another spelling
 * that does not write the word it leads to, with evidence that is not a
 * permanent link to an en.wiktionary revision, or with an empty section it
 * fills that is not a heading on its own word's page, so none of these is a
 * value a list can hold.
 */
export function handKeptReading(spec: HandKeptReadingSpec): HandKeptReading {
  const refuse = (why: string): never => {
    throw new InvalidHandKeptReading(`hand-kept reading ${JSON.stringify(spec.word)}: ${why}`);
  };
  if (spec.word === "" || spec.word.trim() !== spec.word) refuse("the word is empty or has surrounding spaces");
  const { posTitle, pos } = spec.partOfSpeech;
  if (!Object.hasOwn(POS_BY_TITLE, posTitle) || POS_BY_TITLE[posTitle] !== pos) refuse(`${posTitle} is not the title of ${pos}`);
  if (!isLine(spec.section)) refuse("its section heading is not a line of the revision");
  const { source } = spec;
  if (source.kind === "empty") {
    if (source.wiki !== "it.wiktionary.org" || source.title !== spec.word) refuse(`the section it fills is not on its own it.wiktionary page: ${source.title}`);
    if (!Number.isInteger(source.revisionId) || source.revisionId <= 0 || !isLine(source.heading)) refuse("the section it fills names no revision or heading line");
  }
  if (spec.definitions.length === 0) refuse("it has no definition");
  for (const { text, paraphrases } of spec.definitions) {
    if (text.trim() === "" || text.trim() !== text) refuse("a definition is blank or has surrounding spaces");
    if (!isLine(paraphrases) || paraphrases.line <= spec.section.line) refuse(`a definition paraphrases no sense line of its section: ${paraphrases.line}`);
    const alternative = alternativeOf(paraphrases);
    if (alternative !== undefined && !writes(text, alternative)) refuse(`a definition of another spelling does not write the word it leads to: ${alternative}`);
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
/** Huey's ruling of 2026-10-11 that `sig.` and `cosette` resolve (#819, which folds in #817). */
const RULING_809 = "https://github.com/povlabs/lexema/issues/809#issuecomment-6110591219";
/** Huey's ruling of 2026-10-18 that a reading the source leaves empty may get hand-kept definitions (#803, A). */
const RULING_803 = "https://github.com/povlabs/lexema/issues/803#issuecomment-6254975552";

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
    source: { kind: "none" },
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
    source: { kind: "none" },
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
  // it.wiktionary has no page `Sig.` and no record spells it. en.wiktionary's
  // Italian section heads it `===Noun===`, and its one sense is an
  // abbreviation of `signore`: what `Acronimo / Abbreviazione` names, as for
  // the source's `Dott.` ("abbreviazione di dottore").
  handKeptReading({
    word: "Sig.",
    partOfSpeech: statedPartOfSpeech("Acronimo / Abbreviazione"),
    source: { kind: "none" },
    section: { line: 4, wikitext: "===Noun===" },
    definitions: [
      {
        text: "abbreviazione di signore",
        paraphrases: { line: 7, wikitext: "# {{abbreviation of|it|signore|signor(e)}}: [[Mr.]]" },
      },
    ],
    evidence: [{ wiki: "en.wiktionary.org", title: "Sig.", revisionId: 89865273, timestamp: "2026-03-16T03:33:51Z", shows: "{{head|it|noun|g=m|feminine|Sig.ra|plural|Sigg.|or|Sig.ri}}" }],
    ruling: RULING_809,
  }),
  // The source's only `cosetta` is the proper name `Cosetta` (archive line
  // 36245), which no word shape reads, so `cosette` found nothing.
  // en.wiktionary has the common noun, feminine, with one sense; `cosette`
  // reaches it as its regular plural (rule `it-word-shape/v1`, `inflected`).
  handKeptReading({
    word: "cosetta",
    partOfSpeech: statedPartOfSpeech("Sostantivo"),
    source: { kind: "none" },
    section: { line: 4, wikitext: "===Noun===" },
    definitions: [
      {
        text: "cosa piccola o di poco conto",
        paraphrases: { line: 7, wikitext: "# [[trifle]] (little thing)" },
      },
    ],
    evidence: [{ wiki: "en.wiktionary.org", title: "cosetta", revisionId: 63388291, timestamp: "2021-07-25T12:22:57Z", shows: "{{it-noun|f}}" }],
    ruling: RULING_809,
  }),
  // The source has no record of `eguaglianza`, the older spelling the
  // Constitution writes (art. 3), and it.wiktionary has no page for it.
  // en.wiktionary's noun is another spelling of `uguaglianza`, which the
  // source has; the reading leads there.
  handKeptReading({
    word: "eguaglianza",
    partOfSpeech: statedPartOfSpeech("Sostantivo"),
    source: { kind: "none" },
    section: { line: 6, wikitext: "===Noun===" },
    definitions: [
      {
        text: "variante di uguaglianza",
        paraphrases: { line: 9, wikitext: "# {{alt form|it|uguaglianza}}" },
      },
    ],
    evidence: [{ wiki: "en.wiktionary.org", title: "eguaglianza", revisionId: 71378670, timestamp: "2023-02-23T01:13:31Z", shows: "{{it-noun|f}}" }],
    ruling: "https://github.com/povlabs/lexema/issues/830#issuecomment-6233334459",
  }),
  // it.wiktionary's `in ritardo` (revision 4053044) heads a Locuzione
  // aggettivale and a Locuzione avverbiale, each with only `{{Nodef|it}}`.
  // en.wiktionary heads one Adverb, whose one sense line glosses both uses:
  // `late`, `behind` of an action, `overdue`, `belated` of a thing.
  handKeptReading({
    word: "in ritardo",
    partOfSpeech: statedPartOfSpeech("Locuzione aggettivale"),
    source: { kind: "empty", wiki: "it.wiktionary.org", title: "in ritardo", revisionId: 4053044, heading: { line: 2, wikitext: "{{-loc agg-|it}}" } },
    section: { line: 9, wikitext: "===Adverb===" },
    definitions: [
      {
        text: "che arriva o avviene dopo il momento stabilito o previsto",
        paraphrases: { line: 12, wikitext: "# [[late]], [[behind]], [[after]], [[overdue]], [[belated]], [[slow]] {{q|of time}}" },
      },
    ],
    evidence: [{ wiki: "en.wiktionary.org", title: "in ritardo", revisionId: 80039828, timestamp: "2024-06-02T22:59:05Z", shows: "{{it-adv}}" }],
    ruling: RULING_803,
  }),
  handKeptReading({
    word: "in ritardo",
    partOfSpeech: statedPartOfSpeech("Locuzione avverbiale"),
    source: { kind: "empty", wiki: "it.wiktionary.org", title: "in ritardo", revisionId: 4053044, heading: { line: 6, wikitext: "{{-loc avv-|it}}" } },
    section: { line: 9, wikitext: "===Adverb===" },
    definitions: [
      {
        text: "dopo il momento stabilito o previsto",
        paraphrases: { line: 12, wikitext: "# [[late]], [[behind]], [[after]], [[overdue]], [[belated]], [[slow]] {{q|of time}}" },
      },
    ],
    evidence: [{ wiki: "en.wiktionary.org", title: "in ritardo", revisionId: 80039828, timestamp: "2024-06-02T22:59:05Z", shows: "{{it-adv}}" }],
    ruling: RULING_803,
  }),
  // it.wiktionary's `scorso` (revision 3920837) heads its adjective with
  // `# {{Nodef|it}}` and one example; its verb form defines itself.
  handKeptReading({
    word: "scorso",
    partOfSpeech: statedPartOfSpeech("Aggettivo"),
    source: { kind: "empty", wiki: "it.wiktionary.org", title: "scorso", revisionId: 3920837, heading: { line: 2, wikitext: "{{-agg-|it}}" } },
    section: { line: 10, wikitext: "===Adjective===" },
    definitions: [
      {
        text: "appena passato, immediatamente precedente",
        paraphrases: { line: 13, wikitext: "# [[last]], [[previous]]" },
      },
    ],
    evidence: [{ wiki: "en.wiktionary.org", title: "scorso", revisionId: 90562962, timestamp: "2026-05-09T11:16:46Z", shows: "{{it-adj}}" }],
    ruling: RULING_803,
  }),
  // it.wiktionary's `quindici` (revision 4070131) heads a noun with its
  // headword line alone; its numeral adjective defines itself. en.wiktionary
  // heads the word a Numeral, whose one sense is the number.
  handKeptReading({
    word: "quindici",
    partOfSpeech: statedPartOfSpeech("Sostantivo"),
    source: { kind: "empty", wiki: "it.wiktionary.org", title: "quindici", revisionId: 4070131, heading: { line: 7, wikitext: "{{-sost-|it}}" } },
    section: { line: 29, wikitext: "===Numeral===" },
    definitions: [
      {
        text: "il numero quindici",
        paraphrases: { line: 32, wikitext: "# [[fifteen]]" },
      },
    ],
    evidence: [{ wiki: "en.wiktionary.org", title: "quindici", revisionId: 90558905, timestamp: "2026-05-09T08:29:35Z", shows: "{{it-card-inv}}" }],
    ruling: RULING_803,
  }),
  // it.wiktionary's `Giulia` (revision 3863404) heads a Nome proprio with its
  // headword line alone.
  handKeptReading({
    word: "Giulia",
    partOfSpeech: statedPartOfSpeech("Nome proprio"),
    source: { kind: "empty", wiki: "it.wiktionary.org", title: "Giulia", revisionId: 3863404, heading: { line: 2, wikitext: "{{-nome-|it}}" } },
    section: { line: 11, wikitext: "===Proper noun===" },
    definitions: [
      {
        text: "nome proprio di persona femminile",
        paraphrases: { line: 14, wikitext: "# {{given name|it|female|eq=Julia}}" },
      },
    ],
    evidence: [{ wiki: "en.wiktionary.org", title: "Giulia", revisionId: 90576577, timestamp: "2026-05-09T15:43:32Z", shows: "{{it-proper noun|f}}" }],
    ruling: RULING_803,
  }),
]);
