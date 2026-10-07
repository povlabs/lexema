// The `search` and `classify` steps of tools/measureEmptyWordPages.ts (#699):
// every headword whose word page shows only bare readings, and what its raw
// page holds.

import { DatabaseSync } from "node:sqlite";
import { recordText, recoverDefinitions } from "../../src/italian/recovery.js";
import { PAGE_ENTRY_RULE, PAGE_ENTRY_RULE_V2 } from "../../src/italian/pageEntry.js";
import { readRuledVerbSections, readStatedSections } from "../../src/italian/wikitext.js";
import { fromNodeSqlite } from "../../src/lookup/database.js";
import type { RawPage, RawPageSource } from "../../src/source/rawPage.js";
import { searchAttempt } from "../../web/lib/dictionary/searchAttempt.ts";
import { wordPage } from "../../web/lib/dictionary/wordPage.ts";
import { definitionTextLines, type PosSection, type TextLayout } from "./pageText.ts";

/** The one reader an ADR admits for a page whose word has a record: `recoverDefinitions` (src/italian/recovery.ts). */
export const RECOVERED_LAYER = "recovered-layer (#28, ADR 0012)";

/** The three classes the issue names. */
export type EmptyClass = "truly-empty" | "already-recovered" | "missed";

export interface ReadingSeen {
  /** `record:<id>` or `entry:<id>`. */
  id: string;
  posTitle: string;
  lineNo: number | null;
}

/** A line of definition text, and which existing rule's reader reads it. */
export interface ClassifiedLine {
  /** 1-based line in the revision. */
  line: number;
  layout: TextLayout;
  /** The part-of-speech heading line it sits under; null above every heading. */
  opener: number | null;
  /**
   * The existing readers that read this line: the recovered layer, which ADR
   * 0012 admits beside a record, and the page-entry rules' readers, which ADR
   * 0024 and ADR 0028 admit only for a page with no record.
   */
  readBy: string[];
  /** The line exactly as the page has it. */
  wikitext: string;
}

interface Seen {
  word: string;
  readings: ReadingSeen[];
}

/**
 * A truly empty headword: the raw page has no Italian definition text. The
 * class rests on its Italian part-of-speech sections, each from its heading to
 * its last line; a headword with no raw page rests on nothing and has none.
 */
type TrulyEmpty = Seen &
  (
    | { page: null; class: "truly-empty"; sections: [] }
    | { page: PageSeen; class: "truly-empty"; sections: PosSection[] }
  );

/** An empty headword whose page has text the recovered layer reads, though the release does not carry it. */
type AlreadyRecovered = Seen & { page: PageSeen; class: "already-recovered"; lines: [ClassifiedLine, ...ClassifiedLine[]] };

/** An empty headword whose page has text no admitted rule reads; `layout` is its lines' layouts, sorted, joined by `+`. */
type MissedHeadword = Seen & { page: PageSeen; class: "missed"; layout: string; lines: [ClassifiedLine, ...ClassifiedLine[]] };

export type EmptyHeadword = TrulyEmpty | AlreadyRecovered | MissedHeadword;

interface PageSeen {
  revisionId: number;
  timestamp: string;
}

/** A headword whose word page shows only bare readings, as the search step found it. */
export interface BareHeadword {
  word: string;
  readings: ReadingSeen[];
}

/** What the search step writes: every headword searched, how each search ended, and the bare ones. */
export interface SearchResult {
  release: string;
  headwords: number;
  outcomes: Record<string, number>;
  bare: BareHeadword[];
}

const idOf = (reading: { recordId?: number; entryId?: number }): string =>
  reading.recordId === undefined ? `entry:${reading.entryId}` : `record:${reading.recordId}`;

/**
 * Search every headword of the release the way the page does and keep the ones
 * whose page, built by `wordPage()`, shows only bare readings.
 */
export async function search(database: string, releaseId: string, log: (line: string) => void): Promise<SearchResult> {
  const sqlite = new DatabaseSync(database, { readOnly: true });
  const db = fromNodeSqlite(sqlite);
  const words = (
    sqlite
      .prepare(
        `SELECT word FROM source_record WHERE release_id = ?1
         UNION SELECT word FROM recovered_entry WHERE release_id = ?1
         ORDER BY word`,
      )
      .all(releaseId) as { word: string }[]
  ).map((row) => row.word);
  log(`${words.length} headwords`);

  const outcomes: Record<string, number> = {};
  const count = (key: string) => void (outcomes[key] = (outcomes[key] ?? 0) + 1);
  const empty: BareHeadword[] = [];
  const started = Date.now();
  for (const [i, word] of words.entries()) {
    if (i % 20000 === 0) log(`${i} of ${words.length}, ${Math.round((Date.now() - started) / 1000)} s, ${empty.length} empty`);
    const attempt = await searchAttempt(db, releaseId, word);
    if (attempt.outcome !== "found") {
      count(attempt.outcome);
      continue;
    }
    if (attempt.route.kind === "phrase") {
      // The page draws a searched expression with phrasePage, not wordPage.
      count("found (phrase page)");
      continue;
    }
    // `wordPage` keeps bare readings only when no reading shows anything, so a
    // page's readings are all bare or none are.
    const bare = wordPage(word, attempt.readings, attempt.lemmas, attempt.route).readings.flatMap((shown) => (shown.kind === "bare" ? [shown.reading] : []));
    if (bare.length === 0) {
      count("found (shows something)");
      continue;
    }
    count("found (every reading bare)");
    empty.push({
      word,
      readings: bare.map((reading) => ({ id: idOf(reading), posTitle: reading.posTitle, lineNo: "lineNo" in reading.ref ? (reading.ref.lineNo ?? null) : null })),
    });
  }
  log(`searched ${words.length} in ${Math.round((Date.now() - started) / 1000)} s; ${empty.length} empty`);
  sqlite.close();
  return { release: releaseId, headwords: words.length, outcomes, bare: empty };
}

