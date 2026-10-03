// The curated corrections (#420, #449, #483): the committed list, checked
// against the archive lines it names, and the layer the seed writes from it,
// read back through `lookup()`. Every record is a verbatim archive line, from
// fixtures/curated-corrections.jsonl (test/correctionFixture.ts lists them).

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { CURATED_CORRECTIONS, correctedFacts, evidenceUrl, HAND_CORRECTIONS, recordCorrections, type CuratedCorrection } from "../src/italian/curatedCorrections.js";
import { readPluralGloss } from "../src/italian/pluralGloss.js";
import { PLURAL_GLOSS_EVIDENCE } from "../src/italian/pluralGlossEvidence.js";
import { glossLemma, pluralGlossCorrections } from "../src/italian/pluralGlossNumber.js";
import { seedSql, type SeedSqlReport } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { isNounReading, type Reading } from "../src/lookup/types.js";
import { atFixtureLines, correctionFixtureLines, fixtureCorrections } from "./correctionFixture.js";

const RELEASE = "it-curated";
const HAND = recordCorrections(HAND_CORRECTIONS);

/** What a record's line holds at an RFC 6901 pointer. */
function at(line: string, pointer: string): unknown {
  let value: unknown = JSON.parse(line);
  for (const key of pointer.split("/").slice(1)) value = (value as Record<string, unknown> | undefined)?.[key];
  return value;
}

test("each entry names its record's line exactly, and the source text it overrides is on that line", async () => {
  const lines = await correctionFixtureLines();
  const listed = fixtureCorrections();
  const keyed = atFixtureLines(lines, RELEASE, listed);
  // The twenty hand entries, and five of the rule's (#483).
  assert.equal(keyed.length, 25);
  for (const [i, correction] of keyed.entries()) {
    const line = lines[correction.record.lineNo - 1];
    const archive = listed[i].record;
    assert.equal(archive.releaseId, "it-0c432803");
    assert.equal(at(line, "/word"), correction.record.word);
    assert.equal(at(line, "/pos"), correction.record.pos);
    const facts = correctedFacts(correction);
    assert.ok(facts.length > 0, `${archive.word}: a correction sets a fact`);
    for (const fact of facts) {
      assert.equal(at(line, fact.overrides.pointer), fact.overrides.text, `${archive.word} ${fact.dimension}`);
      if (fact.overrides.pointer.startsWith("/tags/")) {
        // A tag is overridden by another value of its own dimension.
        assert.notEqual(fact.overrides.text, fact.value, `${archive.word} ${fact.dimension}`);
      } else {
        // A gloss is overridden only where it reads as the plural of the word its edge names, and the fact is not plural.
        // With no edge (`mima`), the word the gloss names has to be a page the correction cites, so the gloss is
        // checked against its evidence and not only against itself.
        const edge = at(line, "/senses/0/form_of/0/word") as string | undefined;
        const named = edge ?? glossLemma(fact.overrides.text) ?? "";
        if (edge === undefined) assert.ok(correction.evidence.some((evidence) => evidence.title === named), `${archive.word}: cites ${named}`);
        assert.notEqual(readPluralGloss(fact.overrides.text, named), undefined, archive.word);
        assert.equal(`${fact.dimension} ${fact.value}`, "number singular");
      }
    }
    for (const evidence of correction.evidence) {
      assert.match(evidenceUrl(evidence), /^https:\/\/(it|en)\.wiktionary\.org\/w\/index\.php\?title=[^&]+&oldid=\d+$/);
    }
  }
});

test("the hand entries correct the twelve cases Huey ruled wrong, and of the fourteen he ruled right only the number of the plurals tagged singular", () => {
  const words = HAND.map((correction) => correction.record.word);
  // Huey's ruling on #420, 2026-10-03: eight declaring records and four nouns' own gender.
  assert.deepEqual(words.slice(0, 12).sort(), [
    "ammaliatrice", "amorevolezze", "congiuntivi", "fiaschetteria", "fissazione", "giocatrici",
    "maniaci", "nozione", "predatrici", "rimbalzo", "romantica", "sudafricana",
  ]);
  // His ruling on #449, 2026-10-03: the real plurals tagged singular that #420 left, set to plural.
  assert.deepEqual(words.slice(12).sort(), ["anfitrioni", "costruttrici", "curde", "mosse", "portatrici", "ricoverati", "scolare", "scontente"]);
  const right = [
    "altruiste", "anfitrioni", "australiane", "costruttrici", "fiaschetterie", "finanziatrici", "fissazioni",
    "mitre", "mosse", "nozioni", "portatrici", "ricoverati", "rimbalzi", "scolare",
  ];
  for (const correction of HAND.filter((entry) => right.includes(entry.record.word))) {
    // The number their gloss already says, so their noun's page does not move.
    assert.deepEqual(correctedFacts(correction).map((fact) => [fact.dimension, fact.value]), [["number", "plural"]], correction.record.word);
  }
});

