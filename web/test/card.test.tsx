// A shared link's card (#304): what it says, how it is drawn, and how the
// Worker answers its address.
//
// What it says is read off the development fixture, through the page's own
// lookup. The drawing runs Satori and resvg's Node builds over the committed
// faces, which are the same bytes the Worker bundles. The route runs against a
// fake desk, so a cache hit and a limited visitor are values, not a Worker.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { Resvg } from "@cf-wasm/resvg/node";
import { satori, type Font } from "@cf-wasm/satori/node";
import { seedSql } from "../../src/import/seedSql.js";
import { planHide } from "../../src/import/hideRecords.js";
import { findHiddenRecords, readRulePass } from "../../src/import/hiddenLayer.js";
import { LanguageHeadings } from "../../src/italian/sectionLanguage.js";
import { suggestPath } from "@/lib/dictionary/suggestionAsker.ts";
import { fromNodeSqlite } from "../../src/lookup/database.js";
import { servedVersion, versionToken } from "../../src/lookup/served.js";
import { loadFixturePages } from "../../src/source/rawPage.js";
import { chooseChanges, planApply } from "../../src/update/apply.js";
import { diffAgainstMaster } from "../../src/update/diff.js";
import type { Attempt } from "@/lib/dictionary/attempt.ts";
import {
  cardAddressOf,
  cardOf,
  cardPath,
  CARD_DRAWING,
  HOME_CARD,
  linkPreview,
  type Card,
  type WordCard,
} from "@/lib/dictionary/card.ts";
import { headingGender, headingGrammar } from "@/lib/dictionary/genderGrid.ts";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";
import { requestOrigin } from "@/lib/shared/requestOrigin.ts";
import { answerCard, CARD_SOURCE_HEADER, type CardDesk } from "@/worker/card.ts";
import { cardSvg, drawCard, headwordSizeOf, type CardEngine, type CardInk } from "@/worker/card/draw.tsx";
import { oklchToHex, paletteOf } from "@/worker/card/palette.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const WEB = fileURLToPath(new URL("..", import.meta.url));
const RELEASE = "it-card-test";
/** The fixture's served version: its release, with no change applied. */
const VERSION = versionToken({ release: RELEASE, lastChange: null });

let dir: string;
/** The seed's SQL, so a test that applies a change can start from its own copy. */
let seed: string[];
let sqlite: DatabaseSync;
let ink: CardInk;

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
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  seed = await Promise.all(parts.map((part) => readFile(part, "utf8")));
  sqlite = seeded();

  const face = async (name: string, file: string, weight: 400 | 600, style: "normal" | "italic"): Promise<Font> => {
    const bytes = await readFile(join(WEB, "fonts/card", file));
    return { name, data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), weight, style };
  };
  ink = {
    engine: { satori, Resvg },
    // The five the Worker bundles (worker/card/desk.ts).
    fonts: [
      await face("Spectral", "Spectral-400-normal.woff.bin", 400, "normal"),
      await face("Spectral", "Spectral-400-italic.woff.bin", 400, "italic"),
      await face("Inter", "Inter-400-normal.woff.bin", 400, "normal"),
      await face("Inter", "Inter-600-normal.woff.bin", 600, "normal"),
      await face("IBM Plex Mono", "IBMPlexMono-400-normal.woff.bin", 400, "normal"),
    ],
    palette: paletteOf(await readFile(join(WEB, "app/globals.css"), "utf8")),
  };
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

