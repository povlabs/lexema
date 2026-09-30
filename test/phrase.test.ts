// Multi-word search (#214): a query nothing spells, read word by word as its
// lemmas, finds the multi-word headwords those lemmas spell — over the
// development fixture seeded the way `pnpm run seed:dev` seeds D1; and a query
// that nearly spells one, offered in the "Did you mean" list. The page and
// `/v1/lookup` over the same fixture are tested in web/test.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import {
  lemmaSequences,
  MAX_CORRECTED_WORD_LENGTH,
  MAX_PHRASE_PROBES,
  oneEditSpellings,
  participleCandidates,
  phraseGloss,
  phraseSlots,
  slotRuns,
  type WordLemmas,
} from "../src/italian/phrase.js";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { exists, lookup } from "../src/lookup/lookup.js";
import { findNearby, withinOneEdit } from "../src/lookup/nearby.js";
import {
  EXACT_KEY_SQL,
  FORM_ENTRY_SQL,
  HEADWORD_PREFIX_SQL,
  HEADWORD_SPELLING_SQL,
  nearPhrases,
  PARTICIPLE_FORM_ENTRY_SQL,
  PAST_PARTICIPLE_SQL,
  WORD_LEMMAS_SQL,
  type PhraseOffer,
} from "../src/lookup/phrase.js";
import { offered, suggest, SUGGEST_SQL, type Suggested } from "../src/lookup/suggest.js";
import type { DictionaryRead, LookupDatabase } from "../src/lookup/database.js";
import type { FoundResult, LookupResult } from "../src/lookup/types.js";

const RELEASE = "it-phrase-test";

let dir: string;
let sqlite: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-phrase-"));
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

const ask = (query: string): Promise<LookupResult> => lookup({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query });

async function found(query: string): Promise<FoundResult> {
  const result = await ask(query);
  assert.equal(result.outcome, "found", `${query} is found`);
  return result as FoundResult;
}

const words = (result: FoundResult): string[] => result.readings.map((reading) => reading.word);

/** A phrase route's form entries as `word: line` text, the expression in brackets. */
const formLines = (result: FoundResult): string[] =>
  result.route.kind === "phrase"
    ? result.route.forms.flatMap((form) =>
        form.definitions.map((line) => `${form.word}: ${line.before}[${line.phrase}]${line.after}`),
      )
    : [];

test("an inflected expression finds the multi-word headword its lemmas spell", async () => {
  const vado = await found("vado via");
  assert.deepEqual(words(vado), ["andare via"]);
  assert.equal(vado.route.kind, "phrase");
  assert.deepEqual(vado.route.kind === "phrase" && vado.route.phrases, [
    {
      key: "andare via",
      word: "andare via",
      words: [{ typed: "vado", inflected: "vado", lemma: "andare" }, { typed: "via", inflected: "via", lemma: "via" }],
    },
  ]);

  const tiro = await found("tiro fuori");
  assert.deepEqual(words(tiro), ["tirare fuori"]);
  // `tiro` is also a noun headword, so `tiro fuori` was tried too and is no headword.
  assert.deepEqual(tiro.route.kind === "phrase" && tiro.route.phrases.map((phrase) => phrase.key), ["tirare fuori"]);
});

test("an auxiliary and a past participle stand for the participle's verb", async () => {
  const result = await found("sono andati via");
  assert.deepEqual(words(result), ["andare via"]);
  assert.deepEqual(result.route.kind === "phrase" && result.route.phrases, [
    {
      key: "andare via",
      word: "andare via",
      words: [{ typed: "sono andati", inflected: "andati", lemma: "andare" }, { typed: "via", inflected: "via", lemma: "via" }],
    },
  ]);
  // The participle's own form entry, not `essere`'s: `andati` the adjective names `andato`, so it has none.
  assert.deepEqual(formLines(result), ["andati: participio passato plurale maschile di [andare via]"]);
});

