// A Verbo section split into verb-type parts (#775): Wiktextract makes one
// record of each part, so a line the page gives in one part is recovered only
// for the record of that part. The pages are verbatim revisions of
// itwiktionary-20260701 and the records verbatim archive lines of it-0c432803:
// `urgere` (fixtures/unlisted-definitions/, archive lines 43705 and 43706),
// `servire` (fixtures/verb-parts/, lines 49989 and 49990) and `transigere`
// (lines 463730 and 463731).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { ONLY_RECORD, recordText, recoverDefinitions, SectionRecords, type RecordRecovery, type Siblings } from "../src/italian/recovery.js";
import { verbTypeOpenedBy, verbTypesTagged } from "../src/italian/verbType.js";
import { readItalianSections, verbTypeAt } from "../src/italian/wikitext.js";
import { RAW_PAGE_WIKI, readSavedPage, type RawPage } from "../src/source/rawPage.js";

type ArchiveLine = Parameters<typeof recordText>[0];

const savedPage = (dir: string, title: string): RawPage => readSavedPage(readFileSync(resolve(dir, `${title}.wikitext`), "utf8"), `${title}.wikitext`);
const archiveLines = (dir: string): ArchiveLine[] =>
  readFileSync(resolve(dir, "archive-lines.jsonl"), "utf8").trimEnd().split("\n").map((line) => JSON.parse(line) as ArchiveLine);

const PAGES = new Map([
  ["urgere", savedPage("fixtures/unlisted-definitions", "urgere")],
  ["servire", savedPage("fixtures/verb-parts", "servire")],
  ["transigere", savedPage("fixtures/verb-parts", "transigere")],
]);
/** Each fixture record at its archive line. */
const RECORDS = new Map<number, ArchiveLine>();
const [urgereIntransitive, urgereTransitive] = archiveLines("fixtures/unlisted-definitions").filter((record) => record.word === "urgere");
RECORDS.set(43705, urgereIntransitive);
RECORDS.set(43706, urgereTransitive);
const [servireIntransitive, servireTransitive, transigereTransitive, transigereIntransitive] = archiveLines("fixtures/verb-parts");
RECORDS.set(49989, servireIntransitive);
RECORDS.set(49990, servireTransitive);
RECORDS.set(463730, transigereTransitive);
RECORDS.set(463731, transigereIntransitive);

const sections = new SectionRecords();
for (const [lineNo, record] of RECORDS) sections.add(lineNo, record);

function matched(recovery: RecordRecovery): Extract<RecordRecovery, { outcome: "matched" }> {
  assert.equal(recovery.outcome, "matched");
  return recovery as Extract<RecordRecovery, { outcome: "matched" }>;
}

/** The recovery of the archive record at `lineNo`, beside its siblings. */
function recovered(lineNo: number): Extract<RecordRecovery, { outcome: "matched" }> {
  const record = RECORDS.get(lineNo) ?? assert.fail(`no fixture record at line ${lineNo}`);
  const page = PAGES.get(record.word) ?? assert.fail(`no page for ${record.word}`);
  return matched(recoverDefinitions(recordText(record, sections.siblingsOf(lineNo, record)), page));
}

const lines = (recovery: Extract<RecordRecovery, { outcome: "matched" }>) =>
  recovery.recovered.map((definition) => [definition.route, definition.ref.line, definition.text, definition.labels]);

test("the archive lines are the records of the parts: each tagged with its part's type", () => {
  assert.deepEqual(
    [...RECORDS].map(([lineNo, record]) => [lineNo, record.word, verbTypesTagged(record.tags)]),
    [
      [43705, "urgere", ["intransitivo"]],
      [43706, "urgere", ["transitivo"]],
      [49989, "servire", ["intransitivo"]],
      [49990, "servire", ["transitivo"]],
      [463730, "transigere", ["transitivo"]],
      [463731, "transigere", ["intransitivo"]],
    ],
  );
  assert.deepEqual(sections.siblingsOf(43705, urgereIntransitive), [["transitivo"]]);
  assert.deepEqual(verbTypesTagged(["reflexive", "pronominal"]), ["riflessivo"]);
  assert.deepEqual(verbTypesTagged(["reciprocal"]), ["reciproco"]);
  assert.deepEqual(verbTypesTagged(undefined), []);
});

