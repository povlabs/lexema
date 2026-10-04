// The fields a page-only entry carries beside its definitions (ADR 0026, #439),
// read from the entry's own raw page. Real dump revisions only:
// fixtures/upstream-pages (raccontare, fornire, mastoide) and
// fixtures/page-facts (avventurieri, amano), saved verbatim from
// itwiktionary-20260701. The one page written here, `racconti`, copies
// `avventurieri`'s layout to name a lemma the seed's archive lines head.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { recoverPageEntry, type RecoveredEntry } from "../src/italian/pageEntry.js";
import { PAGE_FACT_RULE, type PageFact, type RelatedKind } from "../src/italian/pageFacts.js";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { isNounReading, isSourceRef, type Reading } from "../src/lookup/types.js";
import { loadFixturePages, rawPageSource, readSavedPage, type RawPage } from "../src/source/rawPage.js";

const fixtures = await loadFixturePages(resolve("fixtures"));
const saved: RawPage[] = await Promise.all(
  (await readdir(resolve("fixtures/page-facts"))).map(async (name) => readSavedPage(await readFile(resolve("fixtures/page-facts", name), "utf8"), name)),
);
const page = (title: string): RawPage => {
  const found = fixtures.page(title) ?? saved.find((candidate) => candidate.title === title);
  assert.ok(found, title);
  return found;
};

const entriesOf = (title: string): RecoveredEntry[] => {
  const result = recoverPageEntry(page(title), new Set());
  assert.ok(result.outcome === "recovered", title);
  return result.entries;
};

/** The facts of a kind, without their refs. */
const factsOf = (entry: RecoveredEntry, kind: PageFact["kind"]): Record<string, unknown>[] =>
  entry.facts.filter((fact) => fact.kind === kind).map(({ ref: _ref, wikitext: _wikitext, kind: _kind, ...rest }) => rest);
/** The facts of one word list. */
const listOf = (entry: RecoveredEntry, kind: RelatedKind) =>
  entry.facts.flatMap((fact) => ((fact.kind === "synonym" || fact.kind === "antonym" || fact.kind === "derived") && fact.kind === kind ? [fact] : []));
const wordsOf = (entry: RecoveredEntry, kind: RelatedKind): string[] => listOf(entry, kind).map((fact) => fact.word);

test("raccontare's and fornire's own pages give their pronunciation, etymology, synonyms, antonyms, derived words and expressions", () => {
  const [raccontare] = entriesOf("raccontare");
  assert.deepEqual(factsOf(raccontare, "pronunciation"), [{ ipa: "/rakkonˈtare/" }]);
  assert.deepEqual(factsOf(raccontare, "etymology"), [{
    text: "derivazione di contare (dal latino compŭtare, formato da con- e da putare cioè \"calcolare, verificare un conto\"), ma è anche possibile un'origine germanica del lemma dall'alto tedesco antico rahhôn cioè \"narrare, tramandare storie\"",
  }]);
  assert.deepEqual(wordsOf(raccontare, "synonym"), [
    "riferire", "parlare", "esporre", "riportare", "enunciare", "ripetere", "menzionare", "dar notizia",
    "narrare", "descrivere", "favoleggiare", "rivelare", "spifferare", "dire", "riferire",
  ]);
  // The label a list line opens with travels with its words, as the archive's `raw_tags` do.
  assert.deepEqual(listOf(raccontare, "synonym").find((fact) => fact.word === "rivelare")?.rawTags, ["confidenze, segreti"]);
  assert.deepEqual(wordsOf(raccontare, "antonym"), ["tacere", "nascondere", "celare"]);
  assert.deepEqual(wordsOf(raccontare, "derived"), ["raccontaballe", "raccontabile", "raccontafavole", "raccontatore", "racconto"]);
  assert.deepEqual(factsOf(raccontare, "expression"), [
    { phrase: "raccontare per filo e per segno", meaning: "raccontare minuziosamente però, in particolare, quando si tratta di chiacchiericcio" },
    { phrase: "la sa raccontare bene", meaning: "è in grado di raccontare frottole e spacciandole come vere" },
    {
      phrase: "ma a chi la racconti?",
      meaning: "chi, invero inutilmente ma proprio convinto di cambiare la sorte di un torto fatto, espone argomentazioni o giustificazioni senza fondamento",
    },
    {
      phrase: "non me la stare a raccontare/[ma] me la stai a raccontare?",
      meaning: "lusinga per indagare in merito all'interlocutore, talvolta con insistenza malgrado la consapevolezza di questo quindi creando una dialettica pressoché insostenibile",
    },
  ]);

  const [fornire] = entriesOf("fornire");
  assert.deepEqual(factsOf(fornire, "pronunciation"), [{ ipa: "/forˈnire/" }]);
  assert.deepEqual(factsOf(fornire, "etymology"), [{ text: "dal francese fournir" }]);
  assert.deepEqual(wordsOf(fornire, "synonym"), [
    "attrezzare", "corredare", "dare", "dotare", "equipaggiare", "erogare", "munire", "procurare", "provvedere", "rifornire",
    "armare", "assegnare", "somministrare", "esibire", "mostrare", "offrire", "finire", "terminare",
  ]);
  assert.deepEqual(listOf(fornire, "synonym").filter((fact) => fact.word === "finire").map((fact) => fact.rawTags), [["letterario"]]);
  assert.deepEqual(wordsOf(fornire, "antonym"), ["defraudare", "negare", "privare", "sfornire", "sguarnire", "sottrarre", "togliere"]);
  assert.deepEqual(wordsOf(fornire, "derived"), ["fornibile", "fornirsi", "fornitore", "fornitura", "rifornire"]);
});

