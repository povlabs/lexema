// The hand-kept readings a dictionary serves (ADR 0031, #745): whole readings
// the source lacks, kept by hand on a ruling, read from `hand_kept_definition`
// beside the source's readings of their word. `si` reads its noun record and
// then its hand-kept pronoun. A reading's definitions are Lexema's approved
// wording, each pointing at the cited en.wiktionary revision's sense line it
// paraphrases; the reading points at that revision's section heading. The page
// shows it like any reading, with no mark (ADR 0016).

import type { DictionaryRead, LookupDatabase } from "./database.js";
import { readingPartOfSpeech } from "./articles.js";
import { NO_ENTRY_FACTS } from "./pageFacts.js";
import type { DictionaryTables } from "./served.js";
import type { PageEntryRef, Reading, RecoveredDefinition } from "./types.js";

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

/** The hand-kept readings of a dictionary. */
export interface HandKeptReadings {
  /** The readings headed by the query key. */
  readings(key: string): Promise<Reading[]>;
}

const NONE: HandKeptReadings = { readings: async () => [] };

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
  };
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
    ...readingPartOfSpeech(first.pos, first.word, claims, forms, wordFacts.pronunciations), posTitle: first.pos_title,
    isAboutQuery: true, evidence: [], senses: [], recovered, forms, wordFacts, translations: [],
    grammar: { record: claims, byForm: new Map(), bySense: new Map() },
    lemmaLinks, inflections: [], reviews: [],
  };
}
