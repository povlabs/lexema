// English meanings per sense (ADR 0035, #933): which senses get a request,
// what a model's reply becomes, how a meaning is keyed and stored, and that a
// run reaches the model through the Message Batches client alone. Read over
// the development fixture, seeded the way `pnpm run seed:dev` seeds D1.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import type Anthropic from "@anthropic-ai/sdk";
import { Candidates, DefinitionText, needOf, PickedMeaning, readReply, WrittenMeaning } from "../src/englishMeaning/englishMeaning.js";
import { planBatch, readResults } from "../src/englishMeaning/meaningBatch.js";
import { readMeaningPages, type MeaningPage } from "../src/englishMeaning/meaningPages.js";
import { MEANING_MODEL, PROMPT_VERSION } from "../src/englishMeaning/meaningRequest.js";
import { byKey, insertSql, rowsOfHeadwordsSql, type MeaningRow } from "../src/englishMeaning/meaningStore.js";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { dictionaryTables } from "../src/lookup/served.js";

const RELEASE = "it-meaning-test";

let dir: string;
let sqlite: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-meaning-"));
  const archive = join(dir, "dev-seed.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile("fixtures/dev-seed.jsonl")));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: "src/db/schema.sql",
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  sqlite = new DatabaseSync(":memory:");
  for (const part of parts) sqlite.exec(await readFile(part, "utf8"));
});

after(async () => {
  sqlite.close();
  await rm(dir, { recursive: true, force: true });
});

async function pagesOf(...words: string[]): Promise<MeaningPage[]> {
  const db = fromNodeSqlite(sqlite);
  return readMeaningPages(db, RELEASE, await dictionaryTables(db), words);
}

async function pageOf(word: string): Promise<MeaningPage> {
  const [page] = await pagesOf(word);
  assert.ok(page.senses.length > 0, `${word} has senses`);
  return page;
}

test("a sense whose record has English placed for it sends no request; one without does", async () => {
  // città's one noun record carries `city` and `town`; casa's carries `house` and `home`.
  for (const word of ["città", "casa"]) {
    const { page, senses } = await pageOf(word);
    for (const sense of senses) {
      const need = needOf(page, sense);
      assert.equal(need.kind, "source", `${word} ${sense.definitionIndex}`);
      if (need.kind !== "source") continue;
      assert.ok(need.meaning.translations.every((translation) => translation.langCode === "en"));
    }
    const plan = planBatch(await pagesOf(word), new Map());
    assert.equal(plan.requests.length, 0, `${word} sends nothing`);
  }
  // andare's verb places `go` on its first definition and `depart` on its second;
  // its third, `essere destinato a esser messo in una data posizione`, has none.
  const andare = await pageOf("andare");
  const verb = andare.senses.filter((sense) => sense.pos === "verb");
  assert.deepEqual(
    verb.map((sense) => needOf(andare.page, sense).kind),
    ["source", "source", "ask", "ask", "ask"],
  );
  const plan = planBatch([andare], new Map());
  const asked = plan.manifest.senses.filter((sense) => sense.need === "ask").map((sense) => `${sense.pos} ${sense.definition}`);
  assert.ok(asked.includes("verb essere destinato a esser messo in una data posizione"));
  assert.ok(!asked.some((line) => line.startsWith("verb muoversi")));
  assert.equal(plan.requests.length, asked.length);
});

test("a form-of sense gets no meaning and sends nothing", async () => {
  const plan = planBatch(await pagesOf("case", "andavano"), new Map());
  assert.deepEqual(
    plan.manifest.senses.map((sense) => [sense.headword, sense.need, sense.definition]),
    [
      ["case", "form-of", "plurale di casa"],
      ["andavano", "form-of", "terza persona plurale dell'imperfetto indicativo di andare"],
    ],
  );
  assert.equal(plan.requests.length, 0);
});

test("the candidates are the page's unplaced English, and a pick is one of them byte for byte", async () => {
  const sale = await pageOf("sale");
  const candidates = Candidates.ofPage(sale.page);
  assert.deepEqual(
    candidates.list.map((candidate) => candidate.word),
    sale.page
      .unplaced()
      .filter((translation) => translation.langCode === "en")
      .map((translation) => translation.word),
  );
  assert.deepEqual(
    candidates.list.map((candidate) => candidate.word),
    ["salt", "smelling-salts"],
  );
  const picked = readReply('{"origin":"picked","english":"salt"}', candidates);
  assert.equal(picked.kind, "meaning");
  if (picked.kind !== "meaning") return;
  assert.ok(picked.meaning instanceof PickedMeaning);
  assert.equal(picked.meaning.english, "salt");
});

