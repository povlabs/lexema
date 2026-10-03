// Rule `it-plural-gloss-number/v1` (#483): the scan of "plurale di" records
// tagged singular, judged against pinned Wiktionary revisions. The scanned
// records and pages are src/italian/pluralGlossEvidence.ts, which
// `pnpm run measure:plural-gloss` writes from the archive; the lines checked
// against them here are verbatim archive lines from
// fixtures/curated-corrections.jsonl (test/correctionFixture.ts lists them).

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { HAND_CORRECTIONS, recordCorrections } from "../src/italian/curatedCorrections.js";
import { PLURAL_GLOSS_EVIDENCE } from "../src/italian/pluralGlossEvidence.js";
import { judgeAll, PLURAL_GLOSS_NUMBER_RULE, scanRecord, type Verdict } from "../src/italian/pluralGlossNumber.js";
import { enBlocks, enExcerpt, isPinned, itExcerpt, tabsPlaces, templatesOn } from "../src/italian/wiktionaryEvidence.js";
import { correctionFixtureLines } from "./correctionFixture.js";

const HAND = recordCorrections(HAND_CORRECTIONS);
const VERDICTS = judgeAll(PLURAL_GLOSS_EVIDENCE, HAND);
const sha256 = (line: string): string => createHash("sha256").update(line, "utf8").digest("hex");
const verdictOf = (word: string, pos: "noun" | "adj"): Verdict => {
  const found = VERDICTS.filter((verdict) => verdict.record.word === word && verdict.record.pos === pos);
  assert.equal(found.length, 1, `${word} [${pos}]`);
  return found[0];
};
const outcome = (verdict: Verdict): string =>
  verdict.kind === "excluded" ? verdict.reason : verdict.kind === "plural" ? (verdict.genderCorrected ? "plural and gender" : "plural") : "singular";

test("the pinned scan holds each fixture line's record exactly as the line states it, and only the lines the scan takes", async () => {
  const records = new Map(PLURAL_GLOSS_EVIDENCE.records.map((record) => [record.lineSha256, record]));
  let scanned = 0;
  for (const line of await correctionFixtureLines()) {
    const pinned = records.get(sha256(line));
    if (pinned === undefined) {
      assert.equal(scanRecord(line, 0, sha256(line)), undefined, line.slice(0, 60));
      continue;
    }
    assert.deepEqual(scanRecord(line, pinned.lineNo, pinned.lineSha256), pinned);
    scanned++;
  }
  // #420's five declaring records, #449's eight plurals, and the rule's five.
  assert.equal(scanned, 18);
});

test("every scanned record of it-0c432803 falls in one class, and the counts are the report's", () => {
  assert.equal(PLURAL_GLOSS_EVIDENCE.releaseId, "it-0c432803");
  assert.equal(PLURAL_GLOSS_EVIDENCE.records.length, 292);
  const counts: Record<string, number> = {};
  for (const verdict of VERDICTS) counts[`${outcome(verdict)} ${verdict.record.pos}`] = (counts[`${outcome(verdict)} ${verdict.record.pos}`] ?? 0) + 1;
  assert.deepEqual(counts, {
    "plural noun": 43,
    "plural adj": 74,
    "plural and gender noun": 8,
    "plural and gender adj": 16,
    "singular noun": 15,
    "already-corrected noun": 13,
    "not-italian noun": 5,
    "not-italian adj": 3,
    "singular-adjective adj": 37,
    "other-lemma noun": 8,
    "other-lemma adj": 17,
    "no-section-for-pos noun": 16,
    "no-section-for-pos adj": 23,
    "no-en-page noun": 6,
    "no-en-page adj": 4,
    "no-italian-entry noun": 1,
    "no-italian-entry adj": 1,
    "no-plural-statement adj": 2,
  });
});

test("the same release and the same pinned revisions give the same corrections", () => {
  const copy = JSON.parse(JSON.stringify(PLURAL_GLOSS_EVIDENCE)) as typeof PLURAL_GLOSS_EVIDENCE;
  assert.deepEqual(judgeAll(copy, HAND), VERDICTS);
});

