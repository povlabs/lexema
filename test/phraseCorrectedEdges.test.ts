// A phrase reads a word's corrected `form_of` edges as a single lookup does
// (#759, ADR 0030): a sense's corrected edge names its lemma in place of the
// source's, and one that removes its sense's edges names none. Every record is
// a verbatim line of it-0c432803: the replaced edges' from
// fixtures/form-of-edge-replaced.jsonl (listed in test/edgeCorrections.test.ts),
// the removed edge's from fixtures/form-of-meaning-edge.jsonl (listed in
// test/formOfMeaningEdge.test.ts), and the multi-word headwords from
// fixtures/phrase-corrected-edges.jsonl: archive lines 131296 `mela granata`,
// 611990 `fare presente` and 622521 `portare via`.

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite, type DictionaryRead, type LookupDatabase } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import {
  CORRECTED_FORM_ENTRY_SQL,
  CORRECTED_PARTICIPLE_FORM_ENTRY_SQL,
  CORRECTED_WORD_LEMMAS_SQL,
  FORM_ENTRY_SQL,
  WORD_LEMMAS_SQL,
} from "../src/lookup/phrase.js";
import { suggest } from "../src/lookup/suggest.js";
import type { LookupResult } from "../src/lookup/types.js";
import { senseEdgeCorrectionsAt } from "./correctionFixture.js";

const RELEASE = "it-phrase-edges";

const linesOf = async (name: string): Promise<string[]> =>
  (await readFile(new URL(`../fixtures/${name}`, import.meta.url), "utf8")).trimEnd().split("\n");

/** The replaced edges' records and the headwords they spell a phrase of. */
const LINES = [...(await linesOf("form-of-edge-replaced.jsonl")), ...(await linesOf("phrase-corrected-edges.jsonl"))];
/** The removed edge's records. */
const REMOVED_LINES = await linesOf("form-of-meaning-edge.jsonl");

async function seeded(lines: readonly string[], corrected: boolean): Promise<DatabaseSync> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-phrase-edges-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(`${lines.join("\n")}\n`, "utf8")));
    const { parts } = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: "src/db/schema.sql",
      releaseId: RELEASE,
      license: "CC-BY-SA-4.0",
      corrections: corrected ? senseEdgeCorrectionsAt(lines, RELEASE) : [],
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

/** The database, with every statement it is asked recorded. */
function recording(sqlite: DatabaseSync): { db: LookupDatabase; asked: DictionaryRead[] } {
  const inner = fromNodeSqlite(sqlite);
  const asked: DictionaryRead[] = [];
  return {
    asked,
    db: {
      all<T>(sql: DictionaryRead, params: Parameters<LookupDatabase["all"]>[1]): Promise<T[]> {
        asked.push(sql);
        return inner.all<T>(sql, params);
      },
    },
  };
}

const ask = (db: LookupDatabase, query: string): Promise<LookupResult> => lookup({ db, releaseId: RELEASE, query });

/** What a search reads: `not-found`, or each reading's word, and for a phrase each word's lemma and the form lines. */
async function searched(db: LookupDatabase, query: string): Promise<unknown> {
  const result = await ask(db, query);
  if (result.outcome !== "found") return result.outcome;
  if (result.route.kind !== "phrase") return { route: result.route.kind, words: result.readings.map((reading) => reading.word) };
  return {
    phrases: result.route.phrases.map((phrase) => `${phrase.key}: ${phrase.words.map((word) => `${word.typed}=${word.lemma}`).join(" ")}`),
    forms: result.route.forms.flatMap((form) => form.definitions.map((line) => `${form.word}: ${line.before}[${line.phrase}]${line.after}`)),
  };
}

/** The words a single lookup of `word`'s `pos` reading links to as its lemmas. */
async function linked(db: LookupDatabase, word: string, pos: string): Promise<string[]> {
  const result = await ask(db, word);
  assert.equal(result.outcome, "found", word);
  if (result.outcome !== "found") return [];
  const targets = result.readings
    .filter((reading) => reading.word === word && reading.pos === pos)
    .flatMap((reading) => reading.lemmaLinks.map((link) => link.targetWord));
  return [...new Set(targets)].sort();
}

/** What `fare porta` reads through the source's edges of `porta` to `presente`. */
const FARE_PRESENTE = {
  phrases: ["fare presente: fare=fare porta=presente"],
  forms: [
    "porta: terza persona singolare di portare dell'indicativo [fare presente] di portare",
    "porta: seconda persona singolare di portare imperativo [fare presente] di portare",
  ],
};

/** A word's lemmas as a phrase reads them. */
async function lemmasOf(db: DatabaseSync, sql: DictionaryRead, word: string): Promise<string[]> {
  const rows = await fromNodeSqlite(db).all<{ lemma: string }>(sql, [RELEASE, JSON.stringify([word])]);
  return rows.map((row) => row.lemma).sort();
}

