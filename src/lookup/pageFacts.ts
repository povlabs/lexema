// A page-only entry's other fields (ADR 0026, #439), read back from
// `entry_fact` into the shape an archive reading has, so the word page shows
// them through the same components and in the same order (ADR 0016: no mark
// says where they came from). The rule that read them is
// src/italian/pageFacts.ts; this module only turns its rows into a reading's
// grammar, forms, word facts and lemma links. Every value keeps the page line
// it was read from as its ref.

import { FORM_TAG_DIMENSION, isFormTag, RELATED_KINDS, type RelatedKind } from "../italian/pageFacts.js";
import { normalizeItalianExact } from "../italian/normalize.js";
import { keyedRead, readKeys, type DictionaryRead, type KeyedRead, type LookupDatabase } from "./database.js";
import { readExpressions } from "./expressions.js";
import { servedBy } from "./served.js";
import type {
  ExpressionItem,
  GrammarClaim,
  LemmaCandidate,
  LemmaLink,
  Pronunciation,
  RecoveredRef,
  RelatedWord,
  SourceForm,
  StatedClaim,
  SynonymEntry,
  WordFacts,
  WordText,
} from "./types.js";

/** An entry's facts, in the order the rule read them. Exported so a test can name the statement. */
export const ENTRY_FACT_SQL: DictionaryRead = `SELECT kind, page_line, value, source_text, meaning, tags, definition_index
  FROM entry_fact WHERE entry_id = ? ORDER BY fact_index`;

/**
 * The headword records a form-of target names, as a form-of edge's
 * candidates are read (`LEMMA_LINK_SQL` in lookup.ts). Exported so a test can
 * name the statement.
 */
export const HEADWORD_CANDIDATE_SQL: DictionaryRead = `SELECT t.record_id, t.release_id, t.line_no, t.line_sha256, t.pos, t.word
  FROM lookup_form lf
  JOIN source_record t ON t.record_id = lf.record_id
 WHERE lf.release_id IN (${servedBy("?1")}) AND lf.surface_key = ?2 AND lf.origin = 'headword'
 ORDER BY t.line_no, t.record_id`;

interface FactRow {
  kind: "gender" | "number" | "form" | "form-of" | "pronunciation" | "etymology" | RelatedKind | "expression";
  page_line: number;
  value: string;
  source_text: string | null;
  meaning: string | null;
  tags: string;
  definition_index: number | null;
}

/** What an entry's facts give its reading. */
export interface EntryFacts {
  claims: StatedClaim[];
  forms: SourceForm[];
  wordFacts: WordFacts;
  lemmaLinks: LemmaLink[];
}

/** No facts: an entry of a dictionary seeded before `entry_fact` reads as one whose page gave none. */
export const NO_ENTRY_FACTS: EntryFacts = {
  claims: [],
  forms: [],
  wordFacts: { pronunciations: [], hyphenations: [], etymologies: [], synonyms: [], synonymList: [], antonyms: [], derived: [], expressions: [] },
  lemmaLinks: [],
};

/** The facts of the given kinds, in the order the rule read them. */
const factsOfKind =
  (rows: readonly FactRow[]) =>
  <K extends FactRow["kind"]>(...kinds: K[]): (FactRow & { kind: K })[] =>
    rows.filter((row): row is FactRow & { kind: K } => (kinds as string[]).includes(row.kind));

const tagsOf = (row: FactRow): string[] => JSON.parse(row.tags) as string[];

/** The fact kinds a reading's articles are derived from (src/lookup/articles.ts). */
const AGREEMENT_KINDS = ["gender", "number", "form", "pronunciation"] as const;

/** What an entry's facts say that its articles are derived from: its gender and number, its forms and its IPA. */
export interface AgreementFacts {
  claims: StatedClaim[];
  forms: SourceForm[];
  pronunciations: Pronunciation[];
}

/** An entry's `AgreementFacts`, from its facts in the order the rule read them; facts of other kinds are passed over. */
function agreementFactsOf(rows: readonly FactRow[], at: (line: number) => RecoveredRef): AgreementFacts {
  const of = factsOfKind(rows);
  return {
    claims: of("gender", "number").map((row): StatedClaim => ({
      status: "stated", dimension: row.kind, value: row.value, sourceText: row.source_text as string, ref: at(row.page_line),
    })),
    forms: of("form").map((row, index): SourceForm => ({
      index,
      surface: row.value,
      ref: at(row.page_line),
      formSource: null,
      claims: tagsOf(row).filter(isFormTag).map((tag): GrammarClaim => ({
        status: "stated", dimension: FORM_TAG_DIMENSION[tag], value: tag, sourceText: tag, ref: at(row.page_line),
      })),
    })),
    pronunciations: of("pronunciation").map((row): Pronunciation => ({ ipa: row.value, note: null, ref: at(row.page_line) })),
  };
}

/**
 * `ENTRY_FACT_SQL` for many entries in one read, of `AGREEMENT_KINDS` alone,
 * each fact with its entry's page revision, which a ref on it names. Exported
 * so a test can assert the plan.
 */
