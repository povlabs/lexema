// The hand-kept readings a dictionary serves (ADR 0031, #745): whole readings
// the source lacks, kept by hand on a ruling, read from `hand_kept_definition`
// beside the source's readings of their word. `si` reads its noun record and
// then its hand-kept pronoun. A reading's definitions are Lexema's approved
// wording, each pointing at the cited en.wiktionary revision's sense line it
// paraphrases; the reading points at that revision's section heading. The page
// shows it like any reading, with no mark (ADR 0016). A reading of another
// spelling leads to its word, as a form record leads to its lemma:
// `eguaglianza` to uguaglianza (#830). A reading of a part of speech its word
// has a record of fills that record's empty section instead: `in ritardo`'s
// two records show its hand-kept definitions as their own (#803,
// `filledDefinitions`), and the hand-kept reading is no reading beside them
// (`withoutFillingReadings`).

import { evidenceUrl } from "../italian/curatedCorrections.js";
import { alternativeOf } from "../italian/handKeptReadings.js";
import { normalizeItalianExact } from "../italian/normalize.js";
import { keyedRead, readKeys, type DictionaryRead, type KeyedRead, type LookupDatabase } from "./database.js";
import { readingPartOfSpeech } from "./articles.js";
import { lemmaLink, NO_ENTRY_FACTS } from "./pageFacts.js";
import type { DictionaryTables } from "./served.js";
import type { CitedRevision, LemmaCandidate, PageEntryRef, Reading, ReadingPartOfSpeech, RecoveredDefinition } from "./types.js";

/** A cited revision's permanent link, as the reading's evidence states it: `https://en.wiktionary.org/w/index.php?title=Sig.&oldid=89865273`. */
export const citedRevisionUrl = ({ title, revisionId }: CitedRevision): string => evidenceUrl({ wiki: "en.wiktionary.org", title, revisionId });

/** One definition of a hand-kept reading, as `HAND_KEPT_SQL` reads it. */
export interface HandKeptDefinitionRow {
  reading_id: string;
  word: string;
  pos: string;
  pos_title: string;
  text: string;
  page_line: number;
  wikitext: string;
  section_line: number;
  section_wikitext: string;
  evidence_url: string;
  revision_timestamp: string;
}

/** Every definition of the hand-kept readings of a key, each reading's in place order. */
export const HAND_KEPT_SQL: DictionaryRead = `SELECT reading_id, word, pos, pos_title, text, page_line, wikitext,
       section_line, section_wikitext, evidence_url, revision_timestamp
  FROM hand_kept_definition WHERE word_key = ?1 ORDER BY reading_id, definition_index`;

/**
 * A reading's cited sense lines, as one column of a read grouped by reading:
 * a JSON array of `[definition_index, wikitext]`, which `leadsToOf` reads.
 */
export const SENSE_LINES = "json_group_array(json_array(definition_index, wikitext)) AS sense_lines";

/**
 * The words a reading's cited sense lines name it another spelling of, in
 * definition order, as `handKeptReadingsFrom` gives it lemma links to them:
 * `uguaglianza` for `eguaglianza` (#830, #854). None for a reading that only
 * defines.
 */
export function leadsToOf(senseLines: string): string[] {
  return (JSON.parse(senseLines) as [number, string][])
    .sort(([a], [b]) => a - b)
    .flatMap(([, wikitext]) => alternativeOf({ wikitext }) ?? []);
}

/**
 * `HAND_KEPT_SQL` for many keys in one read, light (#776): each reading of
 * each key once, in reading order, with what names it and its part of speech.
 * A reading's first definition gives its revision and section line, as
 * `readingOf` takes them: SQLite reads the bare columns off the row `MIN`
 * picks. Its `sense_lines` give the words it leads to (`leadsToOf`).
 * Exported so a test can assert the plan.
 */
export const HAND_KEPT_HEADS_SQL: KeyedRead = keyedRead(`SELECT word_key AS set_key, reading_id, MIN(definition_index) AS first_definition,
       word, pos, pos_title, section_line, evidence_url, ${SENSE_LINES}
  FROM hand_kept_definition WHERE word_key IN (SELECT value FROM json_each(?1))
 GROUP BY word_key, reading_id ORDER BY word_key, reading_id`);

/** One hand-kept reading named, as `HAND_KEPT_HEADS_SQL` reads it. */
export interface HandKeptHeadRow {
  set_key: string;
  reading_id: string;
  word: string;
  pos: string;
  pos_title: string;
  section_line: number;
  evidence_url: string;
  /** The reading's cited sense lines (`SENSE_LINES`). */
  sense_lines: string;
}