test("a phrase reads a word's corrected lemma: porta stands for portare, not presente, and mele for mela", async () => {
  const [plain, corrected] = [await seeded(LINES, false), await seeded(LINES, true)];
  try {
    // The source's edges: `porta`'s senses 1 and 2 name `presente`, `mele`'s
    // senses its meanings (#733, #755).
    assert.deepEqual(await lemmasOf(plain, WORD_LEMMAS_SQL, "porta"), ["porgere", "porta", "presente"]);
    assert.deepEqual(await lemmasOf(plain, WORD_LEMMAS_SQL, "mele"), ["bambini", "mele", "melo", "percosse", "tondeggianti"]);
    // The corrected edges in their place.
    assert.deepEqual(await lemmasOf(corrected, CORRECTED_WORD_LEMMAS_SQL, "porta"), ["porgere", "porta", "portare"]);
    assert.deepEqual(await lemmasOf(corrected, CORRECTED_WORD_LEMMAS_SQL, "mele"), ["mela", "mele"]);
    // A master whose `corrected_edge` holds no row reads what the source says.
    assert.deepEqual(await lemmasOf(plain, CORRECTED_WORD_LEMMAS_SQL, "porta"), ["porgere", "porta", "presente"]);

    const [before, after] = [fromNodeSqlite(plain), fromNodeSqlite(corrected)];
    // A redirected edge: `porta via` is *portare via*, and its form lines are
    // read off the corrected edges of `porta`'s senses 1 and 2.
    assert.equal(await searched(before, "porta via"), "not-found");
    assert.deepEqual(await searched(after, "porta via"), {
      phrases: ["portare via: porta=portare via=via"],
      forms: [
        "porta: terza persona singolare di portare dell'indicativo presente di [portare via]",
        "porta: seconda persona singolare di portare imperativo presente di [portare via]",
      ],
    });
    // The edges they replace: `fare porta` no longer reads as *fare presente*,
    // with the word `presente` of those glosses swapped for it.
    assert.deepEqual(await searched(before, "fare porta"), FARE_PRESENTE);
    assert.equal(await searched(after, "fare porta"), "not-found");
    // `mele`'s meanings no longer name `percosse` and the rest; it stands for `mela`.
    assert.equal(await searched(before, "mele granata"), "not-found");
    assert.deepEqual(await searched(after, "mele granata"), {
      phrases: ["mela granata: mele=mela granata=granata"],
      forms: ["mele: plurale di mela nel senso di frutto del melo o di frutto in generale; vedi [mela granata]"],
    });

    // The single lookup of each word names the lemma the phrase read it as,
    // and not the one the correction replaced.
    assert.deepEqual(await linked(after, "porta", "verb"), ["porgere", "portare"]);
    assert.deepEqual(await linked(after, "mele", "noun"), ["mela"]);
    assert.deepEqual(await linked(before, "porta", "verb"), ["porgere", "presente"]);

    // The search field offers what that search finds, read the same way.
    const phrasesFor = async (db: LookupDatabase, prefix: string): Promise<unknown> => {
      const answer = await suggest({ db, releaseId: RELEASE, prefix });
      return answer.outcome === "suggested" ? answer.phrases : answer.outcome;
    };
    assert.deepEqual(await phrasesFor(after, "porta v"), [{ phrase: "porta via", headwords: ["portare via"] }]);
    assert.deepEqual(await phrasesFor(before, "porta v"), []);
  } finally {
    plain.close();
    corrected.close();
  }
});

test("a sense whose correction removes its edge gives a phrase no lemma and no form line", async () => {
  const [plain, corrected] = [await seeded(REMOVED_LINES, false), await seeded(REMOVED_LINES, true)];
  try {
    // `scandinava`'s only sense glosses a meaning, "relativa alla Scandinavia" (#755).
    assert.deepEqual(await lemmasOf(plain, WORD_LEMMAS_SQL, "scandinava"), ["scandinava", "scandinavia"]);
    assert.deepEqual(await lemmasOf(corrected, CORRECTED_WORD_LEMMAS_SQL, "scandinava"), ["scandinava"]);
    const entries = async (db: DatabaseSync, sql: DictionaryRead): Promise<string[]> =>
      (await fromNodeSqlite(db).all<{ text: string }>(sql, [RELEASE, "scandinava", "scandinavia"])).map((row) => row.text);
    assert.deepEqual(await entries(plain, FORM_ENTRY_SQL), ["relativa alla Scandinavia"]);
    assert.deepEqual(await entries(corrected, CORRECTED_FORM_ENTRY_SQL), []);
  } finally {
    plain.close();
    corrected.close();
  }
});

test("a master without corrected_edge reads a phrase's edges from the source alone", async () => {
  const db = await seeded(LINES, true);
  try {
    db.exec("DROP TABLE corrected_edge");
    const { db: recorded, asked } = recording(db);
    // As though nothing were corrected: no statement names the table.
    assert.deepEqual(await searched(recorded, "fare porta"), FARE_PRESENTE);
    assert.equal(await searched(recorded, "porta via"), "not-found");
    assert.ok(asked.includes(WORD_LEMMAS_SQL));
    assert.ok(asked.includes(FORM_ENTRY_SQL));
    for (const sql of [CORRECTED_WORD_LEMMAS_SQL, CORRECTED_FORM_ENTRY_SQL, CORRECTED_PARTICIPLE_FORM_ENTRY_SQL]) assert.ok(!asked.includes(sql));
  } finally {
    db.close();
  }
});