test("a participle that names the verb only through its past participle still has its form line", async () => {
  // `fatte`'s records all name `fatto`, and `fatto` is `fare`'s past
  // participle: the line comes through the same hop the rule reads it by.
  const result = await found("hanno fatte fuori");
  assert.deepEqual(words(result), ["fare fuori"]);
  assert.deepEqual(result.route.kind === "phrase" && result.route.phrases, [
    {
      key: "fare fuori",
      word: "fare fuori",
      words: [{ typed: "hanno fatte", inflected: "fatte", lemma: "fare" }, { typed: "fuori", inflected: "fuori", lemma: "fuori" }],
    },
  ]);
  // Only the verb record: `fatte` the adjective and the noun are not forms of `fare`.
  assert.deepEqual(formLines(result), ["fatte: participio passato plurale femminile di [fare fuori]"]);
});

test("the page's lines are the inflected word's form entries, each with its lemma swapped for the expression", async () => {
  assert.deepEqual(formLines(await found("vado via")), [
    "vado: 1ª persona singolare del presente semplice indicativo di [andare via]",
  ]);
  // `tiro` is also a noun; only the verb record's form entry names `tirare`.
  assert.deepEqual(formLines(await found("tiro fuori")), [
    "tiro: prima persona singolare dell'indicativo presente di [tirare fuori]",
  ]);
  // `vada` is a real form, a congiuntivo and an imperativo: every entry shows.
  const vada = await found("vada via");
  assert.deepEqual(words(vada), ["andare via"]);
  assert.deepEqual(formLines(vada), [
    "vada: prima persona congiuntivo presente di [andare via]",
    "vada: seconda persona congiuntivo presente di [andare via]",
    "vada: terza persona congiuntivo presente di [andare via]",
    "vada: terza persona singolare dell'imperativo di [andare via]",
    "vada: seconda persona singolare dell'imperativo di [andare via]",
  ]);
  // One record, two lemmas, two expressions: one entry, each line naming its own.
  const volto = await found("volto le spalle");
  assert.equal(volto.route.kind === "phrase" && volto.route.forms.length, 1);
  assert.deepEqual(formLines(volto), [
    "volto: prima persona singolare del presente di [voltare le spalle]",
    "volto: participio passato maschile singolare di [volgere le spalle]",
  ]);
  // Each line keeps where its gloss is in the source.
  const { route } = await found("vado via");
  const [form] = route.kind === "phrase" ? route.forms : [];
  assert.equal(form?.posTitle, "Voce verbale");
  assert.equal(form?.definitions[0].ref.jsonPointer, "/senses/0/glosses/0");
  assert.equal(form?.definitions[0].ref.releaseId, RELEASE);
});

test("a gloss swaps only its lemma written as a whole word, the last place it is", () => {
  assert.deepEqual(phraseGloss("1ª persona singolare del presente di andare", "andare", "andare via"), {
    before: "1ª persona singolare del presente di ",
    phrase: "andare via",
    after: "",
  });
  assert.deepEqual(phraseGloss("riandare, poi andare (raro)", "andare", "andare via"), {
    before: "riandare, poi ",
    phrase: "andare via",
    after: " (raro)",
  });
  assert.equal(phraseGloss("terza persona singolare imperativo divolare", "volare", "volare via"), undefined);
  assert.equal(phraseGloss("anything", "", "x"), undefined);
});

test("a word with several lemmas tries each, and every headword they spell is a reading", async () => {
  // `volto` is `voltare`'s first person and `volgere`'s past participle.
  const result = await found("volto le spalle");
  assert.deepEqual(words(result).sort(), ["volgere le spalle", "voltare le spalle"]);
  assert.ok(result.readings.every((reading) => reading.isAboutQuery));
});

test("a lemma sequence that is no headword is still not found", async () => {
  for (const query of ["vado fuori", "tiro via", "sono via", "vado"]) {
    const result = await ask(query);
    if (query === "vado") {
      // One word is the exact lookup's alone, unchanged.
      assert.equal(result.outcome === "found" && result.route.kind, "surface");
      continue;
    }
    assert.equal(result.outcome, "not-found", query);
  }
});

test("a query the index spells is answered as typed, never word by word", async () => {
  const result = await found("andare via");
  assert.deepEqual(result.route, { kind: "surface" });
  assert.deepEqual(words(result), ["andare via"]);
});

