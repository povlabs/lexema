// Render every word page of one seeded dictionary (#808), through the code
// the site runs: `searchAttempt` answers the word as the page's search does,
// and `Outcome`, the page's own component, renders the answer, which builds
// the page with `wordPage()` (web/lib/dictionary/wordPage.ts).
//
// `pnpm run diff:pages` copies this directory into the tree of each commit it
// compares and runs this file there, so both sides render through one
// renderer and differ only in the site's code and data:
//
//   TSX_TSCONFIG_PATH=web/tsconfig.json NODE_ENV=production node --import tsx \
//     web/pageDiff/renderPages.ts <dictionary.sqlite> <words file> <snapshot file>
//
// The words file holds one word per line. The snapshot gets one JSON line per
// word with a page (pageDiff.ts); a word the search does not find has none.

import { createHash } from "node:crypto";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fromNodeSqlite, type LookupDatabase } from "@lexema/lookup/database.ts";
import { Outcome } from "@/components/dictionary/SearchPage";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";
import type { RenderedPage } from "./pageDiff.ts";

/** Every headword of a release: each distinct `word` of an archive record or a page-only entry, as #699 counted them. */
const HEADWORDS = `SELECT word FROM source_record WHERE release_id = ?1
  UNION SELECT word FROM recovered_entry WHERE release_id = ?1
  ORDER BY word`;

export const headwordsOf = (db: DatabaseSync, releaseId: string): string[] =>
  (db.prepare(HEADWORDS).all(releaseId) as { word: string }[]).map(({ word }) => word);

/** The one release the dictionary serves. */
export function servedReleaseOf(db: DatabaseSync): string {
  const masters = db.prepare("SELECT DISTINCT master_release_id AS id FROM served_release").all() as { id: string }[];
  if (masters.length !== 1) throw new Error(`the dictionary serves ${masters.length} releases, not one`);
  return masters[0].id;
}

/** `word`'s page as the site renders it, or undefined when searching it opens none. */
export async function renderPage(db: LookupDatabase, releaseId: string, word: string): Promise<string | undefined> {
  const attempt = await searchAttempt(db, releaseId, word);
  if (attempt.outcome !== "found" && attempt.outcome !== "declared-lemma") return undefined;
  // No JSX: a commit whose tsconfig does not include this directory still runs it.
  return renderToStaticMarkup(createElement(Outcome, { raw: word, attempt }));
}

/** Each of `words` that has a page, with its page's digest, in the order given. */
export async function* renderPages(
  db: DatabaseSync,
  releaseId: string,
  words: Iterable<string>,
): AsyncGenerator<RenderedPage> {
  const lookup = fromNodeSqlite(db);
  for (const word of words) {
    const markup = await renderPage(lookup, releaseId, word);
    if (markup !== undefined) yield { word, sha256: createHash("sha256").update(markup).digest("hex") };
  }
}

async function main([database, wordsFile, out]: string[]): Promise<void> {
  if (database === undefined || wordsFile === undefined || out === undefined) {
    throw new Error("usage: web/pageDiff/renderPages.ts <dictionary.sqlite> <words file> <snapshot file>");
  }
  const db = new DatabaseSync(database, { readOnly: true });
  const words = (await readFile(wordsFile, "utf8")).split("\n").filter((word) => word !== "");
  const file = createWriteStream(out);
  const started = Date.now();
  let i = 0;
  for await (const page of renderPages(db, servedReleaseOf(db), words)) {
    if (!file.write(`${JSON.stringify(page)}\n`)) await once(file, "drain");
    if (++i % 20000 === 0) process.stderr.write(`${i} pages rendered, ${Math.round((Date.now() - started) / 1000)} s\n`);
  }
  file.end();
  await once(file, "finish");
  db.close();
  process.stderr.write(`${i} pages of ${words.length} words rendered in ${Math.round((Date.now() - started) / 1000)} s\n`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