test("a reply that picks a word the page does not list is refused, not stored as picked", async () => {
  const candidates = Candidates.ofPage((await pageOf("sale")).page);
  // Not on the page at all, a candidate in other case, and one with a trailing letter.
  for (const english of ["sodium chloride", "Salt", "salts"]) {
    const reply = readReply(JSON.stringify({ origin: "picked", english }), candidates);
    assert.equal(reply.kind, "refused", english);
  }
  assert.equal(candidates.pick("Salt"), undefined);
  // Malformed replies are refused too.
  for (const reply of ["salt", "{}", '{"origin":"picked"}', '{"origin":"guessed","english":"salt"}', '{"origin":"written","english":"salt\\nand pepper"}']) {
    assert.equal(readReply(reply, candidates).kind, "refused", reply);
  }
});

test("written English is the model's own, and written English that is a candidate is a pick", async () => {
  const candidates = Candidates.ofPage((await pageOf("sale")).page);
  const written = readReply('{"origin":"written","english":"wit"}', candidates);
  assert.equal(written.kind, "meaning");
  if (written.kind !== "meaning") return;
  assert.ok(written.meaning instanceof WrittenMeaning);
  const candidate = readReply('{"origin":"written","english":"salt"}', candidates);
  assert.equal(candidate.kind, "meaning");
  if (candidate.kind !== "meaning") return;
  assert.ok(candidate.meaning instanceof PickedMeaning, "the source's text is a pick, whoever names it");
});

test("a meaning is keyed on the SHA-256 of its definition text, so a changed definition has a new key", async () => {
  const studente = (await pageOf("studente")).senses[0];
  const text = studente.definition.text;
  assert.equal(text, "chi è regolarmente iscritto in un corso di studi");
  assert.equal(studente.definition.sha256, "60ae5f236e9463f907a69252e3b558bc308c743aa04c27537e4ed9e831583ad2");
  // ADR 0025: a newer source rewrites the definition; one changed character is another key.
  const rewritten = DefinitionText.of(`${text}.`);
  assert.notEqual(rewritten.sha256, studente.definition.sha256);
  assert.equal(DefinitionText.of(text).sha256, studente.definition.sha256);

  // A meaning stored for the old text is used for the old text, and not for the new one.
  const held: MeaningRow = {
    headword: "studente",
    definition_sha256: studente.definition.sha256,
    english: "student",
    origin: "picked",
    model: MEANING_MODEL,
    prompt_version: PROMPT_VERSION,
    generated_at: "2026-11-16T00:00:00.000Z",
    batch_id: "msgbatch_test",
  };
  const page = await pageOf("studente");
  assert.equal(planBatch([page], byKey([held])).requests.length, 0);
  const changed: MeaningPage = { ...page, senses: [{ ...studente, definition: rewritten }] };
  const plan = planBatch([changed], byKey([held]));
  assert.equal(plan.requests.length, 1);
  assert.deepEqual(
    plan.manifest.senses.filter((sense) => sense.headword === "studente" && sense.need !== "form-of").map((sense) => sense.need),
    ["ask"],
  );
});

