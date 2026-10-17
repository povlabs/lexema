// Ten pronominal verbs' tables set on essere (#839, ADR 0030's 2026-10-08
// amendment). Their it.wiktionary conjugation pages pass `avere` to
// `{{It-conj}}`, so the source reads `mi ho abbagliato`; each entry sets the
// auxiliary and every compound cell to what rule
// `it-pronominal-conjugation/v1` builds for that place from the base verb's
// table.
//
// fixtures/pronominal-avere-tables.jsonl holds verbatim lines of it-0c432803,
// in archive order: 40838 `rimediarsi`, 43665 `sottomettersi`, 46649
// `abbagliarsi`, 47444 `abbracciarsi`, 48343 `dominarsi`, 48582
// `incontrarsi`, 49460 `rovesciarsi`, 106940 and 106941 `suddividersi`,
// 404796 `mangiarsi` and 404816 `staccarsi`. fixtures/pronominal-avere-bases.jsonl
// holds their base verbs' lines the page builds from, in archive order: 2499
// `mangiare`, 8781 `staccare`, 33614 and 33615 `abbagliare`, 43666
// `sottomettere`, 46129 `abbracciare`, 48340 `dominare`, 48581 `incontrare`,
// 49456 `rovesciare`, 114183 `rimediare` and 429522 `suddividere`.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { FixtureLines } from "../src/italian/correctionsAtLines.js";
import { CURATED_CORRECTIONS, cellCorrections, evidenceUrl, type CellCorrection } from "../src/italian/curatedCorrections.js";
import { personOfItalianVerbForm, placeItalianVerbForm, type VerbFormTags } from "../src/italian/moods.js";
import { ESSERE_OF, pronominalSpellings, pronominalVerb, type BaseCell } from "../src/italian/pronominalConjugation.js";
import { seedSql } from "../src/import/seedSql.js";

interface RawRecord {
  word: string;
  pos: string;
  forms: { form: string; tags?: string[]; raw_tags?: string[] }[];
}

const RELEASE = "it-avere-tables";
const linesOf = async (fixture: string): Promise<string[]> =>
  (await readFile(new URL(`../fixtures/${fixture}`, import.meta.url), "utf8")).trimEnd().split("\n");

const TABLE_LINES = await linesOf("pronominal-avere-tables.jsonl");
const BASES = (await linesOf("pronominal-avere-bases.jsonl")).map((line) => JSON.parse(line) as RawRecord);

const WORDS = ["abbagliarsi", "abbracciarsi", "dominarsi", "incontrarsi", "mangiarsi", "rimediarsi", "rovesciarsi", "sottomettersi", "staccarsi", "suddividersi"];

/** The committed list's entries for these tables, keyed to the fixture's lines by digest: one per record, or the fixture and the list drifted. */
const KEYED = FixtureLines.of(TABLE_LINES, RELEASE).key(cellCorrections(CURATED_CORRECTIONS)).held;

const cellOf = (form: RawRecord["forms"][number]): BaseCell => ({ spelling: form.form, tags: form.tags ?? [], rawTags: form.raw_tags ?? [] });

/** The place a form fills, as the page keys it: `ausiliare`, `passato prossimo · first singular`. */
function placeOf(tags: VerbFormTags): string | undefined {
  const slot = placeItalianVerbForm(tags);
  if (slot.kind === "auxiliary") return "ausiliare";
  if (slot.kind !== "tense" && slot.kind !== "imperative") return undefined;
  const row = personOfItalianVerbForm(tags);
  return row === undefined ? undefined : `${slot.kind === "imperative" ? "imperativo" : slot.box} · ${row.person} ${row.number}`;
}

/** Whether a form fills a compound tense, one essere builds. */
function isCompound(tags: VerbFormTags): boolean {
  const slot = placeItalianVerbForm(tags);
  return slot.kind === "tense" && ESSERE_OF[slot.box] !== undefined;
}

/** What the rule builds for each place, from the base verb record the page takes: the one whose table links `<word> (coniugazione)`. */
function builtByPlace(word: string): Map<string, string> {
  const verb = pronominalVerb(word);
  assert.ok(verb !== undefined, word);
  const base = BASES.find((record) => verb.bases.includes(record.word) && record.forms.some((form) => form.form === `${word} (coniugazione)`));
  assert.ok(base !== undefined, `${word}: the fixture holds its base verb's record`);
  const cells = base.forms.map(cellOf);
  const built = new Map<string, string>();
  for (const [i, spelling] of pronominalSpellings(verb, cells).entries()) {
    const place = placeOf(cells[i]);
    if (place !== undefined && spelling !== undefined && !built.has(place)) built.set(place, spelling);
  }
  return built;
}

const recordAt = (correction: CellCorrection): RawRecord => JSON.parse(TABLE_LINES[correction.record.lineNo - 1]) as RawRecord;

