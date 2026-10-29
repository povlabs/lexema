// A shared link's preview (#304, #919): what it says, and the one picture
// every page names.
//
// What it says is read off the development fixture, through the page's own
// lookup. The picture is a committed file; no test draws one, because nothing
// does any more.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../../src/import/seedSql.js";
import { PageOnlyCandidates, readUnrecordedPageTitles, UNRECORDED_PAGE_TITLES_FILE } from "../../src/import/pageOnlyCandidates.js";
import { planHide } from "../../src/import/hideRecords.js";
import { findHiddenRecords, readRulePass } from "../../src/import/hiddenLayer.js";
import { LanguageHeadings } from "../../src/italian/sectionLanguage.js";
import { suggestPath } from "@/lib/dictionary/suggestionAsker.ts";
import { fromNodeSqlite } from "../../src/lookup/database.js";
import { servedVersion, versionToken } from "../../src/lookup/served.js";
import { loadFixturePages } from "../../src/source/rawPage.js";
import { chooseChanges, planApply } from "../../src/update/apply.js";
import { diffAgainstMaster } from "../../src/update/diff.js";
import { masterUpgradeSql } from "../../src/update/masterUpgrade.js";
import type { Attempt } from "@/lib/dictionary/attempt.ts";
import type { DeclaredLemmaResult } from "../../src/lookup/types.js";
import { declaredLemmaPage } from "@/lib/dictionary/declaredLemmaPage.ts";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardDescription,
  cardOf,
  HOME_CARD,
  linkPreview,
  SHARE_IMAGE_PATH,
  type WordCard,
} from "@/lib/dictionary/card.ts";
import { pageTitle, SITE_TAGLINE } from "@/lib/dictionary/params.ts";
import { headingGender, headingGrammar } from "@/lib/dictionary/genderGrid.ts";
import { headingTitle, wordPage } from "@/lib/dictionary/wordPage.ts";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";
import { requestOrigin } from "@/lib/shared/requestOrigin.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const WEB = fileURLToPath(new URL("..", import.meta.url));
const RELEASE = "it-card-test";
/** The fixture's served version: its release, with no change applied. */
const VERSION = versionToken({ release: RELEASE, lastChange: null });

let dir: string;
/** The seed's SQL, so a test that applies a change can start from its own copy. */
let seed: string[];
let sqlite: DatabaseSync;

function seeded(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const part of seed) db.exec(part);
  return db;
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-card-"));
  const archive = join(dir, "dev-seed.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(join(REPO, "fixtures/dev-seed.jsonl"))));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    rawPages: await loadFixturePages(join(REPO, "fixtures")),
    // As `pnpm run seed:dev` offers them for the fixture (#499).
    pageOnly: PageOnlyCandidates.listed(await readUnrecordedPageTitles(join(REPO, UNRECORDED_PAGE_TITLES_FILE))),
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  seed = await Promise.all(parts.map((part) => readFile(part, "utf8")));
  sqlite = seeded();
});

after(async () => {
  sqlite.close();
  await rm(dir, { recursive: true, force: true });
});

const attempt = (query: string): Promise<Attempt> => searchAttempt(fromNodeSqlite(sqlite), RELEASE, query);

const wordCard = async (query: string): Promise<WordCard> => {
  const card = cardOf(await attempt(query));
  assert.equal(card.kind, "word", `${query} has a word card`);
  return card as WordCard;
};

test("bello's card: its pronunciation, the gender its heading shows, its part of speech, its first meaning", async () => {
  const card = await wordCard("bello");
  assert.deepEqual(card, {
    kind: "word",
    headword: "bello",
    pronunciation: "/ˈbɛllo/",
    gender: "maschile",
    partOfSpeech: "Aggettivo",
    meaning: "che desta impressione di piacere e gradimento",
  });
});

test("a feminine noun's card says femminile, as its page's heading does", async () => {
  const card = await wordCard("scuola");
  assert.equal(card.gender, "femminile");
  assert.equal(card.partOfSpeech, "Sostantivo");
  assert.equal(card.pronunciation, "/ˈskwɔla/");
});

test("a gender stated only by a gloss stamp is on the card, and a word whose page shows no gender has none", async () => {
  // casa's Italian record has no gender tag, in the fixture as in it-0c432803;
  // its gloss `casa ( approfondimento) f sing` states it (#317).
  const casa = await wordCard("casa");
  assert.equal(casa.gender, "femminile");
  assert.equal(casa.pronunciation, "/ˈkaza/");
  assert.equal(casa.partOfSpeech, "Sostantivo");
  assert.match(casa.meaning ?? "", /^edificio costruito per essere utilizzato come abitazione/);
  // A verb's heading carries no grammar at all.
  const dormire = await wordCard("dormire");
  assert.equal(dormire.partOfSpeech, "Verbo");
  assert.equal(dormire.gender, undefined);
});