test("every fact names its page revision and 1-based line, and keeps that line verbatim", () => {
  const kinds = new Set<string>();
  for (const title of ["raccontare", "fornire", "mastoide", "avventurieri", "amano"]) {
    const source = page(title);
    const lines = source.wikitext.split("\n");
    for (const entry of entriesOf(title)) {
      for (const fact of entry.facts) {
        kinds.add(fact.kind);
        assert.equal(fact.ref.wiki, source.wiki, title);
        assert.equal(fact.ref.title, source.title, title);
        assert.equal(fact.ref.revisionId, source.revisionId, title);
        assert.ok(fact.ref.line >= 1 && fact.ref.line <= lines.length, `${title}: line ${fact.ref.line}`);
        assert.equal(fact.wikitext, lines[fact.ref.line - 1], `${title} ${fact.kind}`);
      }
    }
  }
  // At least one fact of every kind these pages supply.
  assert.deepEqual([...kinds].sort(), ["antonym", "derived", "etymology", "expression", "form", "form-of", "gender", "number", "pronunciation", "synonym"]);
  const [raccontare] = entriesOf("raccontare");
  const at = (kind: PageFact["kind"]) => raccontare.facts.find((fact) => fact.kind === kind);
  assert.deepEqual([at("pronunciation")?.ref.line, at("pronunciation")?.wikitext], [12, "{{IPA|/rakkonˈtare/}} "]);
  assert.deepEqual([at("antonym")?.ref.line, at("antonym")?.wikitext], [24, "* [[tacere]], [[nascondere]], [[celare]]"]);
});

test("forms come only from a page that writes them out, with the gender and number its stamp states", () => {
  // raccontare's verb section writes `{{Pn|c}}` and no table: it has no forms, and no conjugation is made up.
  for (const title of ["raccontare", "fornire"]) {
    const [entry] = entriesOf(title);
    assert.deepEqual(factsOf(entry, "form"), [], title);
  }
  // `{{Pn}} ''f sing'' {{Linkp|mastoidi}}`.
  const [mastoide] = entriesOf("mastoide");
  assert.deepEqual(factsOf(mastoide, "gender"), [{ value: "feminine", sourceText: "f" }]);
  assert.deepEqual(factsOf(mastoide, "number"), [{ value: "singular", sourceText: "sing" }]);
  assert.deepEqual(factsOf(mastoide, "form"), [{ surface: "mastoidi", tags: ["plural"] }]);
  // Each section's own `{{Tabs|…}}`, and the lemma its definition names.
  const [adjective, noun] = entriesOf("avventurieri");
  for (const entry of [adjective, noun]) {
    assert.deepEqual(factsOf(entry, "form"), [
      { surface: "avventuriero", tags: ["masculine", "singular"] },
      { surface: "avventurieri", tags: ["masculine", "plural"] },
      { surface: "avventuriera", tags: ["feminine", "singular"] },
      { surface: "avventuriere", tags: ["feminine", "plural"] },
    ]);
    assert.deepEqual(factsOf(entry, "form-of"), [{ definition: 0, word: "avventuriero" }]);
    assert.deepEqual(factsOf(entry, "number"), [{ value: "plural", sourceText: "pl" }]);
  }
  assert.deepEqual(factsOf(adjective, "form").length, 4);
  // A table line belongs to its own section: the adjective's is line 3, the noun's line 8.
  assert.deepEqual([adjective, noun].map((entry) => entry.facts.find((fact) => fact.kind === "form")?.ref.line), [3, 8]);
  // `del verbo [[amare]]` names the verb `amano` is a form of.
  const [amano] = entriesOf("amano");
  assert.deepEqual(factsOf(amano, "form-of"), [{ definition: 0, word: "amare" }]);
});