test("exists agrees with lookup on a phrase", async () => {
  const db = fromNodeSqlite(sqlite);
  const present = await exists({ db, releaseId: RELEASE, query: "vado via" });
  assert.equal(present.outcome === "present" && present.word, "andare via");
  const absent = await exists({ db, releaseId: RELEASE, query: "vado fuori" });
  assert.equal(absent.outcome, "absent");
});

test("a word no record heads stands for itself, so an inflected expression still finds its headword", async () => {
  // Criterion 8 on #214: `l'amore` heads no record in the release.
  assert.equal((await ask("l'amore")).outcome, "not-found");
  const result = await found("faccio l'amore");
  assert.deepEqual(words(result), ["fare l'amore"]);
  assert.deepEqual(result.route.kind === "phrase" && result.route.phrases, [
    {
      key: "fare l'amore",
      word: "fare l'amore",
      words: [{ typed: "faccio", inflected: "faccio", lemma: "fare" }, { typed: "l'amore", inflected: "l'amore", lemma: "l'amore" }],
    },
  ]);
  assert.deepEqual(formLines(result), ["faccio: prima persona singolare del presente semplice indicativo di [fare l'amore]"]);
  const present = await exists({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query: "faccio l'amore" });
  assert.equal(present.outcome === "present" && present.word, "fare l'amore");
  // Standing for itself adds no headword: a sequence that is none still finds nothing.
  assert.equal((await ask("faccio l'amoree")).outcome, "not-found");
});

test("the rule collapses only an auxiliary followed by a participle", () => {
  const sono: WordLemmas = { typed: "sono", lemmas: ["essere", "sono"] };
  const andati: WordLemmas = { typed: "andati", lemmas: ["andare", "andati", "andato"] };
  const via: WordLemmas = { typed: "via", lemmas: ["via"] };
  assert.deepEqual(participleCandidates([sono, andati, via]), [1]);
  assert.deepEqual(
    phraseSlots([sono, andati, via], (index) => (index === 1 ? ["andare"] : [])),
    [{ typed: "sono andati", inflected: "andati", lemmas: ["andare"] }, { typed: "via", inflected: "via", lemmas: ["via"] }],
  );
  // No participle after the auxiliary: every word is its own slot, `essere` included.
  assert.deepEqual(
    phraseSlots([sono, via], () => []),
    [{ typed: "sono", inflected: "sono", lemmas: ["essere", "sono"] }, { typed: "via", inflected: "via", lemmas: ["via"] }],
  );
  // A final auxiliary has nothing to join.
  assert.deepEqual(participleCandidates([via, sono]), []);
});

test("the lemma sequences are bounded", () => {
  const slot = (n: number) => ({ typed: "x", inflected: "x", lemmas: Array.from({ length: n }, (_, i) => `l${i}`) });
  assert.equal(lemmaSequences([slot(16), slot(16)])?.length, MAX_PHRASE_PROBES);
  assert.equal(lemmaSequences([slot(16), slot(16), slot(2)]), undefined);
  assert.deepEqual(lemmaSequences([slot(2), slot(0)]), []);
});

