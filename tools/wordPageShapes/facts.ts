// What a word page shows, reduced to the facts its shape is read from (#707).
// One `PageFacts` per searched headword: which kind of page the search opens,
// and for each reading the page lists, its kind, part of speech, the word it is
// about and what it shows. The page is built by the web's own `wordPage()` and
// `phrasePage()`, so these are the facts of the page a reader gets.

import type { PhrasePage } from "../../web/lib/dictionary/phrasePage.ts";
import { baseWordOf, showsJumpLinks, type ShownEntry, type WordPage } from "../../web/lib/dictionary/wordPage.ts";

/** One reading or block a word page lists, as its shape reads it. */
export interface EntryFacts {
  /**
   * `own`: a reading of a record that is not the query's form; `form-of`: the
   * query's own form record, as a noun or adjective form block reads it;
   * `verb-form` and `grid-form`: the blocks built for a verb's or a grid's
   * form; `bare` and `lone-bare`: readings with nothing to show (§ 1).
   */
  kind: "own" | "form-of" | "verb-form" | "grid-form" | "bare" | "lone-bare";
  /** The heading's part of speech: the record's `pos_title`, or a block's. */
  pos: string;
  /** The headword of the record the entry reads; a block's first record. */
  word: string;
  /** The word the entry is about (`baseWordOf`): its own headword, or the word it is a form of. */
  about: string;
  /** Every other word whose table or `Form of` line the entry shows: a form of two base words names both. */
  bases: string[];
  /** The kinds of the parts it shows, in page order; none for a block or a bare reading. */
  parts: string[];
}

/** A search's page, as its shape reads it. */
export type PageFacts =
  | { word: string; page: "word"; entries: EntryFacts[]; links: boolean }
  | { word: string; page: "phrase"; entries: { kind: "form" | "own"; pos: string }[]; unnamed: number }
  | { word: string; page: "none"; outcome: string };

function entryFacts(entry: ShownEntry): EntryFacts {
  const about = baseWordOf(entry);
  switch (entry.kind) {
    case "verb-form":
      return { kind: "verb-form", pos: entry.posTitle, word: entry.sources[0]?.reading.word ?? entry.verb, about, bases: [], parts: [] };
    case "grid-form":
      return { kind: "grid-form", pos: entry.posTitle, word: entry.records[0].word, about, bases: [], parts: [] };
    case "bare":
    case "lone-bare":
      return { kind: entry.kind, pos: entry.reading.posTitle, word: entry.reading.word, about, bases: [], parts: [] };
    case "source": {
      const named = new Set<string>();
      for (const part of entry.parts) {
        if (part.kind === "lemma-lines") for (const word of part.words) named.add(word);
        if (part.kind === "lemma-forms") for (const table of part.tables) named.add(table.lemma.word);
      }
      named.delete(about);
      return {
        kind: entry.role === "form-of" ? "form-of" : "own",
        pos: entry.reading.posTitle,
        word: entry.reading.word,
        about,
        bases: [...named].sort(),
        parts: entry.parts.map((part) => part.kind),
      };
    }
  }
}

export const wordPageFacts = (word: string, page: WordPage): PageFacts => ({
  word,
  page: "word",
  entries: page.readings.map(entryFacts),
  links: showsJumpLinks(page),
});

export const phrasePageFacts = (word: string, page: PhrasePage): PageFacts => ({
  word,
  page: "phrase",
  entries: page.readings.map((reading) => ({ kind: reading.text.kind, pos: reading.reading.posTitle })),
  unnamed: page.unnamed.length,
});
