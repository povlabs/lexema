// The flight half of a word page's render (#647, rscPage.ts): the React Server
// Components render, as the Worker runs it.
//
// Its own Node process, under the `react-server` export condition and
// production React, with `rscRegister.mjs` turning every `"use client"` module
// into client references, as the build does. So the server components render
// with React's server build, every client component is a reference whose props
// are serialized, and what comes out is the flight stream the page's inline
// payload carries. The renderer is the edge one, the one the Worker runs.
//
// It seeds the development fixture the way `pnpm run seed:dev` does, renders
// each word named on the command line, and writes each word's flight chunks,
// in the order the stream sent them and each in base64, as JSON on stdout.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { renderToReadableStream } from "react-server-dom-webpack/server.edge";
import { PageOnlyCandidates, readUnrecordedPageTitles, UNRECORDED_PAGE_TITLES_FILE } from "../../src/import/pageOnlyCandidates.js";
import { seedSql } from "../../src/import/seedSql.js";
import { fromNodeSqlite } from "../../src/lookup/database.js";
import { loadFixturePages } from "../../src/source/rawPage.js";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";
import { Outcome, SearchPage } from "@/components/dictionary/SearchPage";

const WEB = fileURLToPath(new URL("..", import.meta.url));
const REPO = join(WEB, "..");
const RELEASE = "it-page-weight";
/** A Turnstile site key of the live key's length, so the report dialog is handed what it is handed live. */
const SITE_KEY = "0x4AAAAAAAAAAAAAAAAAAAAA";

/**
 * The development fixture, seeded the way `pnpm run seed:dev` seeds it: with
 * the raw pages under `fixtures/` and the committed record-less titles as
 * page-only entries.
 */
async function devDictionary(): Promise<DatabaseSync> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-page-weight-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(await readFile(join(REPO, "fixtures/dev-seed.jsonl"))));
    const { parts } = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: join(REPO, "src/db/schema.sql"),
      releaseId: RELEASE,
      archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
      license: "CC-BY-SA-4.0",
      rawPages: await loadFixturePages(join(REPO, "fixtures")),
      pageOnly: PageOnlyCandidates.listed(await readUnrecordedPageTitles(join(REPO, UNRECORDED_PAGE_TITLES_FILE))),
      onRejection: (rejection) => {
        throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
      },
    });
    const db = new DatabaseSync(":memory:");
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    return db;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * The client manifest the renderer reads. A client reference's id is
 * `<module URL>#<export>`; the module is named by its path under `web/`, so the
 * stream is the same on every machine, and it loads no chunk.
 */
const clientManifest = new Proxy({} as Record<string, { id: string; chunks: string[]; name: string }>, {
  get(_target, key) {
    if (typeof key !== "string" || !key.includes("#")) return undefined;
    const hash = key.lastIndexOf("#");
    return { id: relative(WEB, fileURLToPath(key.slice(0, hash))), chunks: [], name: key.slice(hash + 1) };
  },
});

async function flightOf(db: DatabaseSync, word: string): Promise<string[]> {
  const attempt = await searchAttempt(fromNodeSqlite(db), RELEASE, word);
  const stream = renderToReadableStream(
    <SearchPage raw={word} version={`${RELEASE}.0`}>
      <Outcome raw={word} attempt={attempt} siteKey={SITE_KEY} />
    </SearchPage>,
    clientManifest,
    {
      onError(error: unknown) {
        process.stderr.write(`flight error on ${word}: ${String(error)}\n`);
        process.exitCode = 1;
      },
    },
  );
  // Bytes, as base64: a chunk may end inside a character.
  const chunks: string[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk).toString("base64"));
  return chunks;
}

const db = await devDictionary();
const flights: Record<string, string[]> = {};
for (const word of process.argv.slice(2)) flights[word] = await flightOf(db, word);
db.close();
process.stdout.write(JSON.stringify(flights));
