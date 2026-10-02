// Hides the records a hiding rule finds in another language (#29, #382, #389;
// ADR 0023). A hidden record is seeded whole: its archive line in
// `source_record_json`, its senses, glosses and grammar. It gets no
// `lookup_form` and no `form_of_edge` row, so no search, suggestion, page or
// lookup reaches it, and a form-of edge naming its word finds no record there.
// Its `hidden_record` row names the rule, the language and where the verdict
// was read from.
//
// Two rules hide. `section-language/v1` lines a title's records up with its raw
// page's blocks, so it needs every Italian record of the title before it can
// judge the first. `form-of-foreign-lemma/v1` reads other-language records that
// can sit anywhere in the archive. `readRulePass` reads what both need in one
// pass over the archive before the seed's own. A record both rules find is
// hidden once, by `section-language/v1`.

import {
  FORM_OF_FOREIGN_LEMMA_RULE,
  type ForeignForm,
  ForeignLemmaIndex,
  LEMMA_LISTS_FORM,
} from "../italian/formOfForeignLemma.js";
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

/** What the rules read off the archive before the seed's own pass. */
export interface RulePass {
  /** For `section-language/v1`, which still needs the raw pages. */
  titles: TitleRecords;
  /** The verdicts of `form-of-foreign-lemma/v1`, in archive order. */
  foreignForms: readonly ForeignForm[];
  archiveSha256: string;
}

/**
 * One pass over the archive at `input`, read the way the seed admits records:
 * every title's Italian records, and every record `form-of-foreign-lemma/v1`
 * finds.
 */
export async function readRulePass(input: string): Promise<RulePass> {
  const titles: TitleRecords = new Map();
  const index = new ForeignLemmaIndex();
  const { archiveSha256 } = await parseArchive({
    input,
    onRejection: () => {},
    onOtherLanguage: (lineNo, parsed) => index.addOtherLanguage(lineNo, parsed),
    onRecord: ({ lineNo, record }) => {
      const held = titles.get(record.word);
      const entry = { lineNo, posTitle: record.pos_title };
      if (held === undefined) titles.set(record.word, [entry]);
      else held.push(entry);
      index.addItalian(lineNo, record);
    },
  });
  return { titles, foreignForms: index.found(), archiveSha256 };
}

/** A record a rule hides, with its headword and what the verdict was read from. */
export type FoundRecord =
  | { rule: typeof SECTION_LANGUAGE_RULE; word: string; lineNo: number; foreign: ForeignRecord; page: PageRevision }
  | { rule: typeof FORM_OF_FOREIGN_LEMMA_RULE; word: string; lineNo: number; form: ForeignForm };

/** A section-language verdict. */
export type FoundOnPage = Extract<FoundRecord, { rule: typeof SECTION_LANGUAGE_RULE }>;

const formFound = (form: ForeignForm): FoundRecord => ({ rule: FORM_OF_FOREIGN_LEMMA_RULE, word: form.word, lineNo: form.lineNo, form });

/**
 * A found record's `hidden_record` values after `record_id, release_id`, in
 * the column order of `COLUMNS.hidden_record`: page, rule, reason, language,
 * page line and lemma line. `pageId` is the page row of a section-language
 * verdict; the other rule reads no page.
 */
export function hiddenRowValues(found: FoundRecord, pageId: number | undefined): unknown[] {
  if (found.rule === SECTION_LANGUAGE_RULE) {
    if (pageId === undefined) throw new Error(`${found.word} (line ${found.lineNo}) was judged on a page with no page row`);
    return [pageId, found.rule, found.foreign.because, found.foreign.code, found.foreign.ref.line, null];
  }
  return [null, found.rule, LEMMA_LISTS_FORM, found.form.code, null, found.form.lemmaLine];
}

const revisionOf = (page: RawPage): PageRevision => ({ wiki: page.wiki, title: page.title, revisionId: page.revisionId, timestamp: page.timestamp });

/**
 * Every record of `titles` the section-language rule finds in another
 * language, judging each page of `pages` that has records. In archive order.
 */
export async function findForeignRecords(
  pages: AsyncIterable<RawPage> | Iterable<RawPage>,
  titles: TitleRecords,
  languages: LanguageHeadings,
): Promise<FoundOnPage[]> {
  const found: FoundOnPage[] = [];
  for await (const page of pages) {
    const records = titles.get(page.title);
    if (records === undefined) continue;
    for (const foreign of foreignRecordsOf(page, languages, records)) {
      found.push({ rule: SECTION_LANGUAGE_RULE, word: page.title, lineNo: foreign.lineNo, foreign, page: revisionOf(page) });
    }
  }
  return found.sort((a, b) => a.lineNo - b.lineNo);
}