test("every phrase query stays on indexes rather than scanning", () => {
  const plans = [
    [WORD_LEMMAS_SQL, [RELEASE, JSON.stringify(["vado", "via", ...oneEditSpellings("vadp")])]],
    [PAST_PARTICIPLE_SQL, [RELEASE, "andato"]],
    [HEADWORD_SPELLING_SQL, [RELEASE, JSON.stringify(["andare via", "tirare fuori"])]],
    [HEADWORD_PREFIX_SQL, [RELEASE, "tirare fuo", "tirare fup", 8]],
    [EXACT_KEY_SQL, [RELEASE, JSON.stringify(["vado via", "aerei a reazione"])]],
    [FORM_ENTRY_SQL, [RELEASE, "vado", "andare"]],
    [PARTICIPLE_FORM_ENTRY_SQL, [RELEASE, "fatte", "fare"]],
  ] as const;
  for (const [sql, params] of plans) {
    const plan = (sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((row) => row.detail);
    assert.ok(
      !plan.some((step) => /SCAN (lookup_form|form_of_edge|grammar_claim|source_record|sense|sense_gloss|lf|hw|e|g|r|s)\b/.test(step)),
      `phrase query degraded to a scan:\n${plan.join("\n")}`,
    );
  }
});

const nearby = (query: string) => findNearby({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query });

test("a phrase with one word misspelled is offered corrected as typed, not as its headword", async () => {
  // Huey's hand check of 2026-09-30: "vadoo via" → "Did you mean vado via?".
  for (const [query, phrase, headword] of [
    ["tiro fouri", "tiro fuori", "tirare fuori"],
    ["tiro fuory", "tiro fuori", "tirare fuori"],
    ["vadoo via", "vado via", "andare via"],
    // `vja` is one edit from `via`.
    ["vado vja", "vado via", "andare via"],
  ] as const) {
    assert.equal((await ask(query)).outcome, "not-found", query);
    assert.deepEqual(await nearby(query), { kind: "phrase", best: { phrase, headwords: [headword] }, others: [] }, query);
    // What is offered is a search that finds the headword: the phrase's short page.
    const offer = await found(phrase);
    assert.equal(offer.route.kind, "phrase", phrase);
    assert.deepEqual(words(offer), [headword], phrase);
  }
  // `vadp` is one edit from both `vada` and `vado`, forms of `andare`: each
  // correction is offered, unranked, in the order the edits are tried.
  assert.deepEqual(await nearby("vadp via"), {
    kind: "phrase",
    best: { phrase: "vada via", headwords: ["andare via"] },
    others: [{ phrase: "vado via", headwords: ["andare via"] }],
  });
});

test("a phrase the whole query is one edit from is offered once, as the typo", async () => {
  // `tirre fuori` is one edit from `tirare fuori` itself, and `tirre` from `tirare`.
  assert.deepEqual(await nearby("tirre fuori"), { kind: "typo", best: "tirare fuori", others: [], phrases: [] });
});

test("a phrase whose last word is not finished is offered completed as typed", async () => {
  assert.deepEqual(await nearby("tiro fuo"), { kind: "phrase", best: { phrase: "tiro fuori", headwords: ["tirare fuori"] }, others: [] });
  // One typed phrase reaching two headwords is one offer naming both.
  assert.deepEqual(await nearby("volto le"), {
    kind: "phrase",
    best: { phrase: "volto le spalle", headwords: ["volgere le spalle", "voltare le spalle"] },
    others: [],
  });
});

test("a phrase that is only part of the query is offered as those words", async () => {
  assert.deepEqual(await nearby("vado via adesso"), { kind: "phrase", best: { phrase: "vado via", headwords: ["andare via"] }, others: [] });
});

test("a phrase offered through a word no record heads opens its headword's short page", async () => {
  assert.deepEqual(await nearby("faccio l'amor"), {
    kind: "phrase",
    best: { phrase: "faccio l'amore", headwords: ["fare l'amore"] },
    others: [],
  });
  const offer = await found("faccio l'amore");
  assert.equal(offer.route.kind, "phrase");
  assert.deepEqual(words(offer), ["fare l'amore"]);
});

test("a phrase the index spells exactly names only the headword its search opens", async () => {
  // `aerei a reazion` completes to `aerei a reazione` through `aerei` itself
  // and through `aereo`. Searching `aerei a reazione` is the exact lookup,
  // which opens the plural's own record, so *aereo a reazione* is not named.
  assert.deepEqual(words(await found("aerei a reazione")), ["aerei a reazione"]);
  assert.deepEqual(await nearPhrases(fromNodeSqlite(sqlite), RELEASE, "aerei a reazion", 8), [
    { phrase: "aerei a reazione", headwords: ["aerei a reazione"] },
  ]);
});

test("a query that nearly spells no headword offers no phrase", async () => {
  for (const query of ["vado fuori", "tiro via", "sono via"]) {
    const offer = await nearby(query);
    assert.ok(offer.kind !== "phrase" && !("phrases" in offer && offer.phrases.length > 0), `${query}: ${JSON.stringify(offer)}`);
  }
});

test("a word's one-edit spellings are every edit withinOneEdit counts, never the word", () => {
  const spellings = oneEditSpellings("vadp");
  assert.ok(spellings.includes("vado") && spellings.includes("vapd") && spellings.includes("vad") && spellings.includes("vadpo"));
  assert.ok(!spellings.includes("vadp"));
  assert.ok(spellings.every((spelling) => withinOneEdit("vadp", spelling)));
  assert.deepEqual(oneEditSpellings("a".repeat(MAX_CORRECTED_WORD_LENGTH + 1)), []);
});

test("a query's parts are its runs of two or more slots, not all of them", () => {
  const slot = (typed: string) => ({ typed, inflected: typed, lemmas: [typed] });
  assert.deepEqual(slotRuns([slot("a"), slot("b")]), []);
  assert.deepEqual(
    slotRuns([slot("a"), slot("b"), slot("c")]).map((run) => run.map((s) => s.typed).join(" ")),
    ["a b", "b c"],
  );
});

// The search field's suggestions while a query of several words is typed
// (Huey's hand check of 2026-09-30 on #214). `/suggest` runs on every
// keystroke, so what each prefix reads is asserted too.

/** The database, with every statement it is asked recorded. */
function recording(): { db: LookupDatabase; asked: string[] } {
  const inner = fromNodeSqlite(sqlite);
  const asked: string[] = [];
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

async function suggested(prefix: string): Promise<Suggested> {
  const answer = await suggest({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, prefix });
  assert.ok(answer.outcome === "suggested", prefix);
  return answer;
}

test("a headword of several words is suggested as its own prefix is typed", async () => {
  const answer = await suggested("andare v");
  assert.deepEqual(offered(answer), ["andare via"]);
  // The field's own prefix read lists it; the phrase reading adds no second copy.
  assert.deepEqual(answer.phrases, []);
});

test("an inflected phrase being typed is suggested completed as typed", async () => {
  for (const [prefix, phrase, headwords] of [
    ["vado v", "vado via", ["andare via"]],
    ["vado vi", "vado via", ["andare via"]],
    ["tiro f", "tiro fuori", ["tirare fuori"]],
    ["sono andati v", "sono andati via", ["andare via"]],
    ["volto le s", "volto le spalle", ["volgere le spalle", "voltare le spalle"]],
  ] as const) {
    const answer = await suggested(prefix);
    assert.deepEqual(answer.phrases, [{ phrase, headwords }], prefix);
    assert.deepEqual(offered(answer), [phrase], prefix);
    // Choosing it searches it, and the search finds the headword.
    assert.deepEqual(words(await found(phrase)).sort(), [...headwords], prefix);
  }

  // Criterion 8 on #214: `l'amore` and `l'abitudine` head no record, and each
  // expression `faccio l'a` begins is offered, in key order.
  const answer = await suggested("faccio l'a");
  assert.deepEqual(answer.phrases, [
    { phrase: "faccio l'abitudine", headwords: ["fare l'abitudine"] },
    { phrase: "faccio l'amore", headwords: ["fare l'amore"] },
  ]);
  assert.deepEqual(offered(answer), ["faccio l'abitudine", "faccio l'amore"]);
  assert.deepEqual(words(await found("faccio l'amore")), ["fare l'amore"]);
  assert.deepEqual(words(await found("faccio l'abitudine")), ["fare l'abitudine"]);
});

test("a prefix whose lemmas begin no multi-word headword suggests no phrase", async () => {
  for (const prefix of ["vado f", "tiro v", "sono v", "xyz v"]) {
    assert.deepEqual((await suggested(prefix)).phrases, [], prefix);
  }
});

test("a phrase suggestion costs two lemma reads, a range probe per lemma sequence and one exact read; one word costs nothing more", async () => {
  const one = recording();
  await suggest({ db: one.db, releaseId: RELEASE, prefix: "vado" });
  assert.ok(!one.asked.includes(WORD_LEMMAS_SQL) && !one.asked.includes(HEADWORD_PREFIX_SQL), one.asked.join("\n---\n"));
  assert.equal(one.asked.filter((sql) => sql === SUGGEST_SQL).length, 1);

  const vado = recording();
  await suggest({ db: vado.db, releaseId: RELEASE, prefix: "vado v" });
  // `vado` reads as itself and as `andare`. Itself is the field's own prefix
  // read already, so only `andare v` is probed. The offer `vado via` is then
  // read back the way its search reads it: `via`'s lemmas, and whether the
  // index spells `vado via` exactly.
  assert.equal(vado.asked.filter((sql) => sql === WORD_LEMMAS_SQL).length, 2);
  assert.equal(vado.asked.filter((sql) => sql === HEADWORD_PREFIX_SQL).length, 1);
  assert.equal(vado.asked.filter((sql) => sql === EXACT_KEY_SQL).length, 1);
  // The release row, the field's own prefix read, and those four.
  assert.equal(vado.asked.length, 6, vado.asked.join("\n---\n"));

  // A prefix that completes nothing reads nothing back.
  const none = recording();
  await suggest({ db: none.db, releaseId: RELEASE, prefix: "vado f" });
  assert.equal(none.asked.filter((sql) => sql === WORD_LEMMAS_SQL).length, 1);
  assert.ok(!none.asked.includes(EXACT_KEY_SQL), none.asked.join("\n---\n"));
});

// Criterion 8 on #214, over every multi-word headword the fixture holds: said
// through each form of its first word, it is found; and every phrase the field
// or "Did you mean" offers on the way, searched, finds each headword it names.
test("every phrase offered finds each headword it names, for every multi-word headword in the fixture", async () => {
  const headwords = (
    sqlite
      .prepare("SELECT DISTINCT surface_key FROM lookup_form WHERE release_id = ? AND origin = 'headword' AND surface_key LIKE '% %'")
      .all(RELEASE) as { surface_key: string }[]
  ).map((row) => row.surface_key);
  assert.equal(headwords.length, 9, headwords.join(", "));
  const formsOf = sqlite.prepare(
    `SELECT DISTINCT lf.surface_key FROM form_of_edge e
       JOIN lookup_form lf ON lf.record_id = e.record_id AND lf.origin = 'headword'
      WHERE e.target_word_key = ? AND lf.surface_key NOT LIKE '% %'`,
  );
  const reached = async (phrase: string): Promise<string[]> => {
    const result = await ask(phrase);
    return result.outcome === "found" ? words(result) : [];
  };
  let offers = 0;
  const holds = async (from: string, offered: readonly PhraseOffer[]) => {
    for (const offer of offered) {
      offers += 1;
      const found = await reached(offer.phrase);
      for (const headword of offer.headwords) assert.ok(found.includes(headword), `${from} offers "${offer.phrase}" for ${headword}; it finds [${found.join(", ")}]`);
    }
  };
  for (const headword of headwords) {
    const [first, ...rest] = headword.split(" ");
    const spoken = [first, ...(formsOf.all(first) as { surface_key: string }[]).map((row) => row.surface_key)];
    for (const word of spoken) {
      const query = [word, ...rest].join(" ");
      // A query that is itself a headword (`aerei a reazione`) opens its own entry.
      const expected = headwords.includes(query) ? query : headword;
      assert.ok((await reached(query)).includes(expected), `${query} finds ${expected}`);
      const last = rest[rest.length - 1];
      for (let letters = 1; letters < [...last].length; letters += 1) {
        const prefix = [word, ...rest.slice(0, -1), [...last].slice(0, letters).join("")].join(" ");
        await holds(`suggest "${prefix}"`, (await suggested(prefix)).phrases);
        const near = await nearby(prefix);
        await holds(`nearby "${prefix}"`, near.kind === "phrase" ? [near.best, ...near.others] : "phrases" in near ? near.phrases : []);
      }
    }
  }
  assert.ok(offers > 50, `${offers} offers checked`);
});

test("the phrase prefix probe walks the headword index in key order, so LIMIT stops it early", () => {
  const plan = (
    sqlite.prepare(`EXPLAIN QUERY PLAN ${HEADWORD_PREFIX_SQL}`).all(RELEASE, "andare v", "andare w", 10) as { detail: string }[]
  ).map((row) => row.detail);
  assert.ok(
    plan.some((step) => step.includes("lookup_form_headword_by_key") && /surface_key>\? AND surface_key<\?/.test(step)),
    plan.join("\n"),
  );
  assert.ok(!plan.some((step) => /TEMP B-TREE/.test(step)), plan.join("\n"));
});
