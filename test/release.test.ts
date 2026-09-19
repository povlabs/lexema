import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { importRelease } from "../src/import/importRelease.js";
import { validateLocalRelease, type ReleaseVerdict } from "../src/release/validate.js";

// Enough of the real shapes for the gate to have something to judge: a lemma, an
// inflected record that points at it, and a spelling several records share.
const LINES = [
  JSON.stringify({
    word: "studente", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
    tags: ["masculine", "singular"],
    forms: [{ form: "studenti", tags: ["masculine", "plural"] }],
    senses: [{ glosses: ["chi è iscritto a un corso di studi"] }],
  }),
  JSON.stringify({
    word: "studenti", pos: "noun", pos_title: "Sostantivo, forma flessa", lang_code: "it",
    tags: ["form-of", "masculine", "plural"],
    senses: [{ glosses: ["plurale di studente"], tags: ["form-of"], form_of: [{ word: "studente" }] }],
  }),
  JSON.stringify({
    word: "sala", pos: "noun", pos_title: "Sostantivo", lang_code: "it", tags: ["feminine", "singular"],
  }),
  JSON.stringify({
    word: "sale", pos: "noun", pos_title: "Sostantivo, forma flessa", lang_code: "it",
    tags: ["feminine", "form-of", "plural"],
    senses: [{ glosses: ["plurale di sala"], tags: ["form-of"], form_of: [{ word: "sala" }] }],
  }),
  JSON.stringify({
    word: "casa", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
    senses: [{ glosses: ["edificio adibito ad abitazione"] }],
  }),
];

// The fixture has no `bella`, so the default probe list would fail on it for a
// reason that has nothing to do with the gate under test.
const PROBES = ["sale", "studenti", "casa"];

async function staging(): Promise<{ dir: string; db: DatabaseSync; archive: string; database: string }> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-release-"));
  const archive = join(dir, "fixture.jsonl.gz");
  const database = join(dir, "fixture.sqlite");
  await writeFile(archive, gzipSync(Buffer.from(LINES.join("\n") + "\n", "utf8")));
  await importRelease({
    input: archive,
    database,
    schema: "src/db/schema.sql",
    releaseId: "it-live",
    archiveR2Key: "releases/it-live.jsonl.gz",
  });
  return { dir, db: new DatabaseSync(database), archive, database };
}

async function withStaging(
  run: (ctx: { db: DatabaseSync; archive: string; database: string }) => Promise<void>,
): Promise<void> {
  const ctx = await staging();
  try {
    await run(ctx);
  } finally {
    ctx.db.close();
    await rm(ctx.dir, { recursive: true, force: true });
  }
}

const check = (verdict: ReleaseVerdict, name: string) => {
  const found = verdict.checks.find((item) => item.name === name);
  assert.ok(found !== undefined, `no check named '${name}' in ${verdict.checks.map((c) => c.name).join(", ")}`);
  return found;
};

test("a complete release passes every check", async () => {
  await withStaging(async ({ db }) => {
    const verdict = await validateLocalRelease(db, { releaseId: "it-live", probes: PROBES });
    assert.equal(verdict.ok, true, verdict.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`).join("; "));
    assert.equal(check(verdict, "probe:sale").detail, "1 entry");
  });
});

test("a release nobody imported is not activatable", async () => {
  await withStaging(async ({ db }) => {
    const verdict = await validateLocalRelease(db, { releaseId: "it-ghost", probes: PROBES });
    assert.equal(verdict.ok, false);
    assert.match(check(verdict, "exists").detail, /no release 'it-ghost'/);
  });
});

test("an interrupted import is caught before it can go live", async () => {
  await withStaging(async ({ db }) => {
    // What a crash mid-import leaves behind: the release row is written first
    // and only flipped to 'complete' after the last line lands.
    db.prepare("UPDATE source_release SET status = 'importing' WHERE release_id = ?").run("it-live");

    const verdict = await validateLocalRelease(db, { releaseId: "it-live", probes: PROBES });
    assert.equal(verdict.ok, false);
    assert.equal(check(verdict, "complete").ok, false);
    assert.match(check(verdict, "complete").detail, /'importing'/);
    // lookup hides it too, so every probe fails with the release it cannot serve.
    assert.equal(check(verdict, "probe:sale").ok, false);
  });
});

test("a staged release that lost most of its records is rejected", async () => {
  await withStaging(async ({ db, archive, database }) => {
    await importRelease({
      input: archive,
      database,
      schema: "src/db/schema.sql",
      releaseId: "it-staged",
      archiveR2Key: "releases/it-staged.jsonl.gz",
      limit: 2,
    });

    const verdict = await validateLocalRelease(db, {
      releaseId: "it-staged",
      against: "it-live",
      probes: PROBES,
    });
    assert.equal(verdict.ok, false);
    assert.equal(check(verdict, "size").ok, false);
    assert.match(check(verdict, "size").detail, /under the .* floor set by it-live/);
    // The live release is untouched and still activatable.
    const live = await validateLocalRelease(db, { releaseId: "it-live", probes: PROBES });
    assert.equal(live.ok, true);
  });
});

test("a full staged release passes beside the live one", async () => {
  await withStaging(async ({ db, archive, database }) => {
    await importRelease({
      input: archive,
      database,
      schema: "src/db/schema.sql",
      releaseId: "it-staged",
      archiveR2Key: "releases/it-staged.jsonl.gz",
    });

    const verdict = await validateLocalRelease(db, {
      releaseId: "it-staged",
      against: "it-live",
      probes: PROBES,
    });
    assert.equal(verdict.ok, true, verdict.checks.filter((c) => !c.ok).map((c) => c.name).join(", "));
    assert.equal(check(verdict, "size").ok, true);
  });
});

test("a retired release is no longer activatable, and rolling back to it is not silent", async () => {
  await withStaging(async ({ db }) => {
    db.prepare("UPDATE source_release SET status = 'superseded' WHERE release_id = ?").run("it-live");

    const verdict = await validateLocalRelease(db, { releaseId: "it-live", probes: PROBES });
    assert.equal(verdict.ok, false);
    assert.match(check(verdict, "complete").detail, /'superseded'/);
    // Its rows are still there. Retiring hides a release; it does not delete it.
    const [row] = db
      .prepare("SELECT count(*) AS n FROM source_record WHERE release_id = 'it-live'")
      .all() as { n: number }[];
    assert.equal(row.n, 5);
  });
});