test("each real plural cites the one en.wiktionary revision pinned for its word, and is set plural over its `singular` tag", () => {
  const pages = new Map(PLURAL_GLOSS_EVIDENCE.pages.map((page) => [`${page.wiki}:${page.title}`, page]));
  const plurals = VERDICTS.flatMap((verdict) => (verdict.kind === "plural" ? [verdict] : []));
  assert.equal(plurals.length, 141);
  for (const { record, correction, genderCorrected } of plurals) {
    assert.equal(correction.rule, PLURAL_GLOSS_NUMBER_RULE);
    const [evidence] = correction.evidence;
    const page = pages.get(`en.wiktionary.org:${record.word}`);
    assert.ok(isPinned(page), record.word);
    assert.deepEqual([evidence.wiki, evidence.title, evidence.revisionId], ["en.wiktionary.org", record.word, page.revisionId]);
    // What it shows is the page's own lines, verbatim.
    for (const shown of evidence.shows.split("; ")) assert.ok(page.lines.some((line) => shown.endsWith(line)), `${record.word}: ${shown}`);
    assert.deepEqual(correction.facts.number, { overrides: { pointer: `/tags/${record.tags.indexOf("singular")}`, text: "singular" }, value: "plural" });
    const { gender } = correction.facts;
    assert.equal(gender !== undefined, genderCorrected, record.word);
    if (gender !== undefined) {
      // The same revision states the gender, and the record's one gender tag says the other.
      assert.match(evidence.shows, gender.value === "masculine" ? /g=m\b|\|m\|p\b|masculine plural of/ : /g=f\b|\|f\|p\b|feminine plural of/, record.word);
      assert.equal(record.tags.filter((tag) => tag === "masculine" || tag === "feminine").length, 1, record.word);
      assert.notEqual(gender.overrides.text, gender.value);
    }
  }
  assert.equal(outcome(verdictOf("agostiniani", "noun")), "plural and gender");
  assert.equal(outcome(verdictOf("curve", "adj")), "plural and gender");
  assert.equal(outcome(verdictOf("guerriglieri", "noun")), "plural");
  assert.equal(outcome(verdictOf("competitive", "adj")), "plural");
  // `fallibili` is tagged both genders, and `{{plural of}}` states none: its number alone.
  assert.equal(outcome(verdictOf("fallibili", "adj")), "plural");
});

test("the fifteen singular nouns glossed \"plurale di\" are set singular over their gloss, each citing the revision that names it a singular", () => {
  const singulars = VERDICTS.flatMap((verdict) => (verdict.kind === "singular" ? [verdict] : []));
  assert.deepEqual(singulars.map((verdict) => verdict.record.word).sort(), [
    "bucaniera", "cantiniera", "condensa", "giornalaia", "giostraia", "mima", "misantropa", "nevrotica",
    "sbruffona", "sicaria", "smacchiatrice", "sociologa", "superstiziosa", "tuttologa", "virtuosa",
  ]);
  for (const { record, correction } of singulars) {
    assert.deepEqual(correction.facts, { number: { overrides: { pointer: "/senses/0/glosses/0", text: record.firstGloss }, value: "singular" } });
    for (const evidence of correction.evidence) assert.ok(evidence.revisionId > 0, record.word);
  }
  const shown = (word: string): string[] => {
    const verdict = verdictOf(word, "noun");
    return verdict.kind === "singular" ? verdict.correction.evidence.map((evidence) => `${evidence.wiki} ${evidence.title}: ${evidence.shows}`) : [];
  };
  assert.deepEqual(shown("mima"), ["it.wiktionary.org mimo: {{-sost-|it}} {{Tabs|mimo|mimi|mima|mime}}"]);
  assert.deepEqual(shown("cantiniera"), ["en.wiktionary.org cantiniere: ===Noun=== {{it-noun|m|f=cantiniera}}"]);
  // bucaniere's noun table puts bucaniera in the femminile singolare; its adjective table, garbled, does not decide.
  assert.deepEqual(shown("bucaniera"), ["it.wiktionary.org bucaniere: {{-sost-|it}} {{Tabs|bucaniere|bucanieri|bucaniera|bucaniere}}"]);
  // nevrotico has no noun table, so its adjective table speaks.
  assert.deepEqual(shown("nevrotica"), [
    "en.wiktionary.org nevrotica: ===Adjective=== {{head|it|adjective form}} # {{feminine singular of|it|nevrotico}}",
    "it.wiktionary.org nevrotico: {{-agg-|it}} {{Tabs|nevrotico|nevrotici|nevrotica|nevrotiche}}",
  ]);
});