export const ENTRY_AGREEMENT_FACT_SQL: KeyedRead = keyedRead(`SELECT f.entry_id AS set_key, f.kind, f.page_line, f.value, f.source_text, f.meaning, f.tags, f.definition_index,
            p.wiki, p.title, p.revision_id
  FROM entry_fact f
  JOIN recovered_entry e ON e.entry_id = f.entry_id
  JOIN raw_page p ON p.page_id = e.page_id
 WHERE f.entry_id IN (SELECT value FROM json_each(?1)) AND f.kind IN (${AGREEMENT_KINDS.map((kind) => `'${kind}'`).join(", ")})
 ORDER BY f.entry_id, f.fact_index`);

/** Each entry's `AgreementFacts`, in one statement however many entries; none for none. An entry with no fact gets none. */
export async function readAgreementFacts(db: LookupDatabase, entryIds: readonly number[]): Promise<Map<number, AgreementFacts>> {
  const rows = await readKeys<FactRow & { set_key: number; wiki: string; title: string; revision_id: number }>(db, ENTRY_AGREEMENT_FACT_SQL, entryIds);
  return new Map(
    entryIds.map((entryId) => {
      const own = rows.filter((row) => row.set_key === entryId);
      const [page] = own;
      // A ref is made only for a fact, so there is a row to name the page.
      const at = (line: number): RecoveredRef => {
        if (page === undefined) throw new Error(`entry ${entryId} has no fact to name its page`);
        return { wiki: page.wiki, title: page.title, revisionId: page.revision_id, line };
      };
      return [entryId, agreementFactsOf(own, at)];
    }),
  );
}

/**
 * Read one entry's facts. `at` makes the ref of a page line of the entry's
 * revision; `pageCandidates` names the page-only entries a word is, for a
 * form-of target no archive record heads.
 */
export async function readEntryFacts(
  db: LookupDatabase,
  releaseId: string,
  entryId: number,
  at: (line: number) => RecoveredRef,
  pageCandidates: (word: string) => Promise<LemmaCandidate[]>,
): Promise<EntryFacts> {
  const rows = await db.all<FactRow>(ENTRY_FACT_SQL, [entryId]);
  if (rows.length === 0) return NO_ENTRY_FACTS;
  const of = factsOfKind(rows);
  const { claims, forms, pronunciations } = agreementFactsOf(rows, at);

  const related = (kind: RelatedKind): RelatedWord[] => {
    const byWord = new Map<string, RelatedWord>();
    for (const row of of(kind)) {
      const existing = byWord.get(row.value);
      if (existing !== undefined) existing.refs.push(at(row.page_line));
      else byWord.set(row.value, { word: row.value, refs: [at(row.page_line)] });
    }
    return [...byWord.values()];
  };
  const [synonyms, antonyms, derived] = RELATED_KINDS.map(related);
  const items = of("expression").map((row): ExpressionItem => ({ phrase: row.value, meaning: row.meaning, ref: at(row.page_line) }));
  const [expressions, lemmaLinks] = await Promise.all([
    readExpressions(db, releaseId, items),
    Promise.all(of("form-of").map((row) => lemmaLink(db, releaseId, row.value, at(row.page_line), pageCandidates))),
  ]);

  return {
    claims,
    forms,
    wordFacts: {
      pronunciations,
      hyphenations: [],
      etymologies: of("etymology").map((row): WordText => ({ text: row.value, ref: at(row.page_line) })),
      synonyms,
      synonymList: of("synonym").map((row): SynonymEntry => ({ word: row.value, rawTags: tagsOf(row), ref: at(row.page_line) })),
      antonyms,
      derived,
      expressions,
    },
    lemmaLinks,
  };
}

/**
 * The word a definition says the entry is a form of, and every headword
 * record or page-only entry that spells it. None is a dangling link, which
 * stays visible as one, as an archive edge's does.
 */
async function lemmaLink(
  db: LookupDatabase,
  releaseId: string,
  targetWord: string,
  ref: RecoveredRef,
  pageCandidates: (word: string) => Promise<LemmaCandidate[]>,
): Promise<LemmaLink> {
  const [records, entries] = await Promise.all([
    db.all<{ record_id: number; release_id: string; line_no: number; line_sha256: string; pos: string; word: string }>(
      HEADWORD_CANDIDATE_SQL, [releaseId, normalizeItalianExact(targetWord)],
    ),
    pageCandidates(targetWord),
  ]);
  const candidates = [
    ...records.map((row): LemmaCandidate => ({
      recordId: row.record_id, word: row.word, pos: row.pos,
      ref: { releaseId: row.release_id, lineNo: row.line_no, jsonPointer: "/word", lineSha256: row.line_sha256 },
    })),
    ...entries,
  ];
  if (candidates.length === 0) return { kind: "dangling", targetWord, ref };
  return { kind: "candidates", targetWord, ref, candidates: candidates.map((candidate) => ({ ...candidate, listing: undefined })) };
}
