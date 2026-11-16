// The source pages a lookup's records come from, read so their translations
// can be placed (src/lookup/translationPlacement.ts, #928). `/v1/lookup` and
// `/v1/lookup/batch` both read them here and place them there, so the two
// answers give one record the same translations.
//
// A page is every served Italian record whose headword is the same exact
// spelling: one Wikizionario page per spelling. Each is found through its
// headword row in `lookup_form`, so a record no search reaches (a hidden one,
// `hidden_record`) is not on any page. Nothing here is written: placement
// runs over the stored lines at read time.

import { normalizeItalianExact } from "../italian/normalize.js";
import { keyedRead, readKeys, type KeyedRead, type LookupDatabase } from "./database.js";
import { readDefinitionsAndTranslations, type Hides } from "./lookup.js";
import { splitReadingSenses } from "./senseSplit.js";
import { servedBy } from "./served.js";
import { TranslationPage, type PageRecord } from "./translationPlacement.js";

/**
 * The headword records of each spelling key, in archive order. Exported so a
 * test can name the statement.
 */
export const PAGE_RECORD_SQL: KeyedRead = keyedRead(`SELECT lf.surface_key AS set_key, r.record_id, r.release_id, r.line_no, r.line_sha256, r.word, r.pos
       FROM lookup_form lf
       JOIN source_record r ON r.record_id = lf.record_id
      WHERE lf.surface_key IN (SELECT value FROM json_each(?1)) AND lf.release_id IN (${servedBy("?2")}) AND lf.origin = 'headword'
      ORDER BY r.line_no, r.record_id`);

interface PageRecordRow {
  record_id: number;
  release_id: string;
  line_no: number;
  line_sha256: string;
  word: string;
  pos: string;
}

/**
 * The page of each headword in `words`, by headword. A spelling no served
 * record heads has a page of no records, whose records are owed nothing.
 */
export async function readTranslationPages(
  db: LookupDatabase,
  releaseId: string,
  hides: Hides,
  words: Iterable<string>,
): Promise<Map<string, TranslationPage>> {
  const headwords = [...new Set(words)];
  const rows = await readKeys<PageRecordRow>(db, PAGE_RECORD_SQL, [...new Set(headwords.map(normalizeItalianExact))], [releaseId]);
  return new Map(
    await Promise.all(
      headwords.map(async (headword) => {
        const own = rows.filter((row) => row.word === headword);
        const records = await Promise.all(own.map((row) => pageRecordOf(db, row, hides)));
        return [headword, TranslationPage.of(headword, records)] as const;
      }),
    ),
  );
}

/** One record of a page: its part of speech, its translations, and the glosses of its definitions. */
async function pageRecordOf(db: LookupDatabase, row: PageRecordRow, hides: Hides): Promise<PageRecord> {
  const ref = (jsonPointer: string) => ({ releaseId: row.release_id, lineNo: row.line_no, jsonPointer, lineSha256: row.line_sha256 });
  const { senses, recovered, translations } = await readDefinitionsAndTranslations(db, row.record_id, row.word, ref, hides);
  const { numbered } = splitReadingSenses({ word: row.word, senses, recovered });
  return {
    recordId: row.record_id,
    pos: row.pos,
    translations,
    definitionGlosses: numbered.map((sense) => sense.glosses.map((gloss) => gloss.text)),
  };
}