test("a page whose first reading has no definition: the card speaks for its first numbered reading", async () => {
  // fuori's Interiezione reading has no definition, so the page gives it no
  // number. Put first, it opens the page; the page's first meaning is still the
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

test("a searched expression's card is titled as typed, with no pronunciation and no gender", async () => {
  const card = await wordCard("vado via");
  assert.equal(card.headword, "vado via");
  assert.equal(card.pronunciation, undefined);
  assert.equal(card.gender, undefined);
  assert.equal(card.partOfSpeech, "Voce verbale");
});

test("an unknown word and a failed lookup get the home card", async () => {
  assert.deepEqual(cardOf(await attempt("zzzqqq")), HOME_CARD);
  assert.deepEqual(cardOf({ outcome: "failed" }), HOME_CARD);
});

test("a card's address carries the drawing, the served version and the word, and reads back", () => {
  const version = versionToken({ release: "it-0c432803", lastChange: "chg-0123456789ab" });
  assert.equal(version, "it-0c432803.chg-0123456789ab");
  assert.equal(versionToken({ release: "it-0c432803", lastChange: null }), "it-0c432803.0");
  const path = cardPath({ version, word: "vado via" });
  assert.equal(path, `/card/${CARD_DRAWING}/it-0c432803.chg-0123456789ab.png?word=vado+via`);
  assert.deepEqual(cardAddressOf(new URL(path, "https://lexema.fyi")), {
    drawing: CARD_DRAWING,
    version,
    word: "vado via",
  });
  assert.equal(cardPath({ version, word: undefined }), `/card/${CARD_DRAWING}/it-0c432803.chg-0123456789ab.png`);
  assert.equal(cardAddressOf(new URL("https://lexema.fyi/card/1/it-0c432803.0.png?word=%20%20"))?.word, undefined);
  // An address from before the version was in it is still a card's, to be sent on.
  assert.deepEqual(cardAddressOf(new URL("https://lexema.fyi/card/1/it-0c432803.png?word=casa")), {
    drawing: CARD_DRAWING,
    version: "it-0c432803",
    word: "casa",
  });
  for (const other of ["/", "/card", "/card/1.png", "/card/1/a/b.png", "/card/1/it-dev.jpg", "/cards/1/it-dev.png"]) {
    assert.equal(cardAddressOf(new URL(other, "https://lexema.fyi")), undefined, other);
  }
});

test("a result page's preview tags: title, description, a 1200×630 PNG on the page's own host, a large card", () => {
  const card: Card = {
    kind: "word",
    headword: "bello",
    pronunciation: "/ˈbɛllo/",
    gender: "maschile",
    partOfSpeech: "Aggettivo",
    meaning: "che desta impressione di piacere e gradimento",
  };
  const tags = linkPreview({ title: "Bello — Lexema", card, word: " bello ", version: "it-0c432803.0", origin: "https://x.preview.lexema.fyi" });
  assert.equal(tags.description, "che desta impressione di piacere e gradimento");
  assert.equal(tags.openGraph.title, "Bello — Lexema");
  assert.deepEqual(tags.openGraph.images, [
    { url: "https://x.preview.lexema.fyi/card/1/it-0c432803.0.png?word=bello", width: 1200, height: 630, type: "image/png" },
  ]);
  assert.equal(tags.twitter.card, "summary_large_image");

  // The home page, an unknown word and a limited search all name the one home card.
  const home = linkPreview({ title: "Lexema — a simple dictionary", card: HOME_CARD, word: "zzzqqq", version: "it-0c432803.0", origin: "https://lexema.fyi" });
  assert.equal(home.openGraph.images[0].url, "https://lexema.fyi/card/1/it-0c432803.0.png");
  assert.equal(home.description, "a simple dictionary");
});

test("the origin a page names its card on", () => {
  const origin = (headers: Record<string, string>) => requestOrigin(new Headers(headers));
  assert.equal(origin({ host: "lexema.fyi", "x-forwarded-proto": "https" }), "https://lexema.fyi");
  assert.equal(origin({ host: "lexema.fyi" }), "https://lexema.fyi");
  assert.equal(origin({ host: "localhost:8787" }), "http://localhost:8787");
  assert.equal(origin({ host: "developers.localhost:8787" }), "http://developers.localhost:8787");
  assert.equal(origin({ host: "x.preview.lexema.fyi", "x-forwarded-proto": "https, http" }), "https://x.preview.lexema.fyi");
});

test("the card's colours are the page's role tokens, each the design file's own hex", async () => {
  // globals.css names the design hex beside each oklch it declares.
  assert.deepEqual(ink.palette, {
    surface: "#121110",
    textStrong: "#f4f0e6",
    text: "#c4beb2",
    textMuted: "#8b8579",
    accent: "#d2a85c",
  });
  assert.equal(oklchToHex(0.6601, 0.14, 38.1), "#d9704f");
  assert.throws(() => paletteOf("@theme { --color-surface: oklch(17.84% 0.0026 67.7deg); }"), /--color-text-strong/);
});

test("a headword takes the largest size that fits one line: casa at 128px, precipitevolissimevolmente at 72px", async () => {
  assert.equal(await headwordSizeOf("casa", ink), 128);
  assert.equal(await headwordSizeOf("precipitevolissimevolmente", ink), 72);
});

/** Every node Satori lays out while drawing `card`, with its text. */
async function layout(card: Card): Promise<{ text: string | undefined; height: number; width: number }[]> {
  const nodes: { text: string | undefined; height: number; width: number }[] = [];
  const engine: CardEngine = {
    satori: (element, options) =>
      satori(element, {
        ...options,
        onNodeDetected: (node) => {
          nodes.push({ text: node.textContent, height: node.height, width: node.width });
          options.onNodeDetected?.(node);
        },
      }),
    Resvg,
  };
  await cardSvg(card, { ...ink, engine });
  return nodes;
}

const LONG: WordCard = {
  kind: "word",
  headword: "precipitevolissimevolmente",
  pronunciation: "/pre.t͡ʃi.pi.te.vo.lis.si.me.vol.ˈmen.te/",
  gender: undefined,
  partOfSpeech: "Avverbio",
  meaning:
    "in modo molto precipitoso, detto soprattutto in modo scherzoso o ironico; è ritenuta, a torto, la parola più lunga della lingua italiana, ma non lo è",
};

test("a long headword stays on one line and a long meaning stops at two", async () => {
  const nodes = await layout(LONG);
  const headword = nodes.filter((node) => node.text === LONG.headword).at(-1);
  assert.ok(headword !== undefined);
  assert.equal(headword.height, 72, "one line at 72px");
  const meaning = nodes.find((node) => node.text === LONG.meaning);
  assert.ok(meaning !== undefined);
  assert.equal(meaning.height, 2 * 52, "two lines of 52px");

  const short = (await layout({ ...LONG, headword: "bello", meaning: "che desta impressione di piacere e gradimento" })).find(
    (node) => node.text === "che desta impressione di piacere e gradimento",
  );
  assert.equal(short?.height, 52);
});

test("the cut meaning ends in an ellipsis", async () => {
  // Satori writes text as paths unless asked for the text itself.
  const engine: CardEngine = { satori: (element, options) => satori(element, { ...options, embedFont: false }), Resvg };
  const svg = await cardSvg(LONG, { ...ink, engine });
  assert.match(svg, /…/);
  assert.doesNotMatch(svg, /non lo è/);
});

/** A PNG's width and height, from its IHDR chunk. */
const pngSize = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  assert.deepEqual([...bytes.subarray(1, 4)], [0x50, 0x4e, 0x47], "a PNG");
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

test("every card is a 1200×630 PNG", async () => {
  for (const card of [HOME_CARD, LONG, await wordCard("bello")]) {
    assert.deepEqual(pngSize(await drawCard(card, ink)), { width: 1200, height: 630 });
  }
});

// The route, over a fake desk.

class Recorder {
  readonly kept = new Map<string, Response>();
  readonly drawn: Card[] = [];
  readonly looked: string[] = [];
  readonly pending: Promise<unknown>[] = [];
  admitting = true;
  failing = false;
  /** The served version the desk reads; undefined when the read fails. */
  version: string | undefined = VERSION;
  versionReads = 0;

  desk(): CardDesk {
    return {
      version: async () => {
        this.versionReads += 1;
        return this.version;
      },
      cache: {
        match: async (key: RequestInfo | URL) => this.kept.get(new Request(key).url)?.clone(),
        put: async (key: RequestInfo | URL, response: Response) => {
          this.kept.set(new Request(key).url, response);
        },
      } as CardDesk["cache"],
      admit: async () => this.admitting,
      lookup: async (word) => {
        this.looked.push(word);
        return this.failing ? { outcome: "failed" } : attempt(word);
      },
      draw: async (card) => {
        this.drawn.push(card);
        return new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      },
      waitUntil: (work) => this.pending.push(work),
    };
  }
}

const get = (path: string, method = "GET") => new Request(new URL(path, "https://lexema.fyi"), { method });

test("a card is drawn once: the second request is answered from the cache, with no lookup", async () => {
  const recorder = new Recorder();
  const path = cardPath({ version: VERSION, word: "bello" });
  const first = await answerCard(get(path), recorder.desk());
  assert.equal(first?.status, 200);
  assert.equal(first?.headers.get("content-type"), "image/png");
  assert.equal(first?.headers.get(CARD_SOURCE_HEADER), "miss");
  assert.match(first?.headers.get("cache-control") ?? "", /public, max-age=31536000, immutable/);
  await Promise.all(recorder.pending);

  const second = await answerCard(get(path), recorder.desk());
  assert.equal(second?.headers.get(CARD_SOURCE_HEADER), "hit");
  assert.equal(second?.headers.get("content-type"), "image/png");
  assert.deepEqual(recorder.looked, ["bello"], "one lookup across both requests");
  assert.equal(recorder.drawn.length, 1);
  assert.equal((recorder.drawn[0] as WordCard).headword, "bello");
});

test("a card of another version or drawing is sent on to the current one", async () => {
  const recorder = new Recorder();
  for (const path of [
    // Another release, another last change, the release alone (an address from
    // before the version was in it), and another drawing.
    "/card/1/it-old.0.png?word=casa",
    "/card/1/it-card-test.chg-0123456789ab.png?word=casa",
    "/card/1/it-card-test.png?word=casa",
    `/card/0/${VERSION}.png?word=casa`,
  ]) {
    const response = await answerCard(get(path), recorder.desk());
    assert.equal(response?.status, 302, path);
    assert.equal(response?.headers.get("location"), cardPath({ version: VERSION, word: "casa" }));
    assert.equal(response?.headers.get("cache-control"), "no-store");
  }
  assert.deepEqual(recorder.looked, []);
  assert.equal(recorder.versionReads, 4, "every request reads the served version");
});

test("after the version moves, the old address is sent on and the card kept under it is never answered", async () => {
  const recorder = new Recorder();
  const before = cardPath({ version: VERSION, word: "bello" });
  await answerCard(get(before), recorder.desk());
  await Promise.all(recorder.pending);
  assert.equal(recorder.kept.size, 1);

  recorder.version = versionToken({ release: RELEASE, lastChange: "chg-0123456789ab" });
  const after = cardPath({ version: recorder.version, word: "bello" });
  assert.notEqual(after, before);
  const old = await answerCard(get(before), recorder.desk());
  assert.equal(old?.status, 302);
  assert.equal(old?.headers.get("location"), after);

  const current = await answerCard(get(after), recorder.desk());
  assert.equal(current?.headers.get(CARD_SOURCE_HEADER), "miss", "drawn afresh, not the card kept under the old address");
  assert.deepEqual(recorder.looked, ["bello", "bello"]);
});

test("when the served version cannot be read, a card is the home card, not kept, with no lookup", async () => {
  const recorder = new Recorder();
  recorder.version = undefined;
  for (const path of [cardPath({ version: VERSION, word: "bello" }), "/card/1/it-card-test.png?word=bello"]) {
    const response = await answerCard(get(path), recorder.desk());
    assert.equal(response?.status, 200, path);
    assert.equal(response?.headers.get(CARD_SOURCE_HEADER), "unkept");
    assert.equal(response?.headers.get("cache-control"), "no-store");
  }
  assert.deepEqual(recorder.drawn, [HOME_CARD, HOME_CARD]);
  assert.deepEqual(recorder.looked, []);
  assert.equal(recorder.kept.size, 0);
});

// An apply (#18), over the fixture: a later release that rewrites bello's first meaning.

test("an apply that changes a word's first meaning moves its card's address, and every other card's", async () => {
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
    const address = async (word: string) => cardPath({ version: await version(), word });

    assert.equal(await version(), VERSION);
    const belloBefore = await address("bello");
    const casaBefore = await address("casa");
    const casaCard = await card("casa");
    assert.equal(((await card("bello")) as WordCard).meaning, "che desta impressione di piacere e gradimento");

    const found = await diffAgainstMaster(reader, later);
    const changed = found.diff.changes.filter((change) => change.kind === "changed" && change.word === "bello");
    assert.equal(changed.length, 1, "the one change is bello's");
    const plan = await planApply(reader, found, chooseChanges(found, [changed[0].id]), {
      schema: await readFile(join(REPO, "src/db/schema.sql"), "utf8"),
      appliedAt: "2026-10-01T12:00:00Z",
    });
    db.exec("BEGIN");
    db.exec(plan.sql);
    db.exec("COMMIT");

    // bello's card now says the new meaning, under a new address.
    assert.equal(((await card("bello")) as WordCard).meaning, "gradevole a vedersi");
    assert.equal(await version(), versionToken({ release: RELEASE, lastChange: changed[0].id }));
    assert.notEqual(await address("bello"), belloBefore);
    // casa's card is the same, and its address moves too: the route cannot tell
    // an untouched word without the lookup its cache exists to skip (worker/card.ts).
    assert.deepEqual(await card("casa"), casaCard);
    assert.notEqual(await address("casa"), casaBefore);
  } finally {
    db.close();
  }
});

test("the home card needs no lookup and no search allowance", async () => {
  const recorder = new Recorder();
  recorder.admitting = false;
  const response = await answerCard(get(cardPath({ version: VERSION, word: undefined })), recorder.desk());
  assert.equal(response?.headers.get(CARD_SOURCE_HEADER), "miss");
  assert.deepEqual(recorder.drawn, [HOME_CARD]);
  assert.deepEqual(recorder.looked, []);
});

test("over the search limit, or with the lookup failing, a word gets the home card, not kept", async () => {
  const limited = new Recorder();
  limited.admitting = false;
  const response = await answerCard(get(cardPath({ version: VERSION, word: "bello" })), limited.desk());
  assert.equal(response?.status, 200);
  assert.equal(response?.headers.get(CARD_SOURCE_HEADER), "unkept");
  assert.equal(response?.headers.get("cache-control"), "no-store");
  assert.deepEqual(limited.drawn, [HOME_CARD]);
  assert.deepEqual(limited.looked, [], "a limited visitor's card reads no database");
  assert.equal(limited.kept.size, 0);

  const failing = new Recorder();
  failing.failing = true;
  const failed = await answerCard(get(cardPath({ version: VERSION, word: "bello" })), failing.desk());
  assert.equal(failed?.headers.get(CARD_SOURCE_HEADER), "unkept");
  assert.deepEqual(failing.drawn, [HOME_CARD]);
  assert.equal(failing.kept.size, 0);
});

test("an unknown word's card is the home card, kept like any other", async () => {
  const recorder = new Recorder();
  const response = await answerCard(get(cardPath({ version: VERSION, word: "zzzqqq" })), recorder.desk());
  assert.equal(response?.headers.get(CARD_SOURCE_HEADER), "miss");
  assert.deepEqual(recorder.drawn, [HOME_CARD]);
});

test("anything but a card's address goes on to the app; a card refuses anything but GET and HEAD", async () => {
  const recorder = new Recorder();
  assert.equal(await answerCard(get("/?q=casa"), recorder.desk()), undefined);
  const post = await answerCard(get(cardPath({ version: VERSION, word: "casa" }), "POST"), recorder.desk());
  assert.equal(post?.status, 405);
});

test("live hide and serving-code deployments move card and suggestion keys, redirecting old cards", async () => {
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
    assert.notEqual(cardPath({ version: before, word: "zapateros" }), cardPath({ version: activated, word: "zapateros" }));
    assert.notEqual(suggestPath("za", before), suggestPath("za", activated));
    assert.equal(await version("deployment-a"), before, "rolling the release binding back restores its address");
    const unchangedDataDeploy = await version("deployment-b");
    assert.notEqual(cardPath({ version: before, word: "zapateros" }), cardPath({ version: unchangedDataDeploy, word: "zapateros" }), "a deploy alone changes the card key");
    assert.notEqual(suggestPath("za", before), suggestPath("za", unchangedDataDeploy), "a deploy alone changes the suggestion key");
    const found = await findHiddenRecords([], await readRulePass(actual), LanguageHeadings.fromList([]));
    const plan = planHide({ query: <Row,>(sql: string) => db.prepare(sql).all() as Row[] }, found, await readFile(join(REPO, "src/db/schema.sql"), "utf8"));
    assert.ok(plan.hides.length > 0);
    db.exec("BEGIN");
    db.exec(plan.sql);
    db.exec("COMMIT");
    const afterHide = await version("deployment-a");
    const afterDeploy = await version("deployment-b");
    const recorder = new Recorder();
    for (const [previous, current] of [[before, afterHide], [afterHide, afterDeploy]]) {
      const previousCard = cardPath({ version: previous, word: "zapateros" });
      const currentCard = cardPath({ version: current, word: "zapateros" });
      assert.notEqual(currentCard, previousCard);
      assert.notEqual(suggestPath("za", current), suggestPath("za", previous));
      recorder.version = current;
      const response = await answerCard(get(previousCard), recorder.desk());
      assert.equal(response?.status, 302);
      assert.equal(response?.headers.get("location"), currentCard);
      assert.equal(response?.headers.get("cache-control"), "no-store");
    }
    assert.deepEqual(recorder.looked, [], "old addresses redirect before lookup or cache use");
  } finally {
    db.close();
  }
});
