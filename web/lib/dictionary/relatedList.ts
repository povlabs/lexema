// What a synonym, antonym or derived-word list shows: its words, and the notes
// the source wrote inside it.
//
// Wiktextract splits Wiktionary's list line on commas, so a parenthetical note
// that holds commas lands in the list in pieces: `casa` lists
// `(per es. rurale`, `civile`, `industriale)` as three words, and `biscotto`
// lists `) terracotta non smaltata` as one (#120). A piece is found by its
// structure — its parentheses do not balance — never by what it says. The
// source record is not touched: the pieces are read back in the order the
// record lists them and shown as the one note they were, read-only.
//
// A word is a search only when it has an entry (#635; Huey's ruling of
// 2026-10-21, https://github.com/povlabs/lexema/issues/635#issuecomment-6319781263):
// one without stays in its place as text, so no link leads to "no entry".

import type { EntryKeys } from "@lexema/lookup/entryKeys.ts";
import { factRefKey, isSourceRef, type RelatedWord } from "@lexema/lookup/types.ts";

/** One item of a list as the source lists it: a word, or a note. */
export type ListedItem = { kind: "word"; word: string } | { kind: "note"; text: string };

/**
 * One item of a list as the page shows it: a word with an entry, which is a
 * search; a word with none, which is text; or a note, which is text.
 */
export type RelatedItem = { kind: "entry"; word: string } | { kind: "no-entry"; word: string } | { kind: "note"; text: string };

/** The words among `items`, notes left out: what a page asks `readEntryKeys` about. */
export const listedWords = (items: readonly ListedItem[]): string[] => items.flatMap((item) => (item.kind === "word" ? [item.word] : []));

/** `items` as the page shows them: each word a search only when `entries` has it. */
export function withEntries(items: readonly ListedItem[], entries: EntryKeys): RelatedItem[] {
  return items.map((item) => (item.kind === "note" ? item : { kind: entries.has(item.word) ? "entry" : "no-entry", word: item.word }));
}

/** How many more brackets a piece opens than it closes; negative when it closes more. */
const openBrackets = (text: string): number => [...text].reduce((n, c) => (c === "(" ? n + 1 : c === ")" ? n - 1 : n), 0);

/**
 * The runs of a list, in source order, that are pieces of one note: `[start, end)`.
 *
 * - A piece that opens a bracket runs to the piece that closes it:
 *   `(per es. rurale`, `civile`, `industriale)`.
 * - One the list never closes is a note on its own, so it cannot swallow the
 *   words after it: `casa`'s `(per es. palazzo d'abitazione` is followed by
 *   `scuola` and 60 more, and no later piece closes it.
 * - A piece that closes a bracket nothing opened is a note on its own:
 *   `) terracotta non smaltata`.
 */
export function noteRuns(pieces: readonly string[]): [number, number][] {
  const runs: [number, number][] = [];
  let i = 0;
  while (i < pieces.length) {
    const opened = openBrackets(pieces[i]);
    if (opened === 0) {
      i += 1;
      continue;
    }
    let end = i + 1;
    if (opened > 0) {
      let open = opened;
      let j = i + 1;
      while (j < pieces.length && open > 0) open += openBrackets(pieces[j++]);
      if (open <= 0) end = j;
    }
    runs.push([i, end]);
    i = end;
  }
  return runs;
}

/** `/synonyms/3/word` → the list and the entry's place in it. */
const POINTER = /^\/([a-z]+)\/(\d+)\/word$/;

/**
 * The list's words and notes, in the order the words come. A word every one of
 * whose entries is a piece of a note is not a word; a spelling that is also
 * listed on its own elsewhere stays one. Each note shows once, where its first
 * piece would have, however many records repeat it.
 */
export function relatedItems(words: readonly RelatedWord[]): ListedItem[] {
  // Each record's list, uncollapsed, rebuilt from where each spelling sits.
  const lists = new Map<string, { index: number; word: string; key: string }[]>();
  for (const { word, refs } of words) {
    for (const ref of refs) {
      // A page-only entry's list is read whole off its page line, notes and all, so it is never in pieces.
      if (!isSourceRef(ref)) continue;
      const place = POINTER.exec(ref.jsonPointer);
      if (place === null) continue;
      const list = `${ref.releaseId}\u0000${ref.lineNo}\u0000${place[1]}`;
      lists.set(list, [...(lists.get(list) ?? []), { index: Number(place[2]), word, key: factRefKey(ref) }]);
    }
  }

  // Every entry that is a piece of a note, and the note each run's first piece
  // stands for. Only the first piece places its note: a later piece's spelling
  // can be listed on its own earlier, and placing the note there would show it
  // ahead of words the note comes after (#226).
  const pieces = new Set<string>();
  const noteAt = new Map<string, string>();
  for (const entries of lists.values()) {
    entries.sort((a, b) => a.index - b.index);
    for (const [start, end] of noteRuns(entries.map((entry) => entry.word))) {
      const run = entries.slice(start, end);
      for (const entry of run) pieces.add(entry.key);
      noteAt.set(run[0].key, run.map((entry) => entry.word).join(", "));
    }
  }

  const items: ListedItem[] = [];
  const shownNotes = new Set<string>();
  for (const { word, refs } of words) {
    if (refs.some((ref) => !pieces.has(factRefKey(ref)))) items.push({ kind: "word", word });
    for (const ref of refs) {
      const text = noteAt.get(factRefKey(ref));
      if (text === undefined || shownNotes.has(text)) continue;
      shownNotes.add(text);
      items.push({ kind: "note", text });
    }
  }
  return items;
}
