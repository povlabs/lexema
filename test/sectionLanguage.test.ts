// The rule that finds another language's entry under a page's Italian heading
// (#29). The regression pages are saved verbatim from the dump the archive was
// built from, beside the archive records of their titles, so no case needs the
// dump or `it-extract.jsonl.gz`.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { alignRecords, blockLanguage, LanguageHeadings, readItalianPosBlocks } from "../src/italian/sectionLanguage.js";
import { RAW_PAGE_WIKI, type RawPage } from "../src/source/rawPage.js";

interface Case {
  word: string;
  page: { title: string; revisionId: number; timestamp: string; wikitext: string };
  records: { line: number; pos_title: string; expected: { language: "it" } | { language: "other"; code: string; because: string } }[];
}

const fixture = JSON.parse(readFileSync(resolve("fixtures/section-language/regressions.json"), "utf8")) as {
  languageHeadings: string[];
  cases: Case[];
};
const languages = LanguageHeadings.fromList(fixture.languageHeadings);

const rawPage = (title: string, wikitext: string, revisionId = 1): RawPage =>
  ({ wiki: RAW_PAGE_WIKI, title, revisionId, timestamp: "2026-07-01T00:00:00Z", wikitext });

/** Each archive record's verdict, in archive order, with only the fields a case states. */
function verdicts(page: RawPage, posTitles: readonly string[]) {
  const blocks = alignRecords(readItalianPosBlocks(page, languages), posTitles);
  assert.ok(blocks, `${page.title}: the page's blocks do not line up with its records`);
  return blocks.map((block) => {
    const verdict = blockLanguage(block);
    return verdict.language === "it" ? verdict : { language: verdict.language, code: verdict.code, because: verdict.because };
  });
}

for (const regression of fixture.cases) {
  test(`${regression.word}: each archive record gets the language its page block is in`, () => {
    const { title, revisionId, wikitext } = regression.page;
    assert.deepEqual(
      verdicts(rawPage(title, wikitext, revisionId), regression.records.map((record) => record.pos_title)),
      regression.records.map((record) => record.expected),
    );
  });
}

test("a section template on its own line is not a language line", () => {
  const page = rawPage("prova", "== {{-it-}} ==\n{{-sost-|it}}\n# prova\n\n{{-trad-}}\n{{-pron-}}\n{{-sost-}}\n# altra prova");
  assert.deepEqual(verdicts(page, ["Sostantivo", "Sostantivo"]), [{ language: "it" }, { language: "it" }]);
});

test("a heading's named argument is not the language it names", () => {
  const page = rawPage("Helena", "== {{-it-}} ==\n{{-trad-}}\n{{-nome-|it=Helena (Montana)}}\n# capitale del Montana");
  assert.deepEqual(verdicts(page, ["Nome proprio"]), [{ language: "it" }]);
});

test("any level-2 heading ends the Italian section, a plain one included", () => {
  const page = rawPage("puri", "== {{-it-}} ==\n{{-agg form-|it}}\n# plurale di puro\n==Finnish==\n{{-sost-|en}}\n# puri");
  assert.equal(readItalianPosBlocks(page, languages).length, 1);
});

test("records that do not line up with the page's blocks are not matched to any", () => {
  const blocks = readItalianPosBlocks(rawPage("x", "== {{-it-}} ==\n{{-sost-|it}}\n# x"), languages);
  assert.equal(alignRecords(blocks, ["Sostantivo", "Sostantivo"]), null);
  assert.equal(alignRecords(blocks, ["Aggettivo"]), null);
});