test("a page whose first reading has no definition: the card speaks for its first reading that has one (#687)", async () => {
  // fuori's Interiezione reading has no definition. Put first, it opens the
  // page as `1 · Interiezione`; the page's first meaning is still the
  // Avverbio's, and so is the card's.
  const found = await attempt("fuori");
  assert.equal(found.outcome, "found");
  if (found.outcome !== "found") return;
  const bare = found.readings.find((reading) => reading.posTitle === "Interiezione");
  assert.ok(bare, "fuori has an Interiezione reading");
  const rest = found.readings.filter((reading) => reading !== bare);
  const card = cardOf({ ...found, readings: [bare, ...rest] });
  const usual = await wordCard("fuori");
  assert.equal(card.kind, "word");
  assert.equal(usual.partOfSpeech, "Avverbio");
  assert.deepEqual(card, usual);
  assert.ok(usual.meaning !== undefined, "the Avverbio reading has a meaning");
});

test("the card's gender is exactly the gender its reading's heading opens with", async () => {
  for (const word of ["bello", "bella", "scuola", "casa", "khmer", "fine", "sale", "studente", "andare"]) {
    const found = await attempt(word);
    if (found.outcome !== "found") continue;
    for (const reading of found.readings) {
      const gender = headingGender(reading);
      const grammar = headingGrammar(reading);
      if (gender === undefined) assert.ok(grammar === undefined || !/maschile|femminile/.test(grammar), word);
      else assert.ok(grammar?.startsWith(gender), `${word}: ${grammar} opens with ${gender}`);
    }
  }
});

test("a compound verb form's card speaks for its Voce verbale line, as its page opens with it (#627)", async () => {
  assert.deepEqual(await wordCard("sono andato"), {
    kind: "word",
    headword: "sono andato",
    pronunciation: undefined,
    gender: undefined,
    partOfSpeech: "Voce verbale",
    meaning: "prima persona singolare del passato prossimo indicativo di andare",
  });
});

test("a form's block whose records have several parts of speech: its card names each, as the block's heading does (#735)", async () => {
  const bella = await wordCard("bella");
  assert.equal(bella.partOfSpeech, "Aggettivo · Sostantivo");
  assert.equal(bella.gender, "femminile");
  assert.equal((await wordCard("costruttrici")).partOfSpeech, "Aggettivo · Sostantivo");
});

test("a form's block whose records share one part of speech: its card keeps the first record's pos_title (#735)", async () => {
  assert.equal((await wordCard("blasfeme")).partOfSpeech, "Aggettivo, forma flessa");
  assert.equal((await wordCard("bellissima")).partOfSpeech, "Aggettivo, forma flessa");
});

test("a form page's card reads its part of speech off the heading of the block its page opens with (#735)", async () => {
  for (const word of ["bella", "costruttrici", "grandi", "blasfeme", "bellissima"]) {
    const found = await attempt(word);
    assert.equal(found.outcome, "found", word);
    if (found.outcome !== "found" || found.route.kind === "phrase") assert.fail(`${word} has a word page`);
    const [block] = wordPage(word, found.readings, found.lemmas, found.route).readings;
    assert.ok(block.kind === "source" && block.role === "form-of", `${word}'s page opens with a form's block`);
    assert.equal((await wordCard(word)).partOfSpeech, headingTitle(block.heading), word);
  }
});

test("a searched expression's card is titled as typed, with no pronunciation and no gender", async () => {
  const card = await wordCard("vado via");
  assert.equal(card.headword, "vado via");
  assert.equal(card.pronunciation, undefined);
  assert.equal(card.gender, undefined);
  assert.equal(card.partOfSpeech, "Voce verbale");
});

test("a declared lemma's card is its word and its part of speech, and nothing it has not got (#453)", async () => {
  const notFound = await attempt("verbalizzare");
  assert.ok(notFound.outcome === "not-found");
  const ref = { releaseId: RELEASE, lineNo: 1, jsonPointer: "/word", lineSha256: "0".repeat(64) };
  const result: DeclaredLemmaResult = {
    outcome: "declared-lemma",
    query: notFound.query,
    release: notFound.release,
    readings: [{
      pos: "verb",
      posTitle: "Verbo",
      word: "verbalizzare",
      forms: [{ surface: "verbalizzando", ref, gloss: { text: "gerundio di verbalizzare", ref }, slot: { kind: "gerund" } }],
    }],
  };
  const page = declaredLemmaPage(result);
  assert.ok(page !== undefined);
  assert.deepEqual(cardOf({ ...result, page, written: [] }), {
    kind: "word",
    headword: "verbalizzare",
    pronunciation: undefined,
    gender: undefined,
    partOfSpeech: "Verbo",
    meaning: undefined,
  });
});

