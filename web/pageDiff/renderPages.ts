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
// The words file holds one word per line (pageWords.ts names which). The
// snapshot gets one JSON line per word with a page (pageDiff.ts); a word the
// search does not find has none.

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
import { servedReleaseOf } from "./pageWords.ts";

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
