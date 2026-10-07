// Every word page of the release, grouped by its shape, and the rule of
// design-system-manifest.md § "How a word page renders" each shape stands on
// (#707). It changes no rule, page or row: it reads the pages `wordPage()` and
// `phrasePage()` build, as the search page does.
//
// The release is seeded once by the #699 tool, then two steps run here:
//
//   pnpm exec tsx tools/measureEmptyWordPages.ts seed <it-extract.jsonl.gz> <itwiktionary-20260701 dump> <new work dir>
//   TSX_TSCONFIG_PATH=web/tsconfig.json pnpm exec tsx tools/measureWordPageShapes.ts search <it-extract.jsonl.gz> <work dir>
//   TSX_TSCONFIG_PATH=web/tsconfig.json pnpm exec tsx tools/measureWordPageShapes.ts shapes <it-extract.jsonl.gz> <work dir> > result.json
//
// `search` searches every headword (`searchAttempt`), builds its page and
// writes each page's facts to <work dir>/pages.jsonl; then a sample of
// expression searches, one per expression word an inflected form exists for
// (tools/wordPageShapes/search.ts), to <work dir>/expressions.jsonl; and to
// <work dir>/pages.meta.json the last commit that changed the page code
// (`web/lib`, `src`); about 20 minutes. It refuses to run on a tree whose page
// code differs from that commit, so the commit it names is the code that built
// the pages.
//
// `shapes` groups each file's pages by shape (tools/wordPageShapes/shape.ts)
// and names the rule each shape stands on, or `no rule`, `rules disagree` or
// `page breaks the rule`.
//
// reports/2026-10-07-word-page-shapes.md is its first run, and
// reports/2026-10-07-word-page-shapes.json its output.

import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { sha256Of } from "../src/deploy/dataFiles.js";

const [step, archive, workArg] = process.argv.slice(2);
if ((step !== "search" && step !== "shapes") || !archive || !workArg) {
  throw new Error("usage: tools/measureWordPageShapes.ts search|shapes <archive.jsonl.gz> <work dir>");
}
const work = resolve(workArg);
const database = join(work, "release.sqlite");
const pagesFile = join(work, "pages.jsonl");
const expressionsFile = join(work, "expressions.jsonl");
const metaFile = join(work, "pages.meta.json");
const log = (line: string): void => void process.stderr.write(`${line}\n`);
const releaseId = `it-${(await sha256Of(archive)).slice(0, 8)}`;

/** The code a page is built from: the web's page builders and the lookup they read. */
const PAGE_CODE = ["web/lib", "src"];

if (step === "search") {
  const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
  const changed = git("status", "--porcelain", "--", ...PAGE_CODE);
  if (changed !== "") throw new Error(`the page code differs from HEAD, so no commit names it:\n${changed}`);
  // The last commit that changed the page code: it stays on main when this branch is squashed.
  const commit = git("log", "-1", "--format=%H", "--", ...PAGE_CODE);
  // Imported here: the word page's modules resolve through web/tsconfig.json.
  const { search } = await import("./wordPageShapes/search.ts");
  const counts = await search(database, releaseId, pagesFile, expressionsFile, log);
  await writeFile(metaFile, `${JSON.stringify({ release: releaseId, commit, ...counts }, null, 2)}\n`);
} else {
  const { census } = await import("./wordPageShapes/shape.ts");
  const meta = JSON.parse(await readFile(metaFile, "utf8")) as { release: string; commit: string; headwords: number; expressionSearches: number };
  if (meta.release !== releaseId) throw new Error(`${pagesFile} is a search of ${meta.release}, not ${releaseId}`);
  const read = async (file: string, searched: number) => {
    const lines = createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity });
    const result = await census(
      (async function* () {
        for await (const line of lines) if (line !== "") yield JSON.parse(line);
      })(),
    );
    if (result.searched !== searched) throw new Error(`${file} holds ${result.searched} pages, the search ${searched}`);
    return result;
  };
  const headwords = await read(pagesFile, meta.headwords);
  const expressionSearches = await read(expressionsFile, meta.expressionSearches);
  console.log(JSON.stringify({ release: meta.release, commit: meta.commit, headwords, expressionSearches }, null, 2));
}