test("hyphenation is never read, even from a page with a {{-sill-}} section", () => {
  const source = page("raccontare");
  const lines = source.wikitext.split("\n");
  const sill = lines.findIndex((line) => line.trim() === "{{-sill-}}") + 1;
  assert.equal(lines[sill], "; rac | con | tà | re");
  const [entry] = entriesOf("raccontare");
  assert.ok(entry.facts.every((fact) => fact.ref.line !== sill + 1), "no fact is read off the hyphenation line");
  assert.ok(entry.facts.every((fact) => !JSON.stringify(fact).includes("rac | con")));
});

test("a page that does not give a field gives no fact for it", () => {
  // fornire writes no `{{-prov-}}`; mastoide no pronunciation, synonym, antonym, derived word or expression.
  const [fornire] = entriesOf("fornire");
  assert.deepEqual(factsOf(fornire, "expression"), []);
  const [mastoide] = entriesOf("mastoide");
  assert.deepEqual([...new Set(mastoide.facts.map((fact) => fact.kind))], ["gender", "number", "form", "etymology"]);
  // A verb's `{{Pn|c}}` states no grammar.
  const [raccontare] = entriesOf("raccontare");
  assert.deepEqual([...factsOf(raccontare, "gender"), ...factsOf(raccontare, "number")], []);
});

