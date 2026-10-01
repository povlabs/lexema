// The grid's article lines take the record's own IPA for the headword's
// spelling and for no other (#341).

import assert from "node:assert/strict";
import test from "node:test";
import { agreementOf } from "@/lib/dictionary/genderGrid.ts";
import type { GrammarClaim, Reading, SourceForm, SourceRef } from "@lexema/lookup/types.ts";

const ref = (jsonPointer: string): SourceRef => ({ releaseId: "it-test", lineNo: 1, jsonPointer, lineSha256: "0".repeat(64) });

const stated = (dimension: string, value: string): GrammarClaim => ({
  status: "stated",
  dimension,
  value,
  sourceText: value,
  ref: ref("/tags/0"),
});

/** A noun reading with only what the grid reads: its word, grammar, forms and IPA. */
function noun(word: string, ipas: string[], forms: SourceForm[] = []): Reading {
  return {
    pos: "noun",
    word,
    grammar: { record: [stated("gender", "masculine"), stated("number", "singular")] },
    forms,
    lemmaLinks: [],
    wordFacts: { pronunciations: ipas.map((ipa, i) => ({ ipa, note: null, ref: ref(`/sounds/${i}/ipa`) })) },
  } as unknown as Reading;
}

const lines = (reading: Reading): string[][] =>
  agreementOf(reading).grid?.rows.flatMap((row) => row.cells.flatMap((cell) => cell.spellings.map((spelling) => spelling.articles))) ?? [];

test("the headword's article line reads the record's IPA where the spelling leaves the sound open", () => {
  assert.deepEqual(lines(noun("hotel", ["/oˈtɛl/"])), [["l'hotel", "un hotel"]]);
  assert.deepEqual(lines(noun("chef", ["/ʃɛf/"])), [["lo chef", "uno chef"]]);
  assert.deepEqual(lines(noun("hotel", [])), [[]]);
});

test("a form's spelling does not take the headword's IPA", () => {
  const hotels: SourceForm = {
    index: 0,
    surface: "hotels",
    ref: ref("/forms/0/form"),
    formSource: null,
    claims: [stated("gender", "masculine"), stated("number", "plural")],
  };
  assert.deepEqual(lines(noun("hotel", ["/oˈtɛl/"], [hotels])), [["l'hotel", "un hotel"], []]);
});
