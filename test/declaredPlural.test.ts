// What `lookup()` hands over in `InflectionOf.plural` (#145), on real lines.
//
// fixtures/declared-plural.jsonl is nineteen whole lines of it-0c432803, byte
// for byte: 98 and 99 `rosa`, 17081 `rose`, 39663 and 39664 `colle`, 46695
// `eccentrico`, 47418 and 47419 `altruista`, 56063 and 56064 `altruiste`,
// 57639 `eccentrica`, 57641 `eccentriche`, 57643 `eccentrici`, 64863
// `altruisti`, 79150 `colli`, 133058 to 133060 `tema`, 140660 `temi`. A line
// number below is the fixture's own, 1 to 19 in that order.

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { namesOneRecordOf, type InflectionOf, type Reading, type SourceRef } from "../src/lookup/types.js";

const RELEASE = "it-declared-plural";
const FIXTURE = "fixtures/declared-plural.jsonl";

async function withFixture(run: (ask: (query: string) => Promise<Reading[]>, lines: string[]) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-declared-plural-"));
  const db = new DatabaseSync(":memory:");
  try {
    const text = await readFile(FIXTURE, "utf8");
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(text, "utf8")));
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
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    const ask = async (query: string): Promise<Reading[]> => {
      const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query });
      assert.equal(result.outcome, "found");
      return result.outcome === "found" ? result.readings : [];
    };
    await run(ask, text.trimEnd().split("\n"));
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

/** What the fixture line a ref names holds at the ref's pointer. */
function at(lines: string[], ref: SourceRef): unknown {
  let value: unknown = JSON.parse(lines[ref.lineNo - 1]);
  for (const key of ref.jsonPointer.split("/").slice(1)) value = (value as Record<string, unknown>)[key];
  return value;
}

/** The one noun reading of `word` that states `gender`. */
function nounOf(readings: Reading[], gender: string): Reading {
  const found = readings.filter(
    (reading) =>
      reading.pos === "noun" &&
      reading.grammar.record.some((claim) => claim.status === "stated" && claim.dimension === "gender" && claim.value === gender),
  );
  assert.equal(found.length, 1);
  return found[0];
}

/** A declared plural as `[word, line, gloss, gloss pointer, glossGender, record genders]`, or the word alone when it has none. */
const told = (link: InflectionOf): unknown[] =>
  link.plural === undefined
    ? [link.word]
    : [
        link.word,
        link.plural.gloss.ref.lineNo,
        link.plural.gloss.text,
        link.plural.gloss.ref.jsonPointer,
        link.plural.glossGender,
        link.plural.recordGenders.map((claim) => `${claim.value} ${claim.status === "stated" ? claim.ref.jsonPointer : claim.correction.id}`),
      ];

test("a declared plural carries its gloss, the gender the gloss names, and the declaring record's own genders", async () => {
  await withFixture(async (ask, lines) => {
    // `eccentrico` the noun is masculine and lists no forms. Its feminine
    // plural is placed by what `eccentriche` says, never by its own gender.
    const eccentrico = nounOf(await ask("eccentrico"), "masculine");
    assert.deepEqual(eccentrico.inflections.map(told), [
      // "femminile singolare di eccentrico" is no plural.
      ["eccentrica"],
      ["eccentriche", 12, "femminile plurale di eccentrico", "/senses/0/glosses/0", "feminine", ["feminine /tags/0"]],
      ["eccentrici", 13, "maschile plurale di eccentrico", "/senses/0/glosses/0", "masculine", ["masculine /tags/1"]],
    ]);

    // `altruiste` says a bare "plurale di altruista", so only its own tags say
    // feminine, on a noun that states masculine.
    const altruista = nounOf(await ask("altruista"), "masculine");
    assert.deepEqual(altruista.inflections.map((link) => [link.pos, ...told(link)]), [
      ["adj", "altruiste", 9, "plurale di altruista", "/senses/0/glosses/0", undefined, ["feminine /tags/0"]],
      ["noun", "altruiste", 10, "plurale di altruista", "/senses/0/glosses/0", undefined, ["feminine /tags/0"]],
      ["noun", "altruisti", 14, "plurale di altruista", "/senses/0/glosses/0", undefined, ["masculine /tags/1"]],
    ]);

    // Every ref points into the declaring record's own line, at the text it carries.
    const declared = [...eccentrico.inflections, ...altruista.inflections].flatMap((link) => (link.plural === undefined ? [] : [{ link, plural: link.plural }]));
    assert.equal(declared.length, 5);
    for (const { link, plural } of declared) {
      assert.equal(at(lines, plural.gloss.ref), plural.gloss.text);
      assert.deepEqual({ ...plural.gloss.ref, jsonPointer: link.refs[0].jsonPointer }, link.refs[0]);
      assert.equal(at(lines, { ...plural.gloss.ref, jsonPointer: "/word" }), link.word);
      assert.equal(plural.recordGenders.length, 1);
      for (const claim of plural.recordGenders) {
        // No correction is keyed to this fixture's release.
        assert.ok(claim.status === "stated");
        assert.equal(at(lines, claim.ref), claim.value);
        assert.equal(claim.ref.lineNo, plural.gloss.ref.lineNo);
      }
    }
  });
});

test("the gloss is read on the sense whose edge lands on the reading", async () => {
  await withFixture(async (ask) => {
    // `colli` says "plurale di collo" on its first sense and "plurale di colle"
    // on its second. Only the second names `colle`.
    const colle = nounOf(await ask("colle"), "masculine");
    assert.deepEqual(colle.inflections.map(told), [["colli", 15, "plurale di colle", "/senses/1/glosses/0", undefined, ["masculine /tags/1"]]]);
    assert.deepEqual(colle.inflections[0].refs.map((ref) => ref.jsonPointer), ["/senses/1/form_of/0/word"]);
  });
});

test("a plural gloss names a word, so every noun record of that word carries it with the candidate set", async () => {
  await withFixture(async (ask) => {
    // `temi` says "plurale di tema". `tema` is a masculine noun, a feminine
    // noun and a verb form, and the source picked none.
    const tema = (await ask("tema")).filter((reading) => reading.pos === "noun");
    assert.equal(tema.length, 2);
    for (const reading of tema) {
      assert.deepEqual(reading.inflections.map(told), [["temi", 19, "plurale di tema", "/senses/0/glosses/0", undefined, ["masculine /tags/1"]]]);
      const [link] = reading.inflections;
      assert.deepEqual(link.targetCandidates.map((candidate) => candidate.pos), ["noun", "noun", "verb"]);
      assert.equal(namesOneRecordOf("noun", link), false);
    }

    // `altruista` is an adjective and one noun: the edge can mean that noun alone.
    const altruista = nounOf(await ask("altruista"), "masculine");
    assert.equal(altruista.inflections.length, 3);
    for (const link of altruista.inflections) {
      assert.deepEqual(link.targetCandidates.map((candidate) => candidate.pos), ["adj", "noun"]);
      assert.equal(namesOneRecordOf("noun", link), true);
    }
  });
});
