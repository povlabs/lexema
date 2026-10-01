// The requests the search field sends while a reader types (#387), counted
// over the development fixture with the server's own `suggest()` behind a fake
// `/suggest`, so what the field shows can be compared with what the server
// would have answered at every keystroke.

import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../../src/import/seedSql.js";
import type { LookupDatabase } from "../../src/lookup/database.js";
import { offered, suggest } from "../../src/lookup/suggest.js";
import { readOnlyDictionary } from "../../test/databases.js";
import { DEBOUNCE_MS } from "@/components/dictionary/SearchField";
import type { SuggestAnswer } from "@/lib/dictionary/suggestAnswer.ts";
import { suggestPath, SuggestionAsker, type SuggestRequest } from "@/lib/dictionary/suggestionAsker.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-asker-test";

let dir: string;
let sqlite: DatabaseSync;
let dictionary: LookupDatabase;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-asker-"));
  const archive = join(dir, "dev-seed.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(join(REPO, "fixtures/dev-seed.jsonl"))));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  sqlite = new DatabaseSync(":memory:");
  for (const part of parts) sqlite.exec(await readFile(part, "utf8"));
  dictionary = readOnlyDictionary(sqlite);
});

after(async () => {
  sqlite.close();
  await rm(dir, { recursive: true, force: true });
});

/** What `GET /suggest` answers for a prefix, as its route builds it. */
async function served(prefix: string): Promise<SuggestAnswer> {
  const result = await suggest({ db: dictionary, releaseId: RELEASE, prefix });
  return result.outcome === "suggested"
    ? { outcome: "suggested", suggestions: offered(result) }
    : { outcome: "rejected", reason: result.rejection.reason, limit: result.rejection.limit };
}

/** A field with a fake `/suggest` that counts what it is sent, and a clock the test moves. */
function field() {
  const sent: string[] = [];
  const pending: Promise<SuggestAnswer>[] = [];
  const request: SuggestRequest = (prefix) => {
    sent.push(prefix);
    const answer = served(prefix);
    pending.push(answer);
    return answer;
  };
  let shown: SuggestAnswer | null = null;
  const asker = new SuggestionAsker(request, (answer) => (shown = answer), DEBOUNCE_MS);
  return {
    sent,
    shown: () => shown,
    type: (prefix: string) => asker.ask(prefix),
    /** Let `ms` pass, and every answer that came back in it arrive. */
    wait: async (ms: number) => {
      mock.timers.tick(ms);
      await Promise.all(pending);
      await new Promise((settled) => setImmediate(settled));
    },
  };
}

const keystrokes = (word: string): string[] => [...word].map((_, end) => word.slice(0, end + 1));

test("typing andare key by key sends at most two requests, even waiting out the debounce at every key", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const reader = field();
    for (const prefix of keystrokes("andare")) {
      reader.type(prefix);
      await reader.wait(DEBOUNCE_MS);
      // At every key the list is what the server would answer, or nothing under two letters.
      assert.deepEqual(reader.shown(), prefix.length < 2 ? null : await served(prefix), prefix);
    }
    assert.ok(reader.sent.length <= 2, reader.sent.join(", "));
    // `an` holds fewer than ten words, so everything after it is answered from it.
    assert.deepEqual(reader.sent, ["an"]);
  } finally {
    mock.timers.reset();
  }
});

test("a key inside the wait sends nothing, and a prefix outside the complete answer is asked for", async () => {
  assert.equal(DEBOUNCE_MS, 250);
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const reader = field();
    for (const prefix of keystrokes("andare")) {
      reader.type(prefix);
      await reader.wait(DEBOUNCE_MS - 1);
    }
    await reader.wait(1);
    assert.deepEqual(reader.sent, ["andare"]);
    assert.deepEqual(reader.shown(), await served("andare"));

    // A prefix that does not start with the last complete answer's is asked for.
    reader.type("ca");
    await reader.wait(DEBOUNCE_MS);
    reader.type("cas");
    await reader.wait(DEBOUNCE_MS);
    assert.deepEqual(reader.sent, ["andare", "ca"]);
    assert.deepEqual(reader.shown(), await served("cas"));
  } finally {
    mock.timers.reset();
  }
});

test("a full answer is asked again for a longer prefix", async () => {
  const full: SuggestAnswer = { outcome: "suggested", suggestions: Array.from({ length: 10 }, (_, i) => `zz${i}`) };
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const sent: string[] = [];
    let shown: SuggestAnswer | null = null;
    const asker = new SuggestionAsker(async (prefix) => (sent.push(prefix), full), (answer) => (shown = answer), DEBOUNCE_MS);
    for (const prefix of ["zz", "zz1"]) {
      asker.ask(prefix);
      mock.timers.tick(DEBOUNCE_MS);
      await new Promise((settled) => setImmediate(settled));
    }
    assert.deepEqual(sent, ["zz", "zz1"]);
    assert.deepEqual(shown, full);
  } finally {
    mock.timers.reset();
  }
});

test("a suggestion request names the served version, so a browser keeps each version's answers apart (#368)", () => {
  const before = suggestPath("vado v", "it-0c432803.0");
  const after = suggestPath("vado v", "it-0c432803.chg-0123456789ab");
  assert.notEqual(after, before);
  for (const [path, version] of [[before, "it-0c432803.0"], [after, "it-0c432803.chg-0123456789ab"]] as const) {
    const url = new URL(path, "https://lexema.fyi");
    assert.equal(url.pathname, "/suggest");
    assert.equal(url.searchParams.get("q"), "vado v", "the route reads the prefix as typed");
    assert.equal(url.searchParams.get("v"), version);
  }
});