test("an unknown word and a failed lookup get the home card", async () => {
  assert.deepEqual(cardOf(await attempt("zzzqqq")), HOME_CARD);
  assert.deepEqual(cardOf({ outcome: "failed" }), HOME_CARD);
});

// The tags, as page.tsx builds them: the title pageTitle gives, the card cardOf gives.

/** The one picture's tag, on `origin` (#919). */
const shareImage = (origin: string) => ({ url: `${origin}/share-card.png`, width: 1200, height: 630, type: "image/png" });

test("a word page's preview: its own title and first meaning, the one static picture, a large card", async () => {
  const found = await attempt("casa");
  assert.equal(found.outcome, "found");
  const title = pageTitle("casa", { found: "casa" });
  const tags = linkPreview({ title, card: cardOf(found), origin: "https://x.preview.lexema.fyi" });
  assert.equal(tags.openGraph.title, "Casa — Lexema");
  assert.equal(tags.description, (await wordCard("casa")).meaning);
  assert.ok(tags.description !== SITE_TAGLINE && tags.description.length > 0);
  assert.equal(tags.openGraph.description, tags.description);
  assert.deepEqual(tags.openGraph.images, [shareImage("https://x.preview.lexema.fyi")]);
  assert.equal(tags.twitter.card, "summary_large_image");
});

test("the home page's preview: the site's title and tagline, and the same picture as a word page", async () => {
  const title = pageTitle("");
  const home = linkPreview({ title, card: HOME_CARD, origin: "https://lexema.fyi" });
  assert.equal(home.openGraph.title, "Lexema — un dizionario semplice");
  assert.equal(home.description, "un dizionario semplice");
  assert.deepEqual(home.openGraph.images, [shareImage("https://lexema.fyi")]);
  // A word page names the very same file, whatever the word.
  for (const word of ["bello", "casa", "zzzqqq"]) {
    const tags = linkPreview({ title: pageTitle(word), card: cardOf(await attempt(word)), origin: "https://lexema.fyi" });
    assert.deepEqual(tags.openGraph.images, home.openGraph.images, word);
  }
});

test("the picture every preview names is a committed 1200×630 PNG in web/public", async () => {
  const bytes = await readFile(join(WEB, "public", SHARE_IMAGE_PATH));
  // A PNG's signature, then its IHDR chunk: width and height, big-endian.
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.deepEqual({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }, { width: CARD_WIDTH, height: CARD_HEIGHT });
});

test("the origin a page names its picture on", () => {
  const origin = (headers: Record<string, string>) => requestOrigin(new Headers(headers));
  assert.equal(origin({ host: "lexema.fyi", "x-forwarded-proto": "https" }), "https://lexema.fyi");
  assert.equal(origin({ host: "lexema.fyi" }), "https://lexema.fyi");
  assert.equal(origin({ host: "localhost:8787" }), "http://localhost:8787");
  assert.equal(origin({ host: "developers.localhost:8787" }), "http://developers.localhost:8787");
  assert.equal(origin({ host: "x.preview.lexema.fyi", "x-forwarded-proto": "https, http" }), "https://x.preview.lexema.fyi");
});

// An apply (#18), over the fixture: a later release that rewrites bello's first meaning.

