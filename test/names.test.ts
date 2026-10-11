// Name entries (ADR 0032, #794): the categories and the snapshot that hold
// Wikidata's proper names, the queries that fetch them, `load:names` writing
// them into a seeded master as a diff, and a lookup reading them after the
// source's readings. Inputs are verbatim: archive lines 1284 `Iran`, 21651
// `sale` and 30901 `Giulia` of it-0c432803 (fixtures/names/), and items of the
// committed snapshot as Wikidata gave them on 2026-10-11.

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { touchedWords, wordsOfNames } from "../src/deploy/touchedWords.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookupBatch } from "../src/lookup/batch.js";
import { exists, lookup } from "../src/lookup/lookup.js";
import { BESIDE_SOURCE_HEADS_SQL, BESIDE_SOURCE_SQL } from "../src/lookup/besideSource.js";
import { NAME_HEADS_SQL, NAME_SQL } from "../src/lookup/names.js";
import { entryKey, isNameEntry, publicEntryId, type Reading } from "../src/lookup/types.js";
import { isShownMeaning, missingForNames, planNames, unwrittenNames } from "../src/names/loadNames.js";
import { categoryRank, NAME_CATEGORIES } from "../src/names/nameCategories.js";
import { InvalidNameItem, nameItem, wikidataItemUrl, type NameItem, type NameItemSpec } from "../src/names/nameItem.js";
import { NAME_SNAPSHOT_PATH, parseSnapshot, readNameSnapshot, snapshotText } from "../src/names/nameSnapshot.js";
import { categoryCountQuery, categoryQuery, itemsOf, runQuery } from "../src/names/wikidataQuery.js";
import { parseDeclaration } from "../src/update/declaration.js";
import type { MasterReader } from "../src/update/master.js";
import { masterUpgradeSql } from "../src/update/masterUpgrade.js";
import { PlanCounts } from "../src/update/planCounts.js";

const RELEASE = "it-names";
const SCHEMA = "src/db/schema.sql";
const FIXTURES = resolve("fixtures/names");

/** Items of the committed snapshot, verbatim. */
const SPECS: Record<string, NameItemSpec> = {
  iran: { item: "Q794", label: "Iran", description: "stato del Medio Oriente", category: "country" },
  europa: { item: "Q46", label: "Europa", description: "continente della Terra", category: "continent" },
  mediterraneo: { item: "Q4918", label: "mar Mediterraneo", description: "bacino marino compreso tra l'Africa settentrionale, l'Europa meridionale e l'Asia occidentale", category: "sea" },
  giulia: { item: "Q686341", label: "Giulia", description: "fiume", category: "river" },
  europaIsland: { item: "Q193089", label: "Europa", description: "isola nel Canale del Mozambico", category: "island" },
  hormuz: { item: "Q695265", label: "Hormuz", description: "isola dell'Iran", category: "island" },
  sale: { item: "Q17660", label: "Sale", description: "comune italiano", category: "comune" },
};
const ITEMS: Record<keyof typeof SPECS, NameItem> = Object.fromEntries(Object.entries(SPECS).map(([key, spec]) => [key, nameItem(spec)])) as Record<keyof typeof SPECS, NameItem>;
const SNAPSHOT: NameItem[] = Object.values(ITEMS);

test("the categories are the ruled list, in the order they are shown, and the table accepts exactly them", async () => {
  assert.deepEqual(NAME_CATEGORIES.map((category) => category.id), [
    "country", "continent", "sea", "river", "lake", "mountain", "island", "comune", "city",
    "international-organization", "political-party", "listed-company", "football-club", "language", "currency", "holiday",
  ]);
  const schema = await readFile(SCHEMA, "utf8");
  const check = /category\s+TEXT NOT NULL CHECK \(category IN \(([^)]*)\)\)/.exec(schema)?.[1];
  assert.ok(check !== undefined);
  assert.deepEqual(check.split(",").map((value) => value.trim().replace(/^'|'$/g, "")), NAME_CATEGORIES.map((category) => category.id));
  assert.ok(categoryRank("country") < categoryRank("river") && categoryRank("river") < categoryRank("football-club"));
});

