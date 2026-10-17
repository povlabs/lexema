// The committed snapshot of Wikidata words (ADR 0033, #812):
// `wikidata-words/wikidata-words.jsonl`, one lexeme per line in lexeme order,
// taken from the pinned lexeme dump (lexemeDump.ts) by
// `pnpm run wikidata-words:snapshot`. It holds every Italian lexeme the dump
// spells one of the asked words with, lemma or form, and `pnpm run
// load:wikidata-words` writes the dictionary from it, so a refresh is a pull
// request whose diff is the lexemes that changed.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeItalianExact } from "../italian/normalize.js";
import { keysOfWord, lexemeNumber, wikidataWord, type WikidataWord, type WikidataWordSpec } from "./wikidataWord.js";

/** Where the snapshot is committed, from the repository root. */
export const WORD_SNAPSHOT_PATH = "wikidata-words/wikidata-words.jsonl";

/** The words a snapshot is taken for, one per line, from the repository root. */
export const ASKED_WORDS_PATH = "wikidata-words/words.txt";

/** `words` as the snapshot holds them: each lexeme once, in lexeme order. */
export function snapshotOf(words: readonly WikidataWord[]): WikidataWord[] {
  const kept = new Map<string, WikidataWord>();
  for (const word of words) kept.set(word.lexeme, word);
  return [...kept.values()].sort((a, b) => lexemeNumber(a.lexeme) - lexemeNumber(b.lexeme));
}

/** The snapshot's text: one JSON object per line, keys in a fixed order, ending in a newline. */
export function snapshotText(words: readonly WikidataWord[]): string {
  return snapshotOf(words)
    .map(({ lexeme, lemma, category, genders, forms, glosses }) => `${JSON.stringify({ lexeme, lemma, category, genders, forms, glosses })}\n`)
    .join("");
}

/** The words of a snapshot's text, refused unless it is exactly what `snapshotText` writes for them. */
export function parseSnapshot(text: string): WikidataWord[] {
  const words = text
    .split("\n")
    .filter((line, index, lines) => line !== "" || index !== lines.length - 1)
    .map((line, index) => {
      try {
        return wikidataWord(JSON.parse(line) as WikidataWordSpec);
      } catch (error) {
        throw new Error(`${WORD_SNAPSHOT_PATH} line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  if (snapshotText(words) !== text) throw new Error(`${WORD_SNAPSHOT_PATH} is not in lexeme order, holds a lexeme twice, or is not written as wikidata-words:snapshot writes it`);
  return words;
}

/** The committed snapshot's words, read from `root`. */
export async function readWordSnapshot(root: string = process.cwd()): Promise<WikidataWord[]> {
  return parseSnapshot(await readFile(resolve(root, WORD_SNAPSHOT_PATH), "utf8"));
}

/** The search keys of the words a file asks for, one word per line; a blank line asks nothing. */
export const askedKeysOf = (text: string): Set<string> =>
  new Set(text.split("\n").flatMap((line) => (line.trim() === "" ? [] : [normalizeItalianExact(line)])));

/** Whether a word is one the snapshot takes: one of its spellings is asked. */
export const isAsked = (word: WikidataWord, asked: ReadonlySet<string>): boolean => keysOfWord(word).some((key) => asked.has(key));
