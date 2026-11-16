// The senses an English meaning is made for (#933), read from a seeded
// dictionary through the reads the API places translations with: the page of
// each headword (`PAGE_RECORD_SQL`), each record's definitions and
// translations (`readDefinitionsAndTranslations`), split by the page's rule
// (`splitReadingSenses`), and placed by `TranslationPage`. Nothing here writes.
//
// A sense is one of a record's definitions, as placement counts them: its
// numbered senses, then its recovered definitions. A form-of sense (`plurale
// di casa`) gets none: its meaning is its lemma's, which the reader reaches by
// the edge.

import { normalizeItalianExact } from "../italian/normalize.js";
import { readKeys, type LookupDatabase } from "../lookup/database.js";
import { readDefinitionsAndTranslations, type Hides } from "../lookup/lookup.js";
import { splitReadingSenses } from "../lookup/senseSplit.js";
import { PAGE_RECORD_SQL } from "../lookup/translationPages.js";
import { TranslationPage, type PageRecord } from "../lookup/translationPlacement.js";
import type { Sense } from "../lookup/types.js";
import { DefinitionText, type MeaningSense } from "./englishMeaning.js";

/** One page, with the senses of its records that a meaning may be made for. */
export interface MeaningPage {
  readonly page: TranslationPage;
  readonly senses: readonly MeaningSense[];
  /** Definitions left out because they are form-of, by record, with their text, for the report. */
  readonly formOf: readonly { recordId: number; pos: string; definition: string }[];
}

interface PageRecordRow {
  record_id: number;
  release_id: string;
  line_no: number;
  line_sha256: string;
  word: string;
  pos: string;
}

const isFormOf = (sense: Sense): boolean => sense.labels.some((label) => label.kind === "tag" && label.label === "form-of");

/** The page of each of `headwords` and its senses, in the order given. */
export async function readMeaningPages(db: LookupDatabase, releaseId: string, hides: Hides, headwords: readonly string[]): Promise<MeaningPage[]> {
  const words = [...new Set(headwords)];
  const rows = await readKeys<PageRecordRow>(db, PAGE_RECORD_SQL, [...new Set(words.map(normalizeItalianExact))], [releaseId]);
  return Promise.all(
    words.map(async (headword) => {
      const own = rows.filter((row) => row.word === headword);
      const read = await Promise.all(own.map((row) => readRecord(db, row, hides)));
      const page = TranslationPage.of(
        headword,
        read.map(({ record }) => record),
      );
      return {
        page,
        senses: read.flatMap(({ senses }) => senses),
        formOf: read.flatMap(({ formOf }) => formOf),
      };
    }),
  );
}

async function readRecord(db: LookupDatabase, row: PageRecordRow, hides: Hides) {
  const ref = (jsonPointer: string) => ({ releaseId: row.release_id, lineNo: row.line_no, jsonPointer, lineSha256: row.line_sha256 });
  const { senses, recovered, translations } = await readDefinitionsAndTranslations(db, row.record_id, row.word, ref, hides);
  const { numbered } = splitReadingSenses({ word: row.word, senses, recovered });
  const record: PageRecord = {
    recordId: row.record_id,
    pos: row.pos,
    translations,
    definitionGlosses: numbered.map((sense) => sense.glosses.map((gloss) => gloss.text)),
  };
  // Placement's index: numbered senses, then the recovered definitions.
  const definitions = [
    ...numbered.map((sense) => ({ text: DefinitionText.ofGlosses(sense.glosses.map((gloss) => gloss.text)), formOf: isFormOf(sense) })),
    ...recovered.map((definition) => ({ text: DefinitionText.of(definition.text), formOf: false })),
  ];
  const texts = definitions.map(({ text }) => text.text);
  return {
    record,
    senses: definitions.flatMap(({ text, formOf }, definitionIndex): MeaningSense[] =>
      formOf
        ? []
        : [
            {
              headword: row.word,
              recordId: row.record_id,
              pos: row.pos,
              definitionIndex,
              definition: text,
              otherDefinitions: texts.filter((_, at) => at !== definitionIndex),
            },
          ],
    ),
    formOf: definitions.filter(({ formOf }) => formOf).map(({ text }) => ({ recordId: row.record_id, pos: row.pos, definition: text.text })),
  };
}