test("a name item without an item id, a label, a description or a listed category cannot be made", () => {
  const refused = (spec: NameItemSpec) => assert.throws(() => nameItem(spec), InvalidNameItem);
  refused({ ...SPECS.hormuz, item: "P31" as `Q${number}` });
  refused({ ...SPECS.hormuz, item: "Q0" });
  refused({ ...SPECS.hormuz, label: "" });
  refused({ ...SPECS.hormuz, label: "Hormuz " });
  refused({ ...SPECS.hormuz, description: "  " });
  // @ts-expect-error `person` is not a category: people wait for their own ruling
  refused({ ...SPECS.hormuz, category: "person" });
  // @ts-expect-error a spec is not an item until `nameItem` checks it
  const unchecked: NameItem = SPECS.hormuz;
  assert.ok(unchecked);
  assert.equal(wikidataItemUrl(ITEMS.hormuz.item), "https://www.wikidata.org/wiki/Q695265");
});

test("the snapshot holds each item once, in shown order, and refuses a text names:fetch would not write", async () => {
  const text = snapshotText([ITEMS.hormuz, ITEMS.iran, ITEMS.sale, ITEMS.europa, { ...ITEMS.iran, category: "comune" } as NameItem]);
  // By category, then the older item first; an item two categories give is kept under the first.
  assert.deepEqual(parseSnapshot(text).map((item) => [item.item, item.category]), [["Q794", "country"], ["Q46", "continent"], ["Q695265", "island"], ["Q17660", "comune"]]);
  assert.equal(text.split("\n")[0], '{"item":"Q794","label":"Iran","description":"stato del Medio Oriente","category":"country"}');
  const [first, second, ...rest] = text.split("\n");
  assert.throws(() => parseSnapshot([second, first, ...rest].join("\n")), /not in snapshot order/);
  assert.throws(() => parseSnapshot(`${first}\n${first}\n`), /twice/);
  assert.throws(() => parseSnapshot(text.replace('"label":"Iran"', '"label":""')), /line 1/);

  // The committed snapshot is one: every item checked, each once, in order.
  const committed = await readNameSnapshot();
  assert.ok(committed.length > 25_000, `${committed.length} items in ${NAME_SNAPSHOT_PATH}`);
  assert.equal(new Set(committed.map((item) => item.item)).size, committed.length);
  for (const spec of Object.values(SPECS)) {
    assert.deepEqual(committed.find((item) => item.item === spec.item), nameItem(spec), spec.item);
  }
});