/** A batch result that succeeded with `text`. */
const succeeded = (customId: string, text: string): Anthropic.Messages.Batches.MessageBatchIndividualResponse => ({
  custom_id: customId,
  result: {
    type: "succeeded",
    message: {
      id: `msg_${customId}`,
      type: "message",
      role: "assistant",
      model: MEANING_MODEL,
      content: [{ type: "text", text, citations: null }],
      stop_reason: "end_turn",
      stop_sequence: null,
      stop_details: null,
      container: null,
      usage: { input_tokens: 300, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    } as unknown as Anthropic.Messages.Message,
  },
});

test("a batch's results become stored meanings with their provenance, and a refused pick stores nothing", async () => {
  const plan = planBatch(await pagesOf("sale"), new Map());
  const asked = plan.manifest.senses.flatMap((sense) => (sense.need === "ask" ? [sense] : []));
  assert.ok(asked.length >= 3);
  const [first, second, third] = asked;
  const read = readResults(
    plan.manifest,
    "msgbatch_test",
    [
      succeeded(first.customId, '{"origin":"picked","english":"salt"}'),
      succeeded(second.customId, '{"origin":"picked","english":"sodium"}'),
      succeeded(third.customId, '{"origin":"written","english":"common sense"}'),
    ],
    "2026-11-16T12:00:00.000Z",
  );
  assert.deepEqual(
    read.stored.map((stored) => [stored.key.definitionSha256, stored.meaning.origin, stored.meaning.english, stored.model, stored.promptVersion, stored.batchId]),
    [
      [first.definitionSha256, "picked", "salt", MEANING_MODEL, PROMPT_VERSION, "msgbatch_test"],
      [third.definitionSha256, "written", "common sense", MEANING_MODEL, PROMPT_VERSION, "msgbatch_test"],
    ],
  );
  assert.deepEqual(
    read.results.map((result) => result.kind),
    ["stored", "refused", "stored"],
  );
  assert.deepEqual(read.tokens, { input: 900, output: 60, cacheRead: 0, cacheWrite: 0 });

  // The rows land in `english_meaning`, and nowhere else: `translations` and the stored line stay as they were.
  const lineBefore = sqlite.prepare("SELECT raw_json FROM source_record_json j JOIN source_record r USING (record_id) WHERE r.word = 'sale' ORDER BY r.line_no").all();
  sqlite.exec(insertSql(read.stored));
  sqlite.exec(insertSql(read.stored)); // collected twice: the second writes nothing
  const rows = sqlite.prepare(rowsOfHeadwordsSql(["sale"])).all() as unknown as MeaningRow[];
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.generated_at === "2026-11-16T12:00:00.000Z" && row.batch_id === "msgbatch_test"));
  assert.deepEqual(sqlite.prepare("SELECT raw_json FROM source_record_json j JOIN source_record r USING (record_id) WHERE r.word = 'sale' ORDER BY r.line_no").all(), lineBefore);
  // A held meaning sends no second request.
  const again = planBatch(await pagesOf("sale"), byKey(rows));
  assert.equal(again.requests.length, plan.requests.length - 2);
  assert.deepEqual(
    again.manifest.senses.flatMap((sense) => (sense.need === "held" ? [sense.definitionSha256] : [])),
    [first.definitionSha256, third.definitionSha256],
  );
  sqlite.exec("DELETE FROM english_meaning");
});

test("the table refuses an origin other than picked or written, and a key that is not a SHA-256", () => {
  const row = (origin: string, sha: string) =>
    `INSERT INTO english_meaning VALUES ('sale', '${sha}', 'salt', '${origin}', 'm', 'p', '2026-11-16T00:00:00Z', 'b')`;
  const sha = "a".repeat(64);
  assert.throws(() => sqlite.exec(row("source", sha)));
  assert.throws(() => sqlite.exec(row("picked", "abc")));
  sqlite.exec(row("picked", sha));
  sqlite.exec("DELETE FROM english_meaning");
});

/** Every file under `root` with one of `extensions`, recursively. */
async function filesUnder(root: string, extensions: readonly string[]): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !extensions.some((extension) => entry.name.endsWith(extension))) continue;
    const path = join(entry.parentPath, entry.name);
    if (path.includes("node_modules") || path.includes("/.") || path.includes("/dist/")) continue;
    found.push(path);
  }
  return found;
}

test("only src/englishMeaning/ reaches the model, and no Worker or web/ code imports it or the SDK", async () => {
  const sources = [...(await filesUnder("src", [".ts"])), ...(await filesUnder("web", [".ts", ".tsx"]))];
  for (const file of sources) {
    const text = await readFile(file, "utf8");
    const inJob = file.startsWith(join("src", "englishMeaning"));
    if (!inJob) {
      assert.ok(!text.includes("@anthropic-ai/sdk"), `${file} imports the Anthropic SDK`);
      assert.ok(!/englishMeaning\//.test(text), `${file} imports the English meaning job`);
    }
    assert.ok(!text.includes("api.anthropic.com"), `${file} calls the API by hand`);
  }
  // And the job's one model call is a batch: the CLI creates batches, never a single message.
  const cli = await readFile("src/englishMeaning/meaningBatchCli.ts", "utf8");
  assert.ok(cli.includes("messages.batches.create"));
  assert.ok(!/messages\.create\(|messages\.stream\(/.test(cli));
});
