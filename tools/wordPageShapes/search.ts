// The `search` step of tools/measureWordPageShapes.ts (#707): search every
// headword of the release the way the page does, build the page it opens, and
// write that page's facts, one JSON line per headword. Then the same for a
// sample of expression searches, since a headword search never opens an
// expression's short page (§ 6): that page opens for an expression typed with
// one of its words inflected, `vado via`.

import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";
import { normalizeItalianExact } from "../../src/italian/normalize.js";
import { fromNodeSqlite, type LookupDatabase } from "../../src/lookup/database.js";
import { phrasePage } from "../../web/lib/dictionary/phrasePage.ts";
import { searchAttempt } from "../../web/lib/dictionary/searchAttempt.ts";
import { wordPage } from "../../web/lib/dictionary/wordPage.ts";
import { phrasePageFacts, wordPageFacts, type PageFacts } from "./facts.ts";

/** Every headword of the release: each distinct `word` of an archive record or a page-only entry, as #699 counted them. */
const HEADWORDS = `SELECT word FROM source_record WHERE release_id = ?1
  UNION SELECT word FROM recovered_entry WHERE release_id = ?1
  ORDER BY word`;

/** The release's expressions: its headwords of two words or more. */
const EXPRESSIONS = `SELECT DISTINCT word FROM source_record WHERE release_id = ?1 AND word LIKE '% %' ORDER BY word`;

/** One single-word headword that declares a form-of edge to a word: the first, by spelling. */
const FIRST_FORM = `SELECT r.word FROM form_of_edge e JOIN source_record r USING (record_id)
  WHERE e.release_id = ?1 AND e.target_word_key = ?2 AND r.word NOT LIKE '% %'
  ORDER BY r.word LIMIT 1`;

/** Search one query and reduce the page it opens to its facts. */
async function pageFacts(db: LookupDatabase, releaseId: string, query: string): Promise<PageFacts> {
  const attempt = await searchAttempt(db, releaseId, query);
  if (attempt.outcome !== "found") return { word: query, page: "none", outcome: attempt.outcome };
  if (attempt.route.kind === "phrase") return phrasePageFacts(query, phrasePage(query, attempt.route, attempt.readings));
  return wordPageFacts(query, wordPage(query, attempt.readings, attempt.lemmas, attempt.route));
}

async function writeAll(out: string, queries: readonly string[], facts: (query: string) => Promise<PageFacts>, log: (line: string) => void) {
  const file = createWriteStream(out);
  const started = Date.now();
  for (const [i, query] of queries.entries()) {
    if (i % 20000 === 0) log(`${i} of ${queries.length}, ${Math.round((Date.now() - started) / 1000)} s`);
    if (!file.write(`${JSON.stringify(await facts(query))}\n`)) await once(file, "drain");
  }
  file.end();
  await once(file, "finish");
  log(`searched ${queries.length} in ${Math.round((Date.now() - started) / 1000)} s`);
}

/**
 * For each expression and each of its words, the expression with that word
 * swapped for the first single-word headword that is a form of it: `andare
 * via` gives `andai via`. One query per word an inflected form exists for,
 * so every expression that can open a short page is searched once per slot.
 */
function expressionQueries(sqlite: DatabaseSync, releaseId: string): string[] {
  const firstForm = sqlite.prepare(FIRST_FORM);
  const queries = new Set<string>();
  for (const { word } of sqlite.prepare(EXPRESSIONS).all(releaseId) as { word: string }[]) {
    const words = word.split(" ");
    for (const [i, slot] of words.entries()) {
      const form = (firstForm.get(releaseId, normalizeItalianExact(slot)) as { word: string } | undefined)?.word;
      if (form !== undefined) queries.add(words.map((each, j) => (j === i ? form : each)).join(" "));
    }
  }
  return [...queries].sort();
}

/** Write every headword's page to `pagesOut` and every sampled expression search's to `expressionsOut`; return their counts. */
export async function search(database: string, releaseId: string, pagesOut: string, expressionsOut: string, log: (line: string) => void) {
  const sqlite = new DatabaseSync(database, { readOnly: true });
  const db = fromNodeSqlite(sqlite);
  const facts = (query: string) => pageFacts(db, releaseId, query);
  const words = (sqlite.prepare(HEADWORDS).all(releaseId) as { word: string }[]).map((row) => row.word);
  log(`${words.length} headwords`);
  await writeAll(pagesOut, words, facts, log);
  const expressions = expressionQueries(sqlite, releaseId);
  log(`${expressions.length} expression searches`);
  await writeAll(expressionsOut, expressions, facts, log);
  sqlite.close();
  return { headwords: words.length, expressionSearches: expressions.length };
}