test("each category is one query: its class, its subclasses where it says so, an Italian label, description and Wikipedia page", () => {
  const [country, , sea, , , , , , city, , , , , language] = NAME_CATEGORIES;
  const countries = categoryQuery(country);
  assert.match(countries, /\?item wdt:P31 wd:Q6256 \./);
  assert.match(countries, /schema:isPartOf <https:\/\/it\.wikipedia\.org\/>/);
  assert.match(countries, /FILTER\(LANG\(\?itLabel\) = "it"\)/);
  // The euro's label is `mul`, the label Wikidata shows in Italian where no `it` one is set.
  assert.match(countries, /BIND\(COALESCE\(\?itLabel, \?mulLabel\) AS \?label\)/);
  assert.match(countries, /schema:description \?description \. FILTER\(LANG\(\?description\) = "it"\)/);
  assert.match(categoryQuery(sea), /\?item wdt:P31\/wdt:P279\* wd:Q165 \./);
  assert.match(categoryQuery(city), /wdt:P1082 \?population \. FILTER\(\?population > 100000\)/);
  assert.match(categoryQuery(language), /MINUS \{ \?item wdt:P31\/wdt:P279\* wd:Q629206 \. \}/);
  // The count query reads the same items, a description optional.
  assert.match(categoryCountQuery(country), /OPTIONAL \{ \?item schema:description/);
});

test("an answer becomes name items, each once, and an answer cut off by a timeout is asked again", async () => {
  const row = (item: string, label: string, description: string) => ({
    item: { type: "uri", value: `http://www.wikidata.org/entity/${item}` },
    label: { type: "literal", value: label },
    description: { type: "literal", value: description },
  });
  assert.deepEqual(itemsOf("island", [row("Q695265", "Hormuz", "isola dell'Iran"), row("Q695265", "Hormuz", "altra")]), [ITEMS.hormuz]);
  assert.throws(() => itemsOf("island", [{ ...row("Q1", "x", "y"), item: { type: "uri", value: "http://example.org/Q1" } }]), /names no item/);
  assert.throws(() => itemsOf("island", [row("Q1", "x", "")]), InvalidNameItem);

  const whole = JSON.stringify({ results: { bindings: [row("Q695265", "Hormuz", "isola dell'Iran")] } });
  const answers = [new Response(`${whole.slice(0, 40)}SPARQL-QUERY: java.util.concurrent.TimeoutException`, { status: 200 }), new Response(whole, { status: 200 })];
  const asked: string[] = [];
  const fetchStub = (async (url: string | URL | Request, init?: RequestInit) => {
    asked.push(String(url));
    assert.match(String((init?.headers as Record<string, string>)["User-Agent"]), /^lexema-names/);
    const answer = answers.shift();
    assert.ok(answer);
    return answer;
  }) as typeof fetch;
  const pauses: number[] = [];
  assert.deepEqual(await runQuery("SELECT 1", fetchStub, async (ms) => void pauses.push(ms)), JSON.parse(whole).results.bindings);
  assert.equal(asked.length, 2);
  assert.deepEqual(pauses, [5_000], "it waits before asking again");
  await assert.rejects(runQuery("SELECT 1", (async () => new Response("bad query", { status: 400 })) as typeof fetch), /answered 400/);
});

test("a meaning is a gloss the page shows: not the missing-definition placeholder, and not the headword alone", () => {
  assert.equal(isShownMeaning("stato del Medio Oriente", "Iran"), true);
  assert.equal(isShownMeaning("definizione mancante; se vuoi, aggiungila tu", "Giulia"), false);
  assert.equal(isShownMeaning("Giulia", "Giulia"), false);
  assert.equal(isShownMeaning("", "Giulia"), false);
});

const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all().map((row) => ({ ...row }));

/** The fixture's three archive lines, seeded. */
async function seeded(): Promise<DatabaseSync> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-names-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(await readFile(join(FIXTURES, "archive-lines.jsonl"))));
    const report = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: SCHEMA,
      releaseId: RELEASE,
      license: "CC-BY-SA-4.0",
      onRejection: (rejection) => {
        throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
      },
    });
    const db = new DatabaseSync(":memory:");
    for (const part of report.parts) db.exec(await readFile(part, "utf8"));
    return db;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const readerOf = (db: DatabaseSync): MasterReader => ({ query: <Row>(sql: string) => db.prepare(sql).all() as Row[] });

