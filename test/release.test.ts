import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { importRelease } from "../src/import/importRelease.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { discardRelease, restoreRelease, retireRelease } from "../src/release/lifecycle.js";
import { fromD1Http } from "../src/release/d1Http.js";
import { computeProjection } from "../src/release/projection.js";
import {
  validateLocalRelease,
  validateRelease,
  type Probe,
  type ReleaseVerdict,
} from "../src/release/validate.js";

// Enough of the real shapes for the gate to have something to judge: a lemma
// listing a form it is not the lemma of, an inflected record that declares the
// edge back, and a spelling two records share.
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
const RECORDS = LINES.length;

// The default probe list is written for the real release, which has words this
// fixture does not ('bella') and a `sale` with three records. These are the same
// kind of checks over the shapes the fixture does carry: a form_of edge that
// resolves, an embedded form, a headword with a gloss and grammar, and the
// reverse edge direction.
const PROBES: readonly Probe[] = [
  { query: "sale", minReadings: 1, expects: ["lemma-candidates"] },
  { query: "studenti", minReadings: 2, expects: ["embedded-form", "lemma-candidates"] },
  { query: "casa", minReadings: 1, expects: ["headword", "gloss", "grammar"] },
  { query: "studente", minReadings: 1, expects: ["headword", "inflections"] },
];

const LIVE = { kind: "against", releaseId: "it-live" } as const;
const FIRST = { kind: "first-release" } as const;

interface Staging {
  dir: string;
  db: DatabaseSync;
  archive: string;
  database: string;
}