/**
 * Every record both rules hide: the verdicts a seed reaches, for a dictionary
 * seeded before them (src/import/hideRecords.ts). A record both find is
 * hidden by `section-language/v1`, as the seed does. In archive order.
 */
export async function findHiddenRecords(
  pages: AsyncIterable<RawPage> | Iterable<RawPage>,
  pass: RulePass,
  languages: LanguageHeadings,
): Promise<FoundRecord[]> {
  const onPage = await findForeignRecords(pages, pass.titles, languages);
  const judged = new Set(onPage.map((found) => found.lineNo));
  const forms = pass.foreignForms.filter((form) => !judged.has(form.lineNo)).map(formFound);
  return [...onPage, ...forms].sort((a, b) => a.lineNo - b.lineNo);
}

/** What the rules did in one seed. */
export interface HiddenSummary {
  sectionLanguage:
    | { rule: typeof SECTION_LANGUAGE_RULE; ran: false }
    | { rule: typeof SECTION_LANGUAGE_RULE; ran: true; hidden: number; languageLine: number; lateHeading: number };
  formOfForeignLemma: { rule: typeof FORM_OF_FOREIGN_LEMMA_RULE; hidden: number };
}

export class HiddenLayer {
  private readonly found = new Map<number, FoundOnPage>();
  private readonly forms: Map<number, ForeignForm>;
  private readonly counts = { sectionLanguage: 0, languageLine: 0, lateHeading: 0, formOfForeignLemma: 0 };

  /**
   * `pass` is the archive's rule pass; its titles are consumed as the seed
   * reaches each one. Without raw pages or the dump's language headings the
   * section-language rule has nothing to judge with: pass `undefined` for
   * `judge` and only `form-of-foreign-lemma/v1` hides.
   */
  constructor(
    private readonly judge: { pages: RawPageSource; languages: LanguageHeadings } | undefined,
    private readonly pass: RulePass,
    private readonly pageRows: RawPageRows,
    private readonly insert: ImportStatement,
    private readonly rows: { hidden_record: number },
  ) {
    this.forms = new Map(pass.foreignForms.map((form) => [form.lineNo, form]));
  }

  /**
   * Whether the record at `lineNo` is hidden. Asked once per record, in archive
   * order, before the record's rows are written; a hidden record's
   * `hidden_record` row is written here.
   */
  hides(releaseId: string, recordId: number, lineNo: number, word: string): boolean {
    this.judgeTitle(word);
    const form = this.forms.get(lineNo);
    const found = this.found.get(lineNo) ?? (form === undefined ? undefined : formFound(form));
    if (found === undefined) return false;
    this.found.delete(lineNo);
    this.forms.delete(lineNo);
    const pageId = found.rule === SECTION_LANGUAGE_RULE ? this.pageRows.idOf(releaseId, found.page) : undefined;
    this.insert.run(recordId, releaseId, ...hiddenRowValues(found, pageId));
    this.rows.hidden_record += 1;
    if (found.rule === SECTION_LANGUAGE_RULE) {
      this.counts.sectionLanguage += 1;
      if (found.foreign.because === "language-line") this.counts.languageLine += 1;
      else this.counts.lateHeading += 1;
    } else {
      this.counts.formOfForeignLemma += 1;
    }
    return true;
  }

  get summary(): HiddenSummary {
    const { sectionLanguage: hidden, languageLine, lateHeading, formOfForeignLemma } = this.counts;
    return {
      sectionLanguage: this.judge === undefined
        ? { rule: SECTION_LANGUAGE_RULE, ran: false }
        : { rule: SECTION_LANGUAGE_RULE, ran: true, hidden, languageLine, lateHeading },
      formOfForeignLemma: { rule: FORM_OF_FOREIGN_LEMMA_RULE, hidden: formOfForeignLemma },
    };
  }

  /** Judge a title's records on its page the first time one of them is reached. */
  private judgeTitle(word: string): void {
    const records = this.pass.titles.get(word);
    if (this.judge === undefined || records === undefined) return;
    this.pass.titles.delete(word);
    const page = this.judge.pages.page(word);
    if (page === undefined) return;
    for (const foreign of foreignRecordsOf(page, this.judge.languages, records)) {
      this.found.set(foreign.lineNo, { rule: SECTION_LANGUAGE_RULE, word, lineNo: foreign.lineNo, foreign, page: revisionOf(page) });
    }
  }
}