/** Run the plan's SQL as one transaction, as `wrangler d1 execute --file` does. */
function execute(db: DatabaseSync, sql: string): void {
  db.exec("BEGIN");
  try {
    db.exec(sql);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Each reading as a page tells it apart: a record's word and part of speech, or a name entry's item and description. */
const shown = (readings: readonly Reading[]): string[] =>
  readings.map((reading) => (isNameEntry(reading) ? `${reading.nameItem} ${reading.posTitle}: ${reading.description}` : `${reading.word} ${reading.pos}`));

async function readingsOf(db: DatabaseSync, word: string): Promise<string[]> {
  const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
  return result.outcome === "found" ? shown(result.readings) : [result.outcome];
}

test("load:names writes the names whose key nothing answers, once, after the upgrade, and a lookup reads them last", async () => {
  const schema = await readFile(SCHEMA, "utf8");
  const db = await seeded();
  try {
    // A master seeded before #794: no name_entry.
    db.exec("DROP INDEX name_entry_by_key; DROP TABLE name_entry;");
    const before = await Promise.all(["Iran", "sale", "Giulia", "Hormuz", "europa", "mar Mediterraneo"].map((word) => readingsOf(db, word)));
    assert.deepEqual(before, [["Iran name"], ["sale noun"], ["Giulia name"], ["not-found"], ["not-found"], ["not-found"]]);
    const recordsBefore = all(db, "SELECT * FROM source_record_json ORDER BY record_id");

    const reader = readerOf(db);
    const plan = planNames(reader, SNAPSHOT);
    // Iran has a meaning; `Sale` is the key `sale`, which the salt noun answers. Giulia's record has no gloss.
    assert.deepEqual(plan.explained.map((item) => item.label), ["Iran", "Sale"]);
    assert.deepEqual(plan.written.map((item) => item.item), ["Q46", "Q4918", "Q686341", "Q193089", "Q695265"]);
    assert.deepEqual(plan.counts.toJSON(), { records: { added: 0, changed: 0, removed: 0 }, written: { name_entry: 5 }, deleted: {} });
    assert.deepEqual(wordsOfNames(plan), touchedWords(["Europa", "Giulia", "Hormuz", "mar Mediterraneo"]));
    // The SQL creates nothing (#509): the upgrade gives the master the table, and the plan is the same after it.
    assert.doesNotMatch(plan.sql, /\b(CREATE|DROP|ALTER)\b/);
    assert.deepEqual(missingForNames(reader), ["name_entry", "name_entry_by_key"]);
    execute(db, masterUpgradeSql(schema));
    assert.deepEqual(missingForNames(reader), []);
    assert.equal(planNames(reader, SNAPSHOT).sql, plan.sql);
    execute(db, plan.sql);
    assert.deepEqual(unwrittenNames(reader, plan), []);

    assert.deepEqual(await readingsOf(db, "Iran"), ["Iran name"]);
    assert.deepEqual(await readingsOf(db, "sale"), ["sale noun"]);
    // Giulia's record stays as it is, and the river comes after it.
    assert.deepEqual(await readingsOf(db, "Giulia"), ["Giulia name", "Q686341 Nome proprio: fiume"]);
    assert.deepEqual(await readingsOf(db, "hormuz"), ["Q695265 Nome proprio: isola dell'Iran"]);
    // Two items one label names are two readings: the continent, then the island.
    assert.deepEqual(await readingsOf(db, "Europa"), ["Q46 Nome proprio: continente della Terra", "Q193089 Nome proprio: isola nel Canale del Mozambico"]);
    assert.deepEqual(await readingsOf(db, "mar mediterraneo"), [`Q4918 Nome proprio: ${SPECS.mediterraneo.description}`]);
    assert.deepEqual(all(db, "SELECT * FROM source_record_json ORDER BY record_id"), recordsBefore);

    const again = planNames(reader, SNAPSHOT);
    assert.equal(again.sql, "");
    assert.equal(again.counts, PlanCounts.NONE);

    // A refresh is a diff: a changed description is written again, and an item the snapshot dropped is removed.
    const refreshed = SNAPSHOT.filter((item) => item.item !== "Q193089").map((item) => (item.item === "Q695265" ? nameItem({ ...item, description: "isola del Golfo Persico" }) : item));
    const refresh = planNames(reader, refreshed);
    assert.deepEqual([refresh.written.map((item) => item.item), refresh.removed.map((row) => row.item)], [["Q695265"], ["Q193089"]]);
    assert.deepEqual(refresh.counts.toJSON(), { records: { added: 0, changed: 0, removed: 0 }, written: { name_entry: 1 }, deleted: { name_entry: 2 } });
    execute(db, refresh.sql);
    assert.deepEqual(unwrittenNames(reader, refresh), []);
    assert.deepEqual(await readingsOf(db, "Europa"), ["Q46 Nome proprio: continente della Terra"]);
    assert.deepEqual(await readingsOf(db, "Hormuz"), ["Q695265 Nome proprio: isola del Golfo Persico"]);
  } finally {
    db.close();
  }
});

test("a name entry is an ordinary reading: a proper name, its description its one definition, its item its ref and id", async () => {
  const db = await seeded();
  try {
    execute(db, planNames(readerOf(db), SNAPSHOT).sql);
    const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "Hormuz" });
    assert.ok(result.outcome === "found");
    const [hormuz] = result.readings;
    assert.ok(isNameEntry(hormuz));
    assert.deepEqual(
      [hormuz.word, hormuz.pos, hormuz.posTitle, hormuz.description, hormuz.ref, hormuz.isAboutQuery, hormuz.senses, hormuz.recovered, hormuz.forms],
      ["Hormuz", "name", "Nome proprio", "isola dell'Iran", { releaseId: RELEASE, wiki: "www.wikidata.org", item: "Q695265" }, true, [], [], []],
    );
    assert.equal(entryKey(hormuz), "name-Q695265");
    assert.equal(publicEntryId({ releaseId: RELEASE, nameItem: hormuz.nameItem }), `${RELEASE}:wikidata:Q695265`);

    // `/exists` finds it, crediting its item.
    const found = await exists({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "hormuz" });
    assert.ok(found.outcome === "present");
    assert.deepEqual([found.word, found.nameItem], ["Hormuz", "Q695265"]);
    const record = await exists({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "Giulia" });
    assert.ok(record.outcome === "present");
    assert.deepEqual([record.word, record.nameItem], ["Giulia", undefined]);

    // The batch answers each word with the same entries, in the same order, under the same ids.
    const { answers } = await lookupBatch({ db: fromNodeSqlite(db), releaseId: RELEASE, queries: ["Europa", "Giulia", "sale", "qqqqqq"] });
    assert.deepEqual(
      answers.map((answer) => (answer.outcome === "found" ? answer.candidates.map((candidate) => `${publicEntryId(candidate)} ${candidate.word} ${candidate.pos} ${candidate.posTitle}`) : answer.outcome)),
      [
        [`${RELEASE}:wikidata:Q46 Europa name Nome proprio`, `${RELEASE}:wikidata:Q193089 Europa name Nome proprio`],
        [`${RELEASE}:3 Giulia name Nome proprio`, `${RELEASE}:wikidata:Q686341 Giulia name Nome proprio`],
        [`${RELEASE}:2 sale noun Sostantivo`],
        "not-found",
      ],
    );
  } finally {
    db.close();
  }
});