async function staging(): Promise<Staging> {
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

async function withStaging(run: (ctx: Staging) => Promise<void>): Promise<void> {
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

const failures = (verdict: ReleaseVerdict) =>
  verdict.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`).join("; ");

const count = (db: DatabaseSync, sql: string): number =>
  (db.prepare(sql).all() as { n: number }[])[0].n;

test("a complete release passes every check", async () => {
  await withStaging(async ({ db }) => {
    const verdict = await validateLocalRelease(db, {
      releaseId: "it-live",
      baseline: FIRST,
      probes: PROBES,
      verifyProjection: true,
    });
    assert.equal(verdict.ok, true, failures(verdict));
    assert.equal(check(verdict, "projection-digest").ok, true);
  });
});

test("a release nobody imported is not activatable", async () => {
  await withStaging(async ({ db }) => {
    const verdict = await validateLocalRelease(db, {
      releaseId: "it-ghost",
      baseline: LIVE,
      probes: PROBES,
    });
    assert.equal(verdict.ok, false);
    assert.match(check(verdict, "exists").detail, /no release 'it-ghost'/);
  });
});

test("an import interrupted partway leaves a release the gate rejects, and discard clears it", async () => {
  await withStaging(async ({ db, archive, database }) => {
    // A real interruption: the process dies after some batches have committed
    // and before the flip to 'complete'. Nothing here edits the database by
    // hand — the state under test is the one the importer actually leaves.
    const crash = new Error("power cut");
    await assert.rejects(
      importRelease({
        input: archive,
        database,
        schema: "src/db/schema.sql",
        releaseId: "it-staged",
        archiveR2Key: "releases/it-staged.jsonl.gz",
        batchSize: 2,
        onProgress: () => {
          throw crash;
        },
      }),
      crash,
    );

    const [release] = db
      .prepare("SELECT status, projection_sha256 FROM source_release WHERE release_id = 'it-staged'")
      .all() as { status: string; projection_sha256: string | null }[];
    assert.equal(release.status, "importing");
    assert.equal(release.projection_sha256, null, "an unfinished import pins no derivation");

    // The committed batch survived; the rest never landed.
    const landed = count(db, "SELECT count(*) AS n FROM source_record WHERE release_id = 'it-staged'");
    assert.ok(landed > 0 && landed < RECORDS, `expected a partial import, got ${landed} of ${RECORDS}`);

    const verdict = await validateLocalRelease(db, {
      releaseId: "it-staged",
      baseline: LIVE,
      probes: PROBES,
    });
    assert.equal(verdict.ok, false);
    assert.equal(check(verdict, "complete").ok, false);
    assert.match(check(verdict, "complete").detail, /'importing'/);
    assert.equal(check(verdict, "projection").ok, false);
    // lookup hides it too, so every probe fails on a release it cannot serve.
    assert.equal(check(verdict, "probe:sale").ok, false);

    // Re-importing under the same id is refused while the wreck is there.
    await assert.rejects(
      importRelease({
        input: archive,
        database,
        schema: "src/db/schema.sql",
        releaseId: "it-staged",
        archiveR2Key: "releases/it-staged.jsonl.gz",
      }),
      /already in this database/,
    );

    // `release discard` is the way out, and it is the command itself running
    // here, not a re-typed copy of its SQL. The live release is untouched by
    // all of it.
    await discardRelease(fromNodeSqlite(db), "it-staged");
    assert.equal(count(db, "SELECT count(*) AS n FROM source_record WHERE release_id = 'it-staged'"), 0);
    assert.equal(count(db, "SELECT count(*) AS n FROM source_record WHERE release_id = 'it-live'"), RECORDS);

    await importRelease({
      input: archive,
      database,
      schema: "src/db/schema.sql",
      releaseId: "it-staged",
      archiveR2Key: "releases/it-staged.jsonl.gz",
    });
    const retry = await validateLocalRelease(db, {
      releaseId: "it-staged",
      baseline: LIVE,
      probes: PROBES,
    });
    assert.equal(retry.ok, true, failures(retry));
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
      baseline: LIVE,
      probes: PROBES,
    });
    assert.equal(verdict.ok, false);
    assert.equal(check(verdict, "size").ok, false);
    assert.match(check(verdict, "size").detail, /under the .* floor set by it-live/);
    // The live release is untouched and still activatable.
    const live = await validateLocalRelease(db, {
      releaseId: "it-live",
      baseline: FIRST,
      probes: PROBES,
    });
    assert.equal(live.ok, false, "it-live is no longer the only release");
    assert.match(check(live, "size").detail, /--first-release, but this database also holds it-staged/);
  });
});

test("a truncated release cannot dodge the size floor by naming no baseline", async () => {
  await withStaging(async ({ db, archive, database }) => {
    await importRelease({
      input: archive,
      database,
      schema: "src/db/schema.sql",
      releaseId: "it-staged",
      archiveR2Key: "releases/it-staged.jsonl.gz",
      limit: 2,
    });

    // A mistyped baseline is a failure, not a pass. This is the hole the old
    // optional `against` left: a typo silently removed the 90% floor.
    const typo = await validateLocalRelease(db, {
      releaseId: "it-staged",
      baseline: { kind: "against", releaseId: "it-liv" },
      probes: PROBES,
    });
    assert.equal(typo.ok, false);
    assert.match(check(typo, "size").detail, /no release 'it-liv' to size against/);

    // And claiming there is nothing to size against fails while it-live exists.
    const pretend = await validateLocalRelease(db, {
      releaseId: "it-staged",
      baseline: FIRST,
      probes: PROBES,
    });
    assert.equal(pretend.ok, false);
    assert.match(check(pretend, "size").detail, /also holds it-live/);
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
      baseline: LIVE,
      probes: PROBES,
      verifyProjection: true,
    });
    assert.equal(verdict.ok, true, failures(verdict));
    assert.equal(check(verdict, "size").ok, true);
  });
});

test("a release that lost a derived table is caught, by counts and by probe", async () => {
  await withStaging(async ({ db }) => {
    // The whole form_of_edge table, gone. Row counts of source_record and
    // lookup_form are untouched and every probe word still resolves to a
    // headword, so only the relationships give it away.
    db.prepare("DELETE FROM form_of_edge WHERE release_id = 'it-live'").run();

    const verdict = await validateLocalRelease(db, {
      releaseId: "it-live",
      baseline: FIRST,
      probes: PROBES,
      verifyProjection: true,
    });
    assert.equal(verdict.ok, false);
    assert.equal(check(verdict, "not-empty").ok, false);
    assert.equal(check(verdict, "projection").ok, false);
    assert.match(check(verdict, "projection").detail, /form_of_edge: 0 rows, import recorded/);
    assert.equal(check(verdict, "projection-digest").ok, false);
    assert.equal(check(verdict, "probe:sale").ok, false);
    assert.match(check(verdict, "probe:sale").detail, /no reading has lemma-candidates/);
    assert.match(check(verdict, "probe:studente").detail, /no reading has inflections/);
  });
});

test("one edited derived row is caught by the digest, and by nothing cheaper", async () => {
  await withStaging(async ({ db }) => {
    // A single gloss rewritten in place. Every count still matches.
    db.prepare("UPDATE sense_gloss SET text = 'edificio' WHERE text LIKE 'edificio%'").run();

    const counted = await validateLocalRelease(db, {
      releaseId: "it-live",
      baseline: FIRST,
      probes: PROBES,
    });
    assert.equal(check(counted, "projection").ok, true, "counts cannot see a rewritten row");
    assert.equal(counted.ok, true, failures(counted));

    const verified = await validateLocalRelease(db, {
      releaseId: "it-live",
      baseline: FIRST,
      probes: PROBES,
      verifyProjection: true,
    });
    assert.equal(verified.ok, false);
    assert.equal(check(verified, "projection-digest").ok, false);
    assert.match(check(verified, "projection-digest").detail, /derived rows hash to/);
  });
});

test("two imports of one archive derive the same projection", async () => {
  await withStaging(async ({ db, archive, database }) => {
    const second = await importRelease({
      input: archive,
      database,
      schema: "src/db/schema.sql",
      releaseId: "it-staged",
      archiveR2Key: "releases/it-staged.jsonl.gz",
    });

    // record_id counts on from the live release, so the ids differ — but the
    // digest is taken over the derived content, and the same archive derives
    // the same content twice. This is the assertion that pins it: the two
    // digests are compared with each other, not each with itself.
    const live = await computeProjection(fromNodeSqlite(db), "it-live");
    const staged = await computeProjection(fromNodeSqlite(db), "it-staged");
    assert.equal(staged.digest, live.digest);
    assert.equal(staged.digest, second.projectionSha256);
    assert.deepEqual(staged.counts, live.counts);

    // And the ids really do differ, so the equality above is not two reads of
    // one release agreeing with itself.
    const ids = db
      .prepare("SELECT release_id, min(record_id) AS lo FROM source_record GROUP BY release_id")
      .all() as { release_id: string; lo: number }[];
    assert.equal(ids.length, 2);
    assert.notEqual(ids[0].lo, ids[1].lo);
  });
});

test("activation and rollback are which release id the reader is pointed at", async () => {
  await withStaging(async ({ db, dir, database }) => {
    // A second release built from a changed archive: one word gone, one added.
    const changed = [
      ...LINES.slice(0, RECORDS - 1),
      JSON.stringify({
        word: "casa", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
        senses: [{ glosses: ["edificio adibito ad abitazione"] }],
      }),
      JSON.stringify({
        word: "gatto", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
        tags: ["masculine", "singular"],
        senses: [{ glosses: ["felino domestico"] }],
      }),
    ];
    const nextArchive = join(dir, "next.jsonl.gz");
    await writeFile(nextArchive, gzipSync(Buffer.from(changed.join("\n") + "\n", "utf8")));
    await importRelease({
      input: nextArchive,
      database,
      schema: "src/db/schema.sql",
      releaseId: "it-next",
      archiveR2Key: "releases/it-next.jsonl.gz",
    });

    const staged = await validateLocalRelease(db, {
      releaseId: "it-next",
      baseline: LIVE,
      probes: PROBES,
    });
    assert.equal(staged.ok, true, failures(staged));

    // LEXEMA_RELEASE is the whole of activation: the release id lookup is given.
    // Nothing in the database changes, and the two releases answer differently.
    const lookupDb = fromNodeSqlite(db);
    const before = await lookup({ db: lookupDb, releaseId: "it-live", query: "gatto" });
    assert.equal(before.outcome, "not-found");

    const after = await lookup({ db: lookupDb, releaseId: "it-next", query: "gatto" });
    assert.equal(after.outcome, "found");
    assert.equal(after.outcome === "found" && after.release.releaseId, "it-next");

    // Rolling back is the same variable set back. The old release never moved.
    const rolledBack = await lookup({ db: lookupDb, releaseId: "it-live", query: "gatto" });
    assert.equal(rolledBack.outcome, "not-found");
    const stillThere = await lookup({ db: lookupDb, releaseId: "it-live", query: "casa" });
    assert.equal(stillThere.outcome, "found");
    assert.equal(stillThere.outcome === "found" && stillThere.release.releaseId, "it-live");

    // And no answer ever mixes the two: every reading of a query comes from the
    // release it was asked of.
    const ids = db
      .prepare(
        `SELECT DISTINCT release_id AS id FROM lookup_form
          WHERE record_id IN (SELECT record_id FROM source_record WHERE release_id = 'it-next')`,
      )
      .all() as { id: string }[];
    assert.deepEqual(ids.map((row) => row.id), ["it-next"]);
  });
});

test("a retired release is no longer activatable, and restoring it brings it back", async () => {
  await withStaging(async ({ db }) => {
    await retireRelease(fromNodeSqlite(db), "it-live");

    const retired = await validateLocalRelease(db, {
      releaseId: "it-live",
      baseline: FIRST,
      probes: PROBES,
    });
    assert.equal(retired.ok, false);
    assert.match(check(retired, "complete").detail, /'superseded'/);
    await assert.rejects(
      lookup({ db: fromNodeSqlite(db), releaseId: "it-live", query: "casa" }),
      /no complete release 'it-live'/,
    );
    // Its rows are still there. Retiring hides a release; it does not delete it.
    assert.equal(count(db, "SELECT count(*) AS n FROM source_record WHERE release_id = 'it-live'"), RECORDS);

    // The way back from a retire made too early.
    await restoreRelease(fromNodeSqlite(db), "it-live");
    const restored = await validateLocalRelease(db, {
      releaseId: "it-live",
      baseline: FIRST,
      probes: PROBES,
    });
    assert.equal(restored.ok, true, failures(restored));

    // And a live release is not something either command can take away: retire
    // is the only way to hide one, and it cannot be deleted while readers or a
    // rollback might still want it.
    await assert.rejects(
      discardRelease(fromNodeSqlite(db), "it-live"),
      /is complete, not an unfinished import/,
    );
    await assert.rejects(
      restoreRelease(fromNodeSqlite(db), "it-live"),
      /is complete, not superseded/,
    );
  });
});

test("a review written against one release does not follow the source into the next", async () => {
  await withStaging(async ({ db, archive, database }) => {
    const [reviewed] = db
      .prepare(
        `SELECT record_id FROM source_record
          WHERE release_id = 'it-live' AND word = 'studenti'`,
      )
      .all() as { record_id: number }[];
    db.prepare(
      `INSERT INTO claim_review
         (record_id, json_pointer, status, note, evidence_url, reviewed_at, reviewed_by)
       VALUES (?, '/senses/0/form_of/0/word', 'disputed', 'checked against Treccani',
               'https://example.org/evidence', '2026-09-19T00:00:00Z', 'huey')`,
    ).run(reviewed.record_id);

    // The same archive, imported again as a new release. record_id is one key
    // space across the database, so the new release's records are new rows.
    await importRelease({
      input: archive,
      database,
      schema: "src/db/schema.sql",
      releaseId: "it-staged",
      archiveR2Key: "releases/it-staged.jsonl.gz",
    });

    const lookupDb = fromNodeSqlite(db);
    const live = await lookup({ db: lookupDb, releaseId: "it-live", query: "studenti" });
    const staged = await lookup({ db: lookupDb, releaseId: "it-staged", query: "studenti" });
    assert.equal(live.outcome, "found");
    assert.equal(staged.outcome, "found");

    const reviewsOf = (result: typeof live) =>
      result.outcome === "found"
        ? result.readings.flatMap((reading) => reading.reviews)
        : [];

    // Pinned, not endorsed: the review stays on the exact record it was written
    // about, and the re-imported record carries none. Carrying it across needs
    // an identity that survives a re-import, which is #12's question.
    assert.equal(reviewsOf(live).length, 1);
    assert.equal(reviewsOf(live)[0].status, "disputed");
    assert.equal(reviewsOf(staged).length, 0);

    // Activating the new release therefore silently drops a verdict from the
    // page. The gate cannot see this, and does not pretend to.
    const verdict = await validateLocalRelease(db, {
      releaseId: "it-staged",
      baseline: LIVE,
      probes: PROBES,
    });
    assert.equal(verdict.ok, true, failures(verdict));
  });
});

test("the same gate runs over D1's HTTP API", async () => {
  await withStaging(async ({ db }) => {
    // D1 is only reachable over HTTP from a terminal, so `check --d1` goes
    // through fromD1Http. Here that adapter is pointed at the fixture database
    // through a stub shaped exactly like D1's query endpoint: same request
    // body, same `{ result: [{ results }] }` envelope, same bound parameters.
    // What is under test is that the gate needs nothing a Worker binding has.
    const seen: { sql: string; params: unknown[] }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      assert.match(url, /\/accounts\/acct\/d1\/database\/dbid\/query$/);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), "Bearer token");

      const { sql, params } = JSON.parse(String(init?.body)) as {
        sql: string;
        params: (string | number)[];
      };
      seen.push({ sql, params });
      const results = db.prepare(sql).all(...params);
      return new Response(JSON.stringify({ success: true, result: [{ results }] }), {
        headers: { "content-type": "application/json" },
      });
    };

    const verdict = await validateRelease({
      db: fromD1Http({ accountId: "acct", databaseId: "dbid", apiToken: "token", fetchImpl }),
      releaseId: "it-live",
      baseline: FIRST,
      probes: PROBES,
      verifyProjection: true,
    });
    assert.equal(verdict.ok, true, failures(verdict));
    assert.ok(seen.length > 0);
    // Nothing is spliced into the SQL text; release ids and probe words are all
    // bound parameters, on both databases.
    assert.ok(seen.every((query) => !query.sql.includes("it-live")));
  });
});

test("a failed D1 query is an error, never an empty answer", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({ success: false, errors: [{ code: 7502, message: "no such table" }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  // The dangerous failure mode: a broken query returning [] reads as "this
  // release has no records", which the gate would report as a clean FAIL on the
  // wrong check. It has to be an error instead.
  await assert.rejects(
    fromD1Http({ accountId: "a", databaseId: "b", apiToken: "c", fetchImpl }).all(
      "SELECT 1",
      [],
    ),
    /7502: no such table/,
  );
});