test("each of the eleven records has one entry, keyed to its line byte for byte, and no verb is left out", () => {
  assert.equal(KEYED.length, 11);
  assert.equal(KEYED.length, TABLE_LINES.length);
  assert.deepEqual([...new Set(KEYED.map((correction) => correction.record.word))].sort(), WORDS);
  assert.deepEqual(KEYED.map((correction) => correction.record.lineNo), TABLE_LINES.map((_, i) => i + 1));
  for (const correction of KEYED) assert.equal(recordAt(correction).word, correction.record.word);
});

test("each entry sets the auxiliary and every compound cell, quoting each as the line spells it on avere, and no other cell", () => {
  for (const correction of KEYED) {
    const { word } = correction.record;
    const { forms } = recordAt(correction);
    const expected = forms.flatMap((form, index) => (form.tags?.includes("auxiliary") || isCompound(cellOf(form)) ? [index] : []));
    assert.equal(expected.length, 43, word);
    assert.deepEqual(correction.cells.map((cell) => cell.index), expected, word);
    for (const cell of correction.cells) {
      assert.equal(forms[cell.index].form, cell.replaces, `${word} forms/${cell.index}`);
      assert.match(cell.replaces, /^(avere|[mtscv]i (ho|hai|ha|abbiamo|avete|hanno|avev\S+|ebb\S+|aves\S+|avemmo|avr\S+|abbia\S*) \S+(, \S+)?)$/u, `${word} forms/${cell.index}`);
    }
  }
  assert.equal(KEYED.flatMap((correction) => correction.cells).length, 473);
});

test("each corrected spelling is the one it-pronominal-conjugation/v1 builds on essere for the same place", () => {
  for (const correction of KEYED) {
    const { word } = correction.record;
    const { forms } = recordAt(correction);
    const built = builtByPlace(word);
    for (const cell of correction.cells) {
      const place = placeOf(cellOf(forms[cell.index]));
      assert.ok(place !== undefined, `${word} forms/${cell.index} fills a place`);
      assert.equal(cell.surface, built.get(place), `${word} ${place}`);
    }
  }
  const abbagliarsi = KEYED.find((correction) => correction.record.word === "abbagliarsi");
  assert.deepEqual(abbagliarsi?.cells.slice(0, 2).map((cell) => [cell.replaces, cell.surface]), [
    ["avere", "essere"],
    ["mi ho abbagliato", "mi sono abbagliato"],
  ]);
});

test("each entry cites the verb's conjugation page at its revision in itwiktionary-20260701, whose call passes avere: none of the ten passes essere", () => {
  const revisions: Record<string, number> = {
    abbagliarsi: 1871502,
    abbracciarsi: 1871503,
    dominarsi: 1871550,
    incontrarsi: 1886367,
    mangiarsi: 1886364,
    rimediarsi: 1871438,
    rovesciarsi: 3502745,
    sottomettersi: 3674754,
    staccarsi: 1886422,
    suddividersi: 1871323,
  };
  for (const correction of KEYED) {
    const { word } = correction.record;
    assert.equal(correction.evidence.length, 1, word);
    const [page] = correction.evidence;
    assert.equal(page.wiki, "it.wiktionary.org");
    assert.equal(page.title, `Appendice:Coniugazioni/Italiano/${word}`);
    assert.equal(page.revisionId, revisions[word], word);
    // The call's third argument is the auxiliary the page builds the table on.
    assert.match(page.shows, /^\{\{It-conj\|[^|]+\|[^|]+\|avere[|}]/u, word);
    assert.doesNotMatch(page.shows, /essere/u, word);
  }
  const mangiarsi = KEYED.find((correction) => correction.record.word === "mangiarsi");
  assert.equal(
    mangiarsi === undefined ? undefined : evidenceUrl(mangiarsi.evidence[0]),
    "https://it.wiktionary.org/w/index.php?title=Appendice%3AConiugazioni%2FItaliano%2Fmangiarsi&oldid=1886364",
  );
});

/** The fixture's lines seeded with `corrections`. */
async function seeded(corrections: readonly CellCorrection[]): Promise<DatabaseSync> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-avere-tables-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(`${TABLE_LINES.join("\n")}\n`, "utf8")));
    const { parts } = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: "src/db/schema.sql",
      releaseId: RELEASE,
      license: "CC-BY-SA-4.0",
      corrections,
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

const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all().map((row) => ({ ...row }));

test("the seed writes each cell as a corrected_form row beside its record; source_record_json and lookup_form stay byte for byte", async () => {
  const corrected = await seeded(KEYED);
  const source = await seeded([]);
  try {
    assert.deepEqual(all(corrected, "SELECT COUNT(*) AS n FROM corrected_form"), [{ n: 473 }]);
    for (const table of ["source_record_json", "lookup_form", "grammar_claim"]) {
      assert.deepEqual(all(corrected, `SELECT * FROM ${table} ORDER BY 1, 2`), all(source, `SELECT * FROM ${table} ORDER BY 1, 2`), table);
    }
    const lines = all(corrected, "SELECT raw_json FROM source_record_json ORDER BY record_id").map((row) => (row as { raw_json: string }).raw_json);
    assert.deepEqual(lines, TABLE_LINES);
  } finally {
    corrected.close();
    source.close();
  }
});