test("a lookup reads a key's name entries by index, beside the hand-kept readings in one statement, and a dictionary without the table is sent none naming it", async () => {
  const db = await seeded();
  try {
    const plan = (sql: string, ...params: string[]) => (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((row) => row.detail);
    for (const steps of [
      plan(NAME_SQL, "europa"),
      plan(NAME_HEADS_SQL, JSON.stringify(["europa", "hormuz"])),
      plan(BESIDE_SOURCE_SQL, "europa"),
      plan(BESIDE_SOURCE_HEADS_SQL, JSON.stringify(["europa", "hormuz"])),
    ]) {
      assert.ok(steps.some((step) => step.includes("name_entry_by_key")), steps.join("\n"));
      assert.ok(!steps.some((step) => /SCAN (name_entry|hand_kept_definition)\b/.test(step)), steps.join("\n"));
    }
    // With both tables, the hand-kept readings and the name entries go out as one statement, for a lookup and a batch alike.
    const asked: string[] = [];
    const recording = fromNodeSqlite(db);
    const all = recording.all.bind(recording);
    recording.all = (sql, params) => {
      asked.push(sql);
      return all(sql, params);
    };
    await lookup({ db: recording, releaseId: RELEASE, query: "Europa" });
    await lookupBatch({ db: recording, releaseId: RELEASE, queries: ["Europa", "sale"] });
    assert.deepEqual(asked.filter((sql) => sql.includes("FROM name_entry")), [BESIDE_SOURCE_SQL, BESIDE_SOURCE_HEADS_SQL]);
    asked.length = 0;
    db.exec("DROP INDEX name_entry_by_key; DROP TABLE name_entry;");
    await lookup({ db: recording, releaseId: RELEASE, query: "Europa" });
    await lookupBatch({ db: recording, releaseId: RELEASE, queries: ["Europa", "sale"] });
    assert.ok(!asked.some((sql) => sql.includes("FROM name_entry")), asked.join("\n---\n"));
  } finally {
    db.close();
  }
});

test("the table refuses an item that is not one, an empty label or description, and a category off the list", async () => {
  const db = await seeded();
  try {
    const insert = (values: string[]) => db.prepare("INSERT INTO name_entry (item, label, label_key, description, category) VALUES (?, ?, ?, ?, ?)").run(...values);
    const row = ["Q695265", "Hormuz", "hormuz", "isola dell'Iran", "island"];
    const at = (index: number, value: string) => row.map((cell, i) => (i === index ? value : cell));
    for (const bad of [at(0, "P31"), at(0, "Q12a"), at(0, "Q0"), at(1, ""), at(1, " Hormuz"), at(3, ""), at(4, "person")]) {
      assert.throws(() => insert(bad), /CHECK constraint failed/, JSON.stringify(bad));
    }
    insert(row);
    assert.deepEqual(all(db, "SELECT count(*) AS n FROM name_entry"), [{ n: 1 }]);
  } finally {
    db.close();
  }
});

test("the change declaration that loads the snapshot takes no inputs", () => {
  const declaration = parseDeclaration("dictionary-changes/x.json", JSON.stringify({ command: "load:names", expected: { records: { added: 0, changed: 0, removed: 0 }, written: { name_entry: 3 } } }));
  assert.equal(declaration.command, "load:names");
  assert.throws(() => parseDeclaration("x.json", JSON.stringify({ command: "load:names", inputs: { snapshot: "x" }, expected: {} })), /inputs of load:names/);
});