test("an apply that changes a word's first meaning changes its preview's line, and moves the suggestion key", async () => {
  const db = seeded();
  try {
    const lines = (await readFile(join(REPO, "fixtures/dev-seed.jsonl"), "utf8")).trimEnd().split("\n");
    const at = lines.findIndex((line) => {
      const record = JSON.parse(line) as { word: string; pos: string };
      return record.word === "bello" && record.pos === "adj";
    });
    const bello = JSON.parse(lines[at]) as { senses: { glosses: string[] }[] };
    bello.senses[0].glosses = ["gradevole a vedersi"];
    lines[at] = JSON.stringify(bello);
    const later = join(dir, "later.jsonl.gz");
    await writeFile(later, gzipSync(Buffer.from(`${lines.join("\n")}\n`, "utf8")));

    const lookups = fromNodeSqlite(db);
    const reader = { query: <Row,>(sql: string) => db.prepare(sql).all() as Row[] };
    const version = async () => versionToken(await servedVersion(lookups, RELEASE));
    const card = async (word: string) => cardOf(await searchAttempt(lookups, RELEASE, word));

    assert.equal(await version(), VERSION);
    const casaCard = await card("casa");
    assert.equal(cardDescription(await card("bello")), "che desta impressione di piacere e gradimento");

    const found = await diffAgainstMaster(reader, later);
    const changed = found.diff.changes.filter((change) => change.kind === "changed" && change.word === "bello");
    assert.equal(changed.length, 1, "the one change is bello's");
    const plan = await planApply(reader, found, chooseChanges(found, [changed[0].id]), {
      appliedAt: "2026-10-01T12:00:00Z",
      // Synthetic archive dates for this cache-lifecycle fixture, not upstream facts.
      catalog: {
        [found.master.archiveSha256]: { sourceUrl: "https://example.org/master", retrievedAt: "2026-07-01T00:00:00Z", dump: { id: "itwiktionary-20260701", basis: "recorded" }, evidence: ["synthetic card fixture"] },
        [found.feed.archiveSha256]: { sourceUrl: "https://example.org/feed", retrievedAt: "2026-09-01T00:00:00Z", dump: { id: "itwiktionary-20260901", basis: "recorded" }, evidence: ["synthetic card fixture"] },
      },
    });
    db.exec("BEGIN");
    db.exec(plan.sql);
    db.exec("COMMIT");

    // bello's preview says the new meaning; casa's is unchanged.
    assert.equal(cardDescription(await card("bello")), "gradevole a vedersi");
    assert.deepEqual(await card("casa"), casaCard);
    assert.equal(await version(), versionToken({ release: RELEASE, lastChange: changed[0].id }));
    assert.notEqual(suggestPath("be", await version()), suggestPath("be", VERSION));
  } finally {
    db.close();
  }
});

test("live hide and serving-code deployments move the suggestion key", async () => {
  const lines = (await readFile(join(REPO, "fixtures/form-of-foreign-lemma/archive-lines.jsonl"), "utf8")).trimEnd().split("\n");
  const actual = join(dir, "hide-actual.jsonl.gz");
  const old = join(dir, "hide-old.jsonl.gz");
  await writeFile(actual, gzipSync(`${lines.join("\n")}\n`));
  // Before the foreign-lemma rule: the master has the same Italian records,
  // but its seeding pass had no foreign forms to judge them by.
  await writeFile(old, gzipSync(`${lines.map((line) => {
    const record = JSON.parse(line);
    return record.lang_code === "it" ? line : JSON.stringify({ ...record, forms: [] });
  }).join("\n")}\n`));
  const seeded = await seedSql({ input: old, outputDir: join(dir, "cache-hide"), schema: join(REPO, "src/db/schema.sql"), releaseId: RELEASE });
  const db = new DatabaseSync(":memory:");
  try {
    for (const part of seeded.parts) db.exec(await readFile(part, "utf8"));
    // Also prove compatibility with a master predating the new version table.
    db.exec("DROP TABLE hide_version");
    const lookups = fromNodeSqlite(db);
    const version = async (code: string, release = RELEASE) => versionToken(await servedVersion(lookups, release), code);
    const before = await version("deployment-a");
    const activated = await version("deployment-a", "it-activated");
    assert.notEqual(suggestPath("za", before), suggestPath("za", activated));
    assert.equal(await version("deployment-a"), before, "rolling the release binding back restores its address");
    const unchangedDataDeploy = await version("deployment-b");
    assert.notEqual(suggestPath("za", before), suggestPath("za", unchangedDataDeploy), "a deploy alone changes the suggestion key");
    const found = await findHiddenRecords([], await readRulePass(actual), LanguageHeadings.fromList([]));
    const plan = planHide({ query: <Row,>(sql: string) => db.prepare(sql).all() as Row[] }, found);
    assert.ok(plan.hides.length > 0);
    // The hide carries no DDL (#509): the upgrade gives the master its version table first.
    db.exec(masterUpgradeSql(await readFile(join(REPO, "src/db/schema.sql"), "utf8")));
    db.exec("BEGIN");
    db.exec(plan.sql);
    db.exec("COMMIT");
    const afterHide = await version("deployment-a");
    const afterDeploy = await version("deployment-b");
    for (const [previous, current] of [[before, afterHide], [afterHide, afterDeploy]]) {
      assert.notEqual(suggestPath("za", current), suggestPath("za", previous));
    }
  } finally {
    db.close();
  }
});