test("the committed list is the hand entries, then what the rule makes of its pinned evidence, and the two never name one record (#483)", () => {
  const made = pluralGlossCorrections(PLURAL_GLOSS_EVIDENCE, HAND);
  assert.deepEqual(CURATED_CORRECTIONS, [...HAND_CORRECTIONS, ...made]);
  assert.equal(made.length, 156);
  const hand = new Set(HAND.map((correction) => `${correction.record.releaseId}:${correction.record.lineNo}`));
  for (const correction of made) {
    assert.equal(correction.rule, "it-plural-gloss-number/v1");
    assert.ok(!hand.has(`${correction.record.releaseId}:${correction.record.lineNo}`), correction.record.word);
  }
});

interface Seeded {
  db: DatabaseSync;
  report: SeedSqlReport;
  ask: (query: string) => Promise<Reading[]>;
}

async function withSeed(corrections: readonly CuratedCorrection[], run: (seeded: Seeded) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-curated-"));
  const db = new DatabaseSync(":memory:");
  try {
    const lines = await correctionFixtureLines();
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(`${lines.join("\n")}\n`, "utf8")));
    const report = await seedSql({
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
    for (const part of report.parts) db.exec(await readFile(part, "utf8"));
    const ask = async (query: string): Promise<Reading[]> => {
      const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query });
      assert.equal(result.outcome, "found", query);
      return result.outcome === "found" ? result.readings : [];
    };
    await run({ db, report, ask });
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

const rows = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all().map((row) => ({ ...row }));

test("the seed writes each correction beside its record and leaves the source rows as imported", async () => {
  const lines = await correctionFixtureLines();
  const corrections = atFixtureLines(lines, RELEASE);
  await withSeed([], async (plain) => {
    await withSeed(corrections, async ({ db, report }) => {
      assert.deepEqual(report.corrections, { keyed: 25, applied: 25, unapplied: [] });
      // One row per fact: congiuntivi, maniaci, and the rule's curve and agostiniani set two.
      assert.equal(report.rows.corrected_claim, 29);
      assert.deepEqual(rows(db, "SELECT r.word, r.pos, c.dimension, c.value, c.correction_id FROM corrected_claim c JOIN source_record r USING (record_id) WHERE r.word IN ('congiuntivi', 'ammaliatrice', 'costruttrici', 'agostiniani', 'curve', 'mima') ORDER BY r.word, c.dimension"), [
        { word: "agostiniani", pos: "noun", dimension: "gender", value: "masculine", correction_id: `${RELEASE}:50` },
        { word: "agostiniani", pos: "noun", dimension: "number", value: "plural", correction_id: `${RELEASE}:50` },
        { word: "ammaliatrice", pos: "noun", dimension: "number", value: "singular", correction_id: `${RELEASE}:33` },
        { word: "congiuntivi", pos: "noun", dimension: "gender", value: "masculine", correction_id: `${RELEASE}:34` },
        { word: "congiuntivi", pos: "noun", dimension: "number", value: "plural", correction_id: `${RELEASE}:34` },
        { word: "costruttrici", pos: "noun", dimension: "number", value: "plural", correction_id: `${RELEASE}:31` },
        { word: "curve", pos: "adj", dimension: "gender", value: "feminine", correction_id: `${RELEASE}:43` },
        { word: "curve", pos: "adj", dimension: "number", value: "plural", correction_id: `${RELEASE}:43` },
        { word: "mima", pos: "noun", dimension: "number", value: "singular", correction_id: `${RELEASE}:48` },
      ]);
      // The archive lines byte for byte, and the source's own claims, as a seed without the list writes them.
      assert.deepEqual(rows(db, "SELECT raw_json FROM source_record_json ORDER BY record_id").map((row) => (row as { raw_json: string }).raw_json), lines);
      for (const table of ["source_record", "grammar_claim", "sense_gloss", "lookup_form", "form_of_edge"]) {
        assert.deepEqual(rows(db, `SELECT * FROM ${table} ORDER BY 1, 2, 3`), rows(plain.db, `SELECT * FROM ${table} ORDER BY 1, 2, 3`), table);
      }
    });
  });
});

