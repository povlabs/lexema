// Hides the records the section-language rule finds in another language (#29,
// #382; ADR 0023). A hidden record is seeded whole: its archive line in
// `source_record_json`, its senses, glosses and grammar. It gets no
// `lookup_form` and no `form_of_edge` row, so no search, suggestion, page or
// lookup reaches it, and a form-of edge naming its word finds no record there.
// Its `hidden_record` row names the rule, the language and the page line the
// verdict was read from.
//
// The rule lines a title's records up with its page's blocks, so it needs every
// Italian record of the title before it can judge the first. `readTitles`
// reads them in a pass over the archive before the seed's own.

import {
  type ForeignRecord,
  foreignRecordsOf,
  type LanguageHeadings,
  SECTION_LANGUAGE_RULE,
  type TitleRecord,
} from "../italian/sectionLanguage.js";
import type { RawPage, RawPageSource } from "../source/rawPage.js";
import { type ImportStatement, parseArchive } from "./importRelease.js";
import type { PageRevision, RawPageRows } from "./rawPageRows.js";

/** Every Italian record of every title, in archive order. */
export type TitleRecords = Map<string, TitleRecord[]>;

/**
 * The Italian records of every title in the archive at `input`, read the way
 * the seed admits them, and the archive's SHA-256.
 */
export async function readTitles(input: string): Promise<{ titles: TitleRecords; archiveSha256: string }> {
  const titles: TitleRecords = new Map();
  const { archiveSha256 } = await parseArchive({
    input,
    onRejection: () => {},
    onRecord: ({ lineNo, record }) => {
      const held = titles.get(record.word);
      const entry = { lineNo, posTitle: record.pos_title };
      if (held === undefined) titles.set(record.word, [entry]);
      else held.push(entry);
    },
  });
  return { titles, archiveSha256 };
}

/** A record the rule finds in another language, with its headword and the page revision it was judged on. */
export interface FoundRecord {
  word: string;
  foreign: ForeignRecord;
  page: PageRevision;
}

const revisionOf = (page: RawPage): PageRevision => ({ wiki: page.wiki, title: page.title, revisionId: page.revisionId, timestamp: page.timestamp });

/**
 * Every record of `titles` the rule finds in another language, judging each
 * page of `pages` that has records: the verdicts a seed reaches, for a
 * dictionary seeded before the rule (src/import/hideRecords.ts). In archive
 * order.
 */
export async function findForeignRecords(
  pages: AsyncIterable<RawPage> | Iterable<RawPage>,
  titles: TitleRecords,
  languages: LanguageHeadings,
): Promise<FoundRecord[]> {
  const found: FoundRecord[] = [];
  for await (const page of pages) {
    const records = titles.get(page.title);
    if (records === undefined) continue;
    for (const foreign of foreignRecordsOf(page, languages, records)) found.push({ word: page.title, foreign, page: revisionOf(page) });
  }
  return found.sort((a, b) => a.foreign.lineNo - b.foreign.lineNo);
}

/** What the rule did in one seed. */
export type HiddenSummary =
  | { rule: typeof SECTION_LANGUAGE_RULE; ran: false }
  | { rule: typeof SECTION_LANGUAGE_RULE; ran: true; hidden: number; languageLine: number; lateHeading: number };

/** A record found foreign, waiting for the seed to reach its line. */
interface Found {
  foreign: ForeignRecord;
  page: PageRevision;
}

export class HiddenLayer {
  private readonly found = new Map<number, Found>();
  private readonly counts = { hidden: 0, languageLine: 0, lateHeading: 0 };

  /**
   * `titles` is consumed as the seed reaches each title. Without raw pages or
   * the dump's language headings there is nothing to judge with: pass
   * `undefined` and no record is hidden.
   */
  constructor(
    private readonly judge: { pages: RawPageSource; languages: LanguageHeadings; titles: TitleRecords } | undefined,
    private readonly pageRows: RawPageRows,
    private readonly insert: ImportStatement,
    private readonly rows: { hidden_record: number },
  ) {}

  /**
   * Whether the record at `lineNo` is hidden. Asked once per record, in archive
   * order, before the record's rows are written; a hidden record's
   * `hidden_record` row is written here.
   */
  hides(releaseId: string, recordId: number, lineNo: number, word: string): boolean {
    this.judgeTitle(word);
    const found = this.found.get(lineNo);
    if (found === undefined) return false;
    this.found.delete(lineNo);
    const pageId = this.pageRows.idOf(releaseId, found.page);
    const { foreign } = found;
    this.insert.run(recordId, releaseId, pageId, SECTION_LANGUAGE_RULE, foreign.because, foreign.code, foreign.ref.line);
    this.rows.hidden_record += 1;
    this.counts.hidden += 1;
    if (foreign.because === "language-line") this.counts.languageLine += 1;
    else this.counts.lateHeading += 1;
    return true;
  }

  get summary(): HiddenSummary {
    return this.judge === undefined ? { rule: SECTION_LANGUAGE_RULE, ran: false } : { rule: SECTION_LANGUAGE_RULE, ran: true, ...this.counts };
  }

  /** Judge a title's records the first time one of them is reached. */
  private judgeTitle(word: string): void {
    const records = this.judge?.titles.get(word);
    if (this.judge === undefined || records === undefined) return;
    this.judge.titles.delete(word);
    const page = this.judge.pages.page(word);
    if (page === undefined) return;
    for (const foreign of foreignRecordsOf(page, this.judge.languages, records)) this.found.set(foreign.lineNo, { foreign, page: revisionOf(page) });
  }
}