/**
 * A hand-kept reading named, without its definitions: what a batch candidate
 * carries (src/lookup/batch.ts). `revisionId` and `pageLine` are its `ref`'s
 * revision and section line, so its public id is the one a full lookup gives it;
 * `cites` is that revision, which its credit opens.
 */
export interface HandKeptHead {
  handKeptId: string;
  releaseId: string;
  revisionId: number;
  cites: CitedRevision;
  pageLine: number;
  word: string;
  pos: string;
  posTitle: string;
  /** The words it is another spelling of, as its reading's lemma links name them (`leadsToOf`): `uguaglianza` for `eguaglianza`. */
  leadsTo: readonly string[];
}

/** The hand-kept readings of a dictionary. */
export interface HandKeptReadings {
  /** The readings headed by the query key. */
  readings(key: string): Promise<Reading[]>;
  /** The readings headed by each of `keys`, named, in the order `readings` gives them: one statement for every key. */
  heads(keys: readonly string[]): Promise<Map<string, HandKeptHead[]>>;
}

const NONE: HandKeptReadings = { readings: async () => [], heads: async () => new Map() };

/** The dictionary's hand-kept readings; none on one seeded before their table (#745), which is never sent a statement that names it. */
export function handKeptReadingsOf(db: LookupDatabase, releaseId: string, tables: Pick<DictionaryTables, "handKeptReadings">): HandKeptReadings {
  if (!tables.handKeptReadings) return NONE;
  return {
    readings: async (key) => handKeptReadingsFrom(db, releaseId, await db.all<HandKeptDefinitionRow>(HAND_KEPT_SQL, [key])),
    heads: async (keys) => {
      const byKey = new Map<string, HandKeptHead[]>();
      for (const row of await readKeys<HandKeptHeadRow>(db, HAND_KEPT_HEADS_SQL, keys)) {
        byKey.set(row.set_key, [...(byKey.get(row.set_key) ?? []), handKeptHeadOf(releaseId, row)]);
      }
      return byKey;
    },
  };
}

/**
 * The readings of a key's definition rows, as `HAND_KEPT_SQL` orders them: one
 * per reading, its definitions in order. A definition whose cited sense line
 * names the reading another spelling of a word (`# {{alt form|it|uguaglianza}}`,
 * `alternativeOf`) gives the reading a lemma link to that word, at that
 * definition, read as a page-only form's is (`lemmaLink`): `eguaglianza` leads
 * to uguaglianza as a form record leads to its lemma (#830). Only such a
 * reading sends a statement.
 */
export async function handKeptReadingsFrom(db: LookupDatabase, releaseId: string, rows: readonly HandKeptDefinitionRow[]): Promise<Reading[]> {
  const byReading = new Map<string, HandKeptDefinitionRow[]>();
  for (const row of rows) byReading.set(row.reading_id, [...(byReading.get(row.reading_id) ?? []), row]);
  return Promise.all(
    [...byReading.values()].map(async (definitions) => {
      const reading = readingOf(releaseId, definitions as [HandKeptDefinitionRow, ...HandKeptDefinitionRow[]]);
      const lemmaLinks = await Promise.all(
        definitions.flatMap((row) => {
          const word = alternativeOf(row);
          // At the definition's own ref, so the page links the word where its text writes it.
          return word === undefined ? [] : [lemmaLink(db, releaseId, word, { ...revisionOf(row.evidence_url), line: row.page_line }, NO_PAGE_CANDIDATES)];
        }),
      );
      return lemmaLinks.length === 0 ? reading : { ...reading, lemmaLinks };
    }),
  );
}

/**
 * Whether a hand-kept reading is of the word and part of speech of a source
 * record: a reading that fills that record's empty section (#803), `in
 * ritardo`'s Locuzione avverbiale, and not a reading of its own.
 */
export const fills = (kept: { readonly word: string; readonly pos: string }, record: { readonly word: string; readonly pos: string }): boolean =>
  kept.word === record.word && kept.pos === record.pos;

/**
 * The definitions the hand-kept readings give a record whose own section
 * defines nothing (#803): the definitions of its word's hand-kept reading of
 * its part of speech, `fills`, in order, each pointing at the en.wiktionary
 * sense line it paraphrases. `in ritardo`'s Locuzione avverbiale reads "dopo
 * il momento stabilito o previsto". The record keeps its forms, examples and
 * identity, so every page that reads it, its forms' included, shows them as
 * its own. None for a word no hand-kept reading fills, or on a dictionary
 * seeded before their table, which is sent no statement.
 */