test("a verb-type template opens a part alone on its line or leading it; a list line opens none", () => {
  assert.equal(verbTypeOpenedBy("{{Transitivo|it}}"), "transitivo");
  assert.equal(verbTypeOpenedBy("{{Intransitivo|it}} occorrere nell'immediato, necessario al più presto. "), "intransitivo");
  assert.equal(verbTypeOpenedBy("{{riflessivo|it}}"), "riflessivo");
  assert.equal(verbTypeOpenedBy("{{Reciproco|it}}"), "reciproco");
  assert.equal(verbTypeOpenedBy("# {{Transitivo|it}} fare"), undefined);
  assert.equal(verbTypeOpenedBy("{{Intransitivo pronominale|it}}"), undefined);
  assert.equal(verbTypeOpenedBy("{{Pn|c}}"), undefined);

  const [urgere] = readItalianSections(PAGES.get("urgere") ?? assert.fail());
  assert.deepEqual(urgere.verbParts.map((part) => [part.verbType, part.ref.line]), [["intransitivo", 3], ["transitivo", 7]]);
  assert.deepEqual([2, 3, 5, 6, 7, 9].map((line) => verbTypeAt(urgere, line)), [null, "intransitivo", "intransitivo", "intransitivo", "transitivo", "transitivo"]);
});

test("urgere: line 3 sits in the intransitive part and is recovered for archive line 43705 only", () => {
  assert.deepEqual(lines(recovered(43705)), [["prose-line", 3, "occorrere nell'immediato, necessario al più presto.", ["intransitivo"]]]);
  const transitive = recovered(43706);
  assert.deepEqual(lines(transitive), []);
  assert.equal(transitive.loss, "none");
  assert.deepEqual(transitive.otherParts.map((definition) => [definition.route, definition.ref.line]), [["prose-line", 3]]);
});

test("servire: the sub-term below a `#` line of the transitive part is recovered for archive line 49990 only", () => {
  const text = "servire lo Stato (al servizio dello Stato e dei cittadini): attinenze di diritto e legge, [possibilmente] al di là degli interessi privati quindi con abnegazione al dovere";
  assert.deepEqual(lines(recovered(49990)), [["sub-term", 20, text, []]]);
  const intransitive = recovered(49989);
  assert.deepEqual(lines(intransitive), []);
  assert.deepEqual(intransitive.otherParts.map((definition) => [definition.route, definition.ref.line]), [["sub-term", 20]]);
});

test("transigere: the sub-term below a `#` line of the intransitive part is recovered for archive line 463731 only", () => {
  const text = "non transigere: essere inflessibile nel proposito o nell'esatta osservanza di una cosa, senza indulgere concessioni";
  assert.deepEqual(lines(recovered(463731)), [["sub-term", 10, text, []]]);
  const transitive = recovered(463730);
  assert.deepEqual(lines(transitive), []);
  assert.deepEqual(transitive.otherParts.map((definition) => [definition.route, definition.ref.line]), [["sub-term", 10]]);
});

/** `urgere`'s page with its parts' templates replaced, under a made-up revision. */
const urgereWith = (intransitive: string, transitive: string): RawPage => {
  const page = PAGES.get("urgere") ?? assert.fail();
  const wikitext = page.wikitext.replace("{{Intransitivo|it}} occorrere", `${intransitive} occorrere`).replace("\n{{Transitivo|it}}\n", `\n${transitive}\n`);
  assert.notEqual(wikitext, page.wikitext);
  return { wiki: RAW_PAGE_WIKI, title: "urgere", revisionId: 1, timestamp: "2026-07-01T00:00:00Z", wikitext };
};

const recoveredFor = (page: RawPage, record: ArchiveLine, siblings: Siblings): number[] =>
  matched(recoverDefinitions(recordText(record, siblings), page)).recovered.map((definition) => definition.ref.line);

test("a line is recovered for every record of its section, as before #775, when no record says which part it was read from", () => {
  const page = PAGES.get("urgere") ?? assert.fail();
  // In a section with one record: the transitive record alone takes the intransitive part's line.
  assert.deepEqual(recoveredFor(page, urgereTransitive, ONLY_RECORD), [3]);
  // In a part no record's tags name: two parts, neither of them riflessivo, so both records take the riflessivo line.
  const riflessivo = urgereWith("{{Riflessivo|it}}", "{{Transitivo|it}}");
  assert.deepEqual(recoveredFor(riflessivo, urgereTransitive, [["intransitivo"]]), [3]);
  assert.deepEqual(recoveredFor(riflessivo, urgereIntransitive, [["transitivo"]]), [3]);
  // Outside any part: a line above the first template is every record's.
  const outside = urgereWith("", "{{Intransitivo|it}}");
  assert.deepEqual(readItalianSections(outside)[0].verbParts.map((part) => [part.verbType, part.ref.line]), [["intransitivo", 7]]);
  assert.deepEqual(recoveredFor(outside, urgereTransitive, [["intransitivo"]]), [3]);
  assert.deepEqual(recoveredFor(outside, urgereIntransitive, [["transitivo"]]), [3]);
  // A record whose tags name no verb type takes no line of a part a sibling names.
  assert.deepEqual(recoveredFor(page, { ...urgereTransitive, tags: [] }, [["intransitivo"]]), []);
  // A record of both types takes the line of either part.
  assert.deepEqual(recoveredFor(page, { ...urgereTransitive, tags: ["transitive", "intransitive"] }, [["intransitivo"]]), [3]);
});
