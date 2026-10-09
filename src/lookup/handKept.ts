// The hand-kept readings a dictionary serves (ADR 0031, #745): whole readings
// the source lacks, kept by hand on a ruling, read from `hand_kept_definition`
// beside the source's readings of their word. `si` reads its noun record and
// then its hand-kept pronoun. A reading's definitions are Lexema's approved
// wording, each pointing at the cited en.wiktionary revision's sense line it
// paraphrases; the reading points at that revision's section heading. The page
// shows it like any reading, with no mark (ADR 0016).

import { keyedRead, readKeys, type DictionaryRead, type KeyedRead, type LookupDatabase } from "./database.js";
import { readingPartOfSpeech } from "./articles.js";
import { NO_ENTRY_FACTS } from "./pageFacts.js";
import type { DictionaryTables } from "./served.js";
import type { PageEntryRef, Reading, ReadingPartOfSpeech, RecoveredDefinition } from "./types.js";

interface DefinitionRow {
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
 * `HAND_KEPT_SQL` for many keys in one read, light (#776): each reading of
 * each key once, in reading order, with what names it and its part of speech.
 * A reading's first definition gives its revision and section line, as
 * `readingOf` takes them: SQLite reads the bare columns off the row `MIN`
 * picks. Exported so a test can assert the plan.
 */
export const HAND_KEPT_HEADS_SQL: KeyedRead = keyedRead(`SELECT word_key AS set_key, reading_id, MIN(definition_index) AS first_definition,
       word, pos, pos_title, section_line, evidence_url
  FROM hand_kept_definition WHERE word_key IN (SELECT value FROM json_each(?1))
 GROUP BY word_key, reading_id ORDER BY word_key, reading_id`);

interface HeadRow {
  set_key: string;
  reading_id: string;
  word: string;
  pos: string;
  pos_title: string;
  section_line: number;
  evidence_url: string;
}

/**
 * A hand-kept reading named, without its definitions: what a batch candidate
 * carries (src/lookup/batch.ts). `revisionId` and `pageLine` are its `ref`'s
 * revision and section line, so its public id is the one a full lookup gives it.
 */
export interface HandKeptHead {
  handKeptId: string;
  releaseId: string;
  revisionId: number;
  pageLine: number;
  word: string;
  pos: string;
  posTitle: string;
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
    readings: async (key) => {
      const byReading = new Map<string, DefinitionRow[]>();
      for (const row of await db.all<DefinitionRow>(HAND_KEPT_SQL, [key])) {
        byReading.set(row.reading_id, [...(byReading.get(row.reading_id) ?? []), row]);
      }
      return [...byReading.values()].map((rows) => readingOf(releaseId, rows as [DefinitionRow, ...DefinitionRow[]]));
    },
    heads: async (keys) => {
      const byKey = new Map<string, HandKeptHead[]>();
      for (const row of await readKeys<HeadRow>(db, HAND_KEPT_HEADS_SQL, keys)) {
        const head: HandKeptHead = {
          handKeptId: row.reading_id, releaseId, revisionId: revisionOf(row.evidence_url).revisionId, pageLine: row.section_line,
          word: row.word, pos: row.pos, posTitle: row.pos_title,
        };
        byKey.set(row.set_key, [...(byKey.get(row.set_key) ?? []), head]);
      }
      return byKey;
    },
  };
}

/** A hand-kept reading's part of speech, articles and all: its own, with no claims, forms or pronunciations, since it keys to no record. */
export function handKeptPartOfSpeech({ pos, word }: { pos: string; word: string }): ReadingPartOfSpeech {
  const { claims, forms, wordFacts } = NO_ENTRY_FACTS;
  return readingPartOfSpeech(pos, word, claims, forms, wordFacts.pronunciations);
}

/** The revision a permanent link names: the table holds only `https://en.wiktionary.org/w/index.php?title=…&oldid=…`. */
function revisionOf(url: string): { wiki: string; title: string; revisionId: number } {
  const parsed = new URL(url);
  return { wiki: parsed.hostname, title: parsed.searchParams.get("title") ?? "", revisionId: Number(parsed.searchParams.get("oldid")) };
}

function readingOf(releaseId: string, [first, ...rest]: readonly [DefinitionRow, ...DefinitionRow[]]): Reading {
  const revision = revisionOf(first.evidence_url);
  const ref: PageEntryRef = {
    releaseId, ...revision, timestamp: first.revision_timestamp, line: first.section_line, wikitext: first.section_wikitext,
  };
  const recovered = [first, ...rest].map((row): RecoveredDefinition => ({
    route: "hand-kept", text: row.text, correction: null, labels: [], ref: { ...revision, line: row.page_line },
    examples: [], heldAsExample: null, items: [],
  }));
  const { claims, forms, wordFacts, lemmaLinks } = NO_ENTRY_FACTS;
  return {
    handKeptId: first.reading_id, ref, word: first.word,
    ...handKeptPartOfSpeech(first), posTitle: first.pos_title,
    isAboutQuery: true, evidence: [], senses: [], recovered, forms, wordFacts, translations: [],
    grammar: { record: claims, byForm: new Map(), bySense: new Map() },
    lemmaLinks, inflections: [], reviews: [],
  };
}