export async function filledDefinitions(
  db: LookupDatabase,
  tables: Pick<DictionaryTables, "handKeptReadings">,
  record: { readonly word: string; readonly pos: string },
): Promise<RecoveredDefinition[]> {
  if (!tables.handKeptReadings) return [];
  const rows = await db.all<HandKeptDefinitionRow>(HAND_KEPT_SQL, [normalizeItalianExact(record.word)]);
  return rows.filter((row) => fills(row, record)).map(definitionOf);
}

/**
 * `readings` without the hand-kept readings that fill a record about the
 * query among them (#803): that record shows their definitions as its own
 * where its section defines nothing (`filledDefinitions`), and its own where
 * it defines something, the source's reading being the newer word (ADR
 * 0025). Either way the hand-kept reading is no reading beside it.
 */
export function withoutFillingReadings(readings: readonly [Reading, ...Reading[]]): [Reading, ...Reading[]] {
  const records = readings.filter((reading) => reading.recordId !== undefined && reading.isAboutQuery);
  const shown = readings.filter((reading) => reading.handKeptId === undefined || !records.some((record) => fills(reading, record)));
  const [first, ...rest] = shown;
  // A hand-kept reading leaves only where a record stays, so one reading is left.
  if (first === undefined) throw new Error("a lookup's readings all filled one another");
  return [first, ...rest];
}

/** A hand-kept reading's other spelling is an archive record's word; it names no page-only entry. */
const NO_PAGE_CANDIDATES = async (): Promise<LemmaCandidate[]> => [];

/** A reading named by its head row, as `HAND_KEPT_HEADS_SQL` reads it or one read as it reads them; `releaseId` is the served release's. */
export const handKeptHeadOf = (releaseId: string, row: Omit<HandKeptHeadRow, "set_key">): HandKeptHead => {
  const cites = citedRevisionOf(row.evidence_url);
  return {
    handKeptId: row.reading_id, releaseId, revisionId: cites.revisionId, cites, pageLine: row.section_line,
    word: row.word, pos: row.pos, posTitle: row.pos_title, leadsTo: leadsToOf(row.sense_lines),
  };
};

/** A hand-kept reading's part of speech, articles and all: its own, with no claims, forms or pronunciations, since it keys to no record. */
function handKeptPartOfSpeech({ pos, word }: { pos: string; word: string }): ReadingPartOfSpeech {
  const { claims, forms, wordFacts } = NO_ENTRY_FACTS;
  return readingPartOfSpeech(pos, word, claims, forms, wordFacts.pronunciations);
}

/** The revision a permanent link names: the table holds only `https://en.wiktionary.org/w/index.php?title=…&oldid=…`. */
function revisionOf(url: string): { wiki: string; title: string; revisionId: number } {
  const parsed = new URL(url);
  return { wiki: parsed.hostname, title: parsed.searchParams.get("title") ?? "", revisionId: Number(parsed.searchParams.get("oldid")) };
}

/** The cited revision a reading's stored permanent link names. */
function citedRevisionOf(url: string): CitedRevision {
  const { title, revisionId } = revisionOf(url);
  return { title, revisionId };
}

/** A hand-kept definition, pointing at the cited revision's sense line it paraphrases; plain data, with nothing that marks it (ADR 0016). */
const definitionOf = (row: HandKeptDefinitionRow): RecoveredDefinition => ({
  route: "hand-kept", text: row.text, correction: null, labels: [], ref: { ...revisionOf(row.evidence_url), line: row.page_line },
  examples: [], heldAsExample: null, items: [],
});

function readingOf(releaseId: string, [first, ...rest]: readonly [HandKeptDefinitionRow, ...HandKeptDefinitionRow[]]): Reading {
  const revision = revisionOf(first.evidence_url);
  const ref: PageEntryRef = {
    releaseId, ...revision, timestamp: first.revision_timestamp, line: first.section_line, wikitext: first.section_wikitext,
  };
  const recovered = [first, ...rest].map(definitionOf);
  const { claims, forms, wordFacts, lemmaLinks } = NO_ENTRY_FACTS;
  return {
    handKeptId: first.reading_id, ref, cites: citedRevisionOf(first.evidence_url), word: first.word,
    ...handKeptPartOfSpeech(first), posTitle: first.pos_title,
    isAboutQuery: true, evidence: [], senses: [], recovered, forms, wordFacts, translations: [],
    grammar: { record: claims, byForm: new Map(), bySense: new Map() },
    lemmaLinks, inflections: [], reviews: [],
  };
}