/** A seed of the archive lines that name raccontare and fornire (racconto, fornito), with these pages as its raw pages. */
async function seeded(pages: readonly RawPage[], run: (db: DatabaseSync, reading: (word: string) => Promise<Reading[]>) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-page-facts-"));
  const db = new DatabaseSync(":memory:");
  try {
    const report = await seedSql({
      input: resolve("fixtures/page-entry-forms.jsonl"), outputDir: join(dir, "sql"),
      schema: resolve("src/db/schema.sql"), releaseId: "it-page-facts-test", rawPages: rawPageSource(pages),
    });
    for (const part of report.parts) db.exec(await readFile(part, "utf8"));
    const read = fromNodeSqlite(db);
    await run(db, async (word) => {
      const result = await lookup({ db: read, releaseId: "it-page-facts-test", query: word });
      assert.ok(result.outcome === "found", word);
      return result.readings;
    });
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test("the seed stores each fact with its rule, page line and that line verbatim, and a lookup reads them as the reading's own fields", async () => {
  await seeded(["raccontare", "fornire", "mastoide", "avventurieri"].map(page), async (db, readings) => {
    const rows = db.prepare(
      `SELECT e.word, f.kind, f.rule, f.page_line, f.wikitext, p.revision_id
         FROM entry_fact f JOIN recovered_entry e USING (entry_id) JOIN raw_page p USING (page_id)`,
    ).all() as { word: string; kind: string; rule: string; page_line: number; wikitext: string; revision_id: number }[];
    assert.ok(rows.length > 0);
    for (const row of rows) {
      const source = page(row.word);
      assert.equal(row.rule, PAGE_FACT_RULE);
      assert.equal(row.revision_id, source.revisionId);
      assert.equal(row.wikitext, source.wikitext.split("\n")[row.page_line - 1], `${row.word} ${row.kind}`);
    }
    assert.deepEqual([...new Set(rows.map((row) => row.kind))].sort(), ["antonym", "derived", "etymology", "expression", "form", "form-of", "gender", "number", "pronunciation", "synonym"]);

    const [raccontare] = await readings("raccontare");
    assert.ok(raccontare.entryId !== undefined);
    const { wordFacts } = raccontare;
    assert.deepEqual(wordFacts.pronunciations.map((sound) => [sound.ipa, sound.note]), [["/rakkonˈtare/", null]]);
    assert.deepEqual(wordFacts.hyphenations, []);
    assert.equal(wordFacts.etymologies.length, 1);
    assert.deepEqual(wordFacts.antonyms.map((word) => word.word), ["tacere", "nascondere", "celare"]);
    // A word the page lists twice is one word with both its places.
    assert.deepEqual(wordFacts.synonyms.find((word) => word.word === "riferire")?.refs.map((ref) => !isSourceRef(ref) && ref.line), [18, 21]);
    assert.deepEqual(wordFacts.expressions.map((row) => [row.phrase, row.meanings.length, row.hasEntry]), [
      ["raccontare per filo e per segno", 1, false],
      ["la sa raccontare bene", 1, false],
      ["ma a chi la racconti?", 1, false],
      ["non me la stare a raccontare/[ma] me la stai a raccontare?", 1, false],
    ]);
    assert.deepEqual(raccontare.forms, []);
    assert.deepEqual(raccontare.grammar.record, []);
    for (const ref of [...wordFacts.pronunciations.map((sound) => sound.ref), ...wordFacts.etymologies.map((text) => text.ref)]) {
      assert.ok(!isSourceRef(ref));
      assert.equal(ref.revisionId, page("raccontare").revisionId);
    }

    const [fornire] = await readings("fornire");
    assert.deepEqual(fornire.wordFacts.expressions, []);

    // A noun's stamp is its grammar, so its heading and articles read it, and `{{Linkp}}` is its plural.
    const [mastoide] = await readings("mastoide");
    assert.deepEqual(mastoide.grammar.record.map((claim) => claim.status === "stated" && [claim.dimension, claim.value]), [["gender", "feminine"], ["number", "singular"]]);
    assert.deepEqual(mastoide.forms.map((form) => [form.surface, form.claims.map((claim) => claim.status === "stated" && claim.value)]), [["mastoidi", ["plural"]]]);
    assert.ok(isNounReading(mastoide) && mastoide.articles.status === "derived");
    assert.deepEqual(mastoide.wordFacts.pronunciations, []);
    assert.deepEqual(mastoide.wordFacts.synonyms, []);

    // A form whose lemma no record or entry spells keeps its link, dangling, as an archive edge does.
    const avventurieri = await readings("avventurieri");
    assert.deepEqual(avventurieri.map((reading) => reading.lemmaLinks.map((link) => [link.kind, link.targetWord])), [
      [["dangling", "avventuriero"]],
      [["dangling", "avventuriero"]],
    ]);

    // The pages add no archive record: the two archive lines are all the seed holds.
    assert.deepEqual(db.prepare("SELECT DISTINCT word FROM source_record ORDER BY word").all().map((row) => row.word), ["fornito", "racconto"]);
  });
});

test("a lemma a definition names resolves to the archive record that spells it, as a form-of edge's does", async () => {
  // A page in the layout `avventurieri` writes, naming `racconto`, which an archive line of the seed heads.
  const racconti: RawPage = {
    wiki: "it.wiktionary.org", title: "racconti", revisionId: 1, timestamp: "2026-10-04T00:00:00Z",
    wikitext: "{{-sost form-|it}}\n{{Pn}} ''m pl''\n#plurale di [[racconto]]",
  };
  await seeded([racconti], async (_db, readings) => {
    const [reading] = await readings("racconti");
    const [link] = reading.lemmaLinks;
    assert.ok(link.kind === "candidates");
    assert.deepEqual(link.candidates.map((candidate) => [candidate.word, candidate.recordId !== undefined]), [["racconto", true]]);
    assert.ok(!isSourceRef(link.ref) && link.ref.line === 3);
  });
});