test("the rule leaves alone what a hand entry corrects, other languages' records, and what en.wiktionary does not confirm", () => {
  const excluded = (reason: string): string[] =>
    VERDICTS.flatMap((verdict) => (verdict.kind === "excluded" && verdict.reason === reason ? [verdict.record.word] : [])).sort();
  // #420's five declaring records and #449's eight plurals.
  assert.deepEqual(excluded("already-corrected"), [
    "ammaliatrice", "anfitrioni", "congiuntivi", "costruttrici", "curde", "maniaci", "mosse", "portatrici", "ricoverati", "romantica", "scolare", "scontente", "sudafricana",
  ]);
  assert.deepEqual(excluded("not-italian"), ["abonados", "agreements", "aiuti", "ajustées", "ajustés", "constantes", "magnets", "munceca"]);
  // "plurale di analogica", but en.wiktionary makes it a plural of analogico.
  assert.equal(outcome(verdictOf("analogiche", "adj")), "other-lemma");
  // A noun record whose page files the plural under Adjective only.
  assert.equal(outcome(verdictOf("virtuosi", "noun")), "no-section-for-pos");
  assert.equal(outcome(verdictOf("marmocchie", "noun")), "no-en-page");
  assert.equal(outcome(verdictOf("rosa", "adj")), "singular-adjective");
});

test("a page is read through its templates, and only its Italian section counts", () => {
  assert.deepEqual(
    templatesOn("# {{tlb|it|literary}} {{adj form of|it|domo||m|p|t=tamed}}").map(({ name, positional, named }) => [name, positional, named]),
    [["tlb", ["it", "literary"], {}], ["adj form of", ["it", "domo", "", "m", "p"], { t: "tamed" }]],
  );
  // A nested call or a link keeps its own pipes.
  assert.deepEqual(templatesOn("# {{only used in|it||[[età]] '''scolare'''|[[school-age|age]]}}")[0].positional, ["it", "", "[[età]] '''scolare'''", "[[school-age|age]]"]);
  const page = ["==Italian==", "{{it-pr|cùrde}}", "===Noun===", "{{head|it|noun form|g=f}}", "# {{plural of|it|curda}}", "#* a quotation", "", "==Latin==", "===Noun===", "# {{plural of|la|x}}"].join("\n");
  assert.deepEqual(enExcerpt(page), ["===Noun===", "{{head|it|noun form|g=f}}", "# {{plural of|it|curda}}"]);
  assert.deepEqual(enBlocks(enExcerpt(page)).map(({ heading, head, definitions }) => [heading, head, definitions]), [["Noun", "{{head|it|noun form|g=f}}", ["# {{plural of|it|curda}}"]]]);
  assert.deepEqual(enExcerpt("==Spanish==\n===Noun===\n# x"), []);
  const it = itExcerpt(["== {{-it-}} ==", "{{-agg-|it}}", "{{Tabs|curdo|curdi|curda|curde}}", "# che è curdo", "== {{-la-}} ==", "{{-sost-|la}}", "{{Tabs|a|b|curde|d}}"].join("\n"));
  assert.deepEqual(it, ["{{-agg-|it}}", "{{Tabs|curdo|curdi|curda|curde}}"]);
  assert.deepEqual(tabsPlaces(it, "curde"), [{ number: "plural", gender: "feminine", pos: "agg", shows: "{{-agg-|it}} {{Tabs|curdo|curdi|curda|curde}}" }]);
});