/** Read each bare headword's raw page: by the existing rules' readers, and by `definitionTextLines`. */
export function classify(database: string, searched: SearchResult, pages: RawPageSource) {
  const releaseId = searched.release;
  const sqlite = new DatabaseSync(database, { readOnly: true });
  const recordsOf = sqlite.prepare(
    `SELECT r.record_id, r.word, r.pos_title, j.raw_json FROM source_record r JOIN source_record_json j USING (record_id)
      WHERE r.release_id = ?1 AND r.word = ?2 ORDER BY r.record_id`,
  );
  const classified = searched.bare.map(({ word, readings }): EmptyHeadword => {
    const page = pages.page(word) as RawPage | undefined;
    if (page === undefined) return { word, readings, page: null, class: "truly-empty", sections: [] };
    // The recovered layer, run for each record the page shows, as the seed runs it.
    const recovered = new Set<number>();
    const records = recordsOf.all(releaseId, word) as { record_id: number; word: string; pos_title: string; raw_json: string }[];
    for (const record of records) {
      if (!readings.some((reading) => reading.id === `record:${record.record_id}`)) continue;
      const json = JSON.parse(record.raw_json) as { senses?: { glosses?: unknown; examples?: unknown }[] };
      const outcome = recoverDefinitions(recordText({ word: record.word, pos_title: record.pos_title, senses: json.senses ?? [] }), page);
      if (outcome.outcome === "matched") for (const definition of outcome.recovered) recovered.add(definition.ref.line);
    }
    const v1 = new Set(readRuledVerbSections(page).flatMap((section) => section.definitions.map((definition) => definition.ref.line)));
    const v2 = new Set(readStatedSections(page).sections.flatMap((section) => section.definitions.map((definition) => definition.ref.line)));
    const text = definitionTextLines(page);
    const lines = text.lines.map(({ line, wikitext, layout, opener }): ClassifiedLine => ({
      line,
      layout,
      opener,
      readBy: [
        ...(recovered.has(line) ? [RECOVERED_LAYER] : []),
        ...(v1.has(line) ? [`${PAGE_ENTRY_RULE} reader`] : []),
        ...(v2.has(line) ? [`${PAGE_ENTRY_RULE_V2} reader`] : []),
      ],
      wikitext,
    }));
    const seen = { revisionId: page.revisionId, timestamp: page.timestamp };
    const [first, ...rest] = lines;
    if (first === undefined) return { word, readings, page: seen, class: "truly-empty", sections: text.sections };
    const withText: [ClassifiedLine, ...ClassifiedLine[]] = [first, ...rest];
    if (lines.some((line) => line.readBy.includes(RECOVERED_LAYER))) return { word, readings, page: seen, class: "already-recovered", lines: withText };
    return { word, readings, page: seen, class: "missed", layout: [...new Set(lines.map((line) => line.layout))].sort().join("+"), lines: withText };
  });
  sqlite.close();

  const byClass: Record<EmptyClass, number> = { "truly-empty": 0, "already-recovered": 0, missed: 0 };
  for (const headword of classified) byClass[headword.class] += 1;
  const groups = new Map<string, MissedHeadword[]>();
  for (const headword of classified) {
    if (headword.class === "missed") groups.set(headword.layout, [...(groups.get(headword.layout) ?? []), headword]);
  }
  const missedByLayout = [...groups]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([layout, members]) => {
      const readers: Record<string, number> = {};
      for (const member of members) {
        for (const reader of new Set(member.lines.flatMap((line) => line.readBy))) readers[reader] = (readers[reader] ?? 0) + 1;
      }
      return {
        layout,
        headwords: members.length,
        // A record-backed page is read only by the recovered layer (ADR 0012); the
        // page-entry rules admit a page with no record (ADR 0024, ADR 0028).
        admittedRule: members.some((member) => member.lines.some((line) => line.readBy.includes(RECOVERED_LAYER))) ? RECOVERED_LAYER : null,
        readers,
        examples: members.slice(0, 3).map((member) => member.word),
      };
    });

  return {
    release: releaseId,
    headwords: searched.headwords,
    outcomes: searched.outcomes,
    empty: classified.length,
    byClass,
    noRawPage: classified.filter((headword) => headword.page === null).map((headword) => headword.word),
    missedByLayout,
    list: classified,
  };
}