test("a correction stands in for the record's own claim, keeps it, and costs no candidate", async () => {
  const lines = await correctionFixtureLines();
  const corrections = atFixtureLines(lines, RELEASE);
  const words = [...new Set(lines.map((line) => at(line, "/word") as string))];
  const candidates = async (ask: Seeded["ask"]): Promise<string[]> =>
    (await Promise.all(words.map(async (word) => (await ask(word)).map((reading) => `${word} ${reading.recordId}`)))).flat();

  await withSeed([], async (plain) => {
    await withSeed(corrections, async ({ ask }) => {
      // Every lookup candidate is still returned.
      assert.deepEqual(await candidates(ask), await candidates(plain.ask));

      const [fissazione] = await ask("fissazione");
      const gender = fissazione.grammar.record.filter((claim) => claim.status !== "unclassified" && claim.dimension === "gender");
      assert.equal(gender.length, 1);
      const [claim] = gender;
      assert.ok(claim.status === "corrected");
      assert.equal(claim.value, "feminine");
      assert.deepEqual(claim.correction, {
        id: `${RELEASE}:14`,
        evidenceUrl: "https://en.wiktionary.org/w/index.php?title=fissazione&oldid=90568134",
      });
      assert.deepEqual(claim.replaces.map((stated) => [stated.value, stated.ref.lineNo, stated.ref.jsonPointer]), [["masculine", 14, "/tags/0"]]);
      // Its articles follow: la fissazione, never il fissazione.
      assert.ok(isNounReading(fissazione));
      const { articles } = fissazione;
      assert.ok(articles.status === "derived");
      assert.deepEqual(articles.articles.map((article) => article.displayForm), ["la fissazione", "una fissazione"]);

      // A declaring record's corrections travel with its plural declaration.
      const [ammaliatore] = await ask("ammaliatore");
      const [ammaliatrice] = ammaliatore.inflections;
      assert.equal(ammaliatrice.plural?.correctedNumber?.value, "singular");
      assert.deepEqual(ammaliatrice.plural?.correctedNumber?.replaces.map((stated) => stated.ref.jsonPointer), ["/tags/2"]);
      const [congiuntivo] = await ask("congiuntivo");
      assert.deepEqual(congiuntivo.inflections[0].plural?.recordGenders.map((claim) => [claim.status, claim.value]), [["corrected", "masculine"]]);

      // A real plural tagged singular reads as plural, and takes plural articles: never `la costruttrici` (#449).
      for (const [word, expected] of [["costruttrici", ["le costruttrici", "delle costruttrici"]], ["scolare", ["le scolare", "delle scolare"]]] as const) {
        const [reading] = await ask(word);
        const numbers = reading.grammar.record.flatMap((claim) => (claim.status !== "unclassified" && claim.status !== "missing" && claim.dimension === "number" ? [[claim.status, claim.value]] : []));
        assert.deepEqual(numbers, [["corrected", "plural"]], word);
        assert.ok(isNounReading(reading));
        assert.ok(reading.articles.status === "derived", word);
        assert.deepEqual(reading.articles.articles.map((article) => article.displayForm), expected);
      }

      // The rule's corrections read the same way (#483): agostiniani is masculine plural, `gli agostiniani`.
      const claimsOf = (reading: Reading, dimension: string): string[][] =>
        reading.grammar.record.flatMap((claim) => (claim.status !== "unclassified" && claim.status !== "missing" && claim.dimension === dimension ? [[claim.status, claim.value]] : []));
      const agostiniani = (await ask("agostiniani")).find((reading) => reading.recordId === 50);
      assert.ok(agostiniani !== undefined && isNounReading(agostiniani));
      assert.deepEqual([claimsOf(agostiniani, "gender"), claimsOf(agostiniani, "number")], [[["corrected", "masculine"]], [["corrected", "plural"]]]);
      assert.ok(agostiniani.articles.status === "derived");
      assert.deepEqual(agostiniani.articles.articles.map((article) => article.displayForm), ["gli agostiniani", "degli agostiniani"]);
      const [curve] = await ask("curve");
      assert.deepEqual([curve.recordId, claimsOf(curve, "gender"), claimsOf(curve, "number")], [43, [["corrected", "feminine"]], [["corrected", "plural"]]]);
      const mima = (await ask("mima")).find((reading) => reading.recordId === 48);
      assert.deepEqual(mima === undefined ? undefined : [claimsOf(mima, "gender"), claimsOf(mima, "number")], [[["stated", "feminine"]], [["corrected", "singular"]]]);
    });
  });
});

test("a correction is written only on the line with the digest it names", async () => {
  const lines = await correctionFixtureLines();
  const [first, ...rest] = atFixtureLines(lines, RELEASE);
  const moved = { ...first, record: { ...first.record, lineSha256: "0".repeat(64) } };
  const elsewhere = { ...rest[0], record: { ...rest[0].record, releaseId: "it-another" } };
  await withSeed([moved, elsewhere, ...rest.slice(1)], async ({ db, report }) => {
    assert.deepEqual(report.corrections.unapplied, [{ id: `${RELEASE}:${first.record.lineNo}`, reason: "line-digest-differs" }]);
    assert.equal(report.corrections.keyed, 24);
    assert.deepEqual(rows(db, `SELECT count(*) AS n FROM corrected_claim c JOIN source_record r USING (record_id) WHERE r.word IN ('${first.record.word}', '${rest[0].record.word}')`), [{ n: 0 }]);
  });
});
