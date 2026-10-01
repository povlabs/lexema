// Which entries of a synonym, antonym or derived-word list are words, and
// which are pieces of a note the source split on its commas (#120). The lists
// are shaped like the release's own: `casa`, `sperimentazione`, `biscotto`,
// and a plain one.

import assert from "node:assert/strict";
import test from "node:test";
import type { RelatedWord } from "@lexema/lookup/types.ts";
import { noteRuns, relatedItems } from "../lib/dictionary/relatedList.ts";

/** A record's list as the lookup returns it: one entry per spelling, each pointing where it sits. */
function list(pieces: readonly string[], lineNo = 1, key = "synonyms"): RelatedWord[] {
  const byWord = new Map<string, RelatedWord>();
  pieces.forEach((word, i) => {
    const ref = { releaseId: "it-test", lineNo, jsonPointer: `/${key}/${i}/word`, lineSha256: "0" };
    const existing = byWord.get(word);
    if (existing) existing.refs.push(ref);
    else byWord.set(word, { word, refs: [ref] });
  });
  return [...byWord.values()];
}

test("a bracket opened and closed across pieces is one note; one never closed or never opened stands alone", () => {
  assert.deepEqual(noteRuns(["(di farmaco", "tecnica)", "esperienza"]), [[0, 2]]);
  assert.deepEqual(noteRuns(["edificio", "(per es. palazzo", "scuola", "(per es. rurale", "civile", "industriale)", "dimora"]), [
    [1, 2],
    [3, 6],
  ]);
  assert.deepEqual(noteRuns(["pan biscotto", ") terracotta non smaltata", "biscuit"]), [[1, 2]]);
  assert.deepEqual(noteRuns(["costruzione", "casa (in senso lato)", "stabile"]), []);
});

test("sperimentazione: the note shows once, in place of its pieces, and the words stay searches", () => {
  assert.deepEqual(relatedItems(list(["(di farmaco", "tecnica)", "esperienza", "verifica"])), [
    { kind: "note", text: "(di farmaco, tecnica)" },
    { kind: "word", word: "esperienza" },
    { kind: "word", word: "verifica" },
  ]);
});

test("biscotto: a note three records repeat shows once", () => {
  const pieces = ["pasticcino", ") terracotta non smaltata", "biscuit"];
  const merged = new Map<string, RelatedWord>();
  for (const word of [1, 2, 3].flatMap((line) => list(pieces, line))) {
    const existing = merged.get(word.word);
    if (existing) existing.refs.push(...word.refs);
    else merged.set(word.word, { word: word.word, refs: [...word.refs] });
  }
  assert.deepEqual(relatedItems([...merged.values()]), [
    { kind: "word", word: "pasticcino" },
    { kind: "note", text: ") terracotta non smaltata" },
    { kind: "word", word: "biscuit" },
  ]);
});

test("a spelling that is a note's piece in one place and a word in another stays a word", () => {
  assert.deepEqual(relatedItems(list(["civile", "(rurale", "civile", "industriale)"])), [
    { kind: "word", word: "civile" },
    { kind: "note", text: "(rurale, civile, industriale)" },
  ]);
});

test("a note shows where its first piece is, not where a word it holds is listed on its own earlier", () => {
  assert.deepEqual(relatedItems(list(["civile", "x", "(rurale", "civile", "industriale)"])), [
    { kind: "word", word: "civile" },
    { kind: "word", word: "x" },
    { kind: "note", text: "(rurale, civile, industriale)" },
  ]);
});

test("an ordinary list is unchanged: every entry a word, in order", () => {
  const words = ["andare", "recarsi", "muoversi (di luogo)"];
  assert.deepEqual(
    relatedItems(list(words, 1, "derived")),
    words.map((word) => ({ kind: "word", word })),
  );
});
