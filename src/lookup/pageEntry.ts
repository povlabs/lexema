import type { DictionaryRead, LookupDatabase } from "./database.js";
import { queryAll } from "./database.js";
import { readingPartOfSpeech } from "./articles.js";
import { servedBy } from "./served.js";
import { normalizeItalianExact } from "../italian/normalize.js";
import { type LemmaCandidate, type Reading, type RecoveredDefinition, type PageEntryRef, type RecoveredRoute } from "./types.js";

interface EntryRow {
  entry_id: number;
  release_id: string;
  word: string;
  pos: string;
  pos_title: string;
  wiki: string;
  title: string;
  revision_id: number;
  revision_timestamp: string;
  page_line: number;
  wikitext: string;
}

export const PAGE_ENTRY_SQL: DictionaryRead = `SELECT e.entry_id, e.release_id, e.word, e.pos, e.pos_title,
       e.page_line, e.wikitext, p.wiki, p.title, p.revision_id, p.revision_timestamp
  FROM recovered_entry e
  JOIN raw_page p ON p.page_id = e.page_id
 WHERE e.release_id IN (${servedBy("?1")}) AND e.word_key = ?2
   AND NOT EXISTS (
       SELECT 1 FROM lookup_form lf
       WHERE lf.release_id IN (${servedBy("?1")}) AND lf.surface_key = e.word_key AND lf.origin = 'headword')
 ORDER BY e.entry_id`;

const refOf = (row: EntryRow): PageEntryRef => ({
  releaseId: row.release_id, wiki: row.wiki, title: row.title, revisionId: row.revision_id,
  timestamp: row.revision_timestamp, line: row.page_line, wikitext: row.wikitext,
});

export async function pageEntryCandidates(db: LookupDatabase, releaseId: string, word: string): Promise<LemmaCandidate[]> {
  const rows = await queryAll<EntryRow>(db, PAGE_ENTRY_SQL, releaseId, normalizeItalianExact(word));
  return rows.map((row) => ({ entryId: row.entry_id, word: row.word, pos: row.pos, ref: refOf(row) }));
}

export async function pageEntryReadings(db: LookupDatabase, releaseId: string, key: string): Promise<Reading[]> {
  const rows = await queryAll<EntryRow>(db, PAGE_ENTRY_SQL, releaseId, key);
  return Promise.all(rows.map(async (row): Promise<Reading> => {
    const [definitions, labels, examples] = await Promise.all([
      queryAll<{ definition_index: number; route: RecoveredRoute["route"]; term: string | null; page_line: number; wikitext: string; text: string; lead_in_index: number | null }>(db,
        `SELECT definition_index, route, term, page_line, wikitext, text, lead_in_index FROM entry_definition WHERE entry_id = ? ORDER BY definition_index`, row.entry_id),
      queryAll<{ definition_index: number; label: string }>(db,
        `SELECT definition_index, label FROM entry_label WHERE entry_id = ? ORDER BY definition_index, label_index`, row.entry_id),
      queryAll<{ definition_index: number; page_line: number; wikitext: string; text: string }>(db,
        `SELECT definition_index, page_line, wikitext, text FROM entry_example WHERE entry_id = ? ORDER BY definition_index, example_index`, row.entry_id),
    ]);
    const recovered: RecoveredDefinition[] = [];
    const byIndex = new Map<number, RecoveredDefinition>();
    const at = (line: number) => ({ wiki: row.wiki, title: row.title, revisionId: row.revision_id, line });
    for (const definition of definitions) {
      const route: RecoveredRoute = definition.route === "sub-term" ? { route: "sub-term", term: definition.term as string } : { route: definition.route };
      const value: RecoveredDefinition = {
        ...route, text: definition.text, ref: at(definition.page_line),
        labels: labels.filter((label) => label.definition_index === definition.definition_index).map((label) => label.label),
        examples: examples.filter((example) => example.definition_index === definition.definition_index).map((example) => ({ text: example.text, ref: at(example.page_line) })),
        heldAsExample: null, items: [],
      };
      byIndex.set(definition.definition_index, value);
      const parent = definition.lead_in_index === null ? undefined : byIndex.get(definition.lead_in_index);
      if (parent === undefined) recovered.push(value);
      else parent.items.push(value);
    }
    return {
      entryId: row.entry_id, ref: refOf(row), word: row.word, ...readingPartOfSpeech(row.pos, row.word, [], [], []), posTitle: row.pos_title,
      isAboutQuery: true, evidence: [], senses: [], recovered, forms: [],
      wordFacts: { pronunciations: [], hyphenations: [], etymologies: [], synonyms: [], synonymList: [], antonyms: [], derived: [], expressions: [] },
      grammar: { record: [], byForm: new Map(), bySense: new Map() }, lemmaLinks: [], inflections: [], reviews: [],
    };
  }));
}
