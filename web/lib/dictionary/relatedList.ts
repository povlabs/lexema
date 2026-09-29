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

import type { RelatedWord, SourceRef } from "@lexema/lookup/types.ts";

/** One item of a list: a word, which is a search, or a note, which is text. */
export type RelatedItem = { kind: "word"; word: string } | { kind: "note"; text: string };

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

const refKey = (ref: SourceRef): string => `${ref.releaseId}\u0000${ref.lineNo}\u0000${ref.jsonPointer}`;

/**
 * The list's words and notes, in the order the words come. A word every one of
 * whose entries is a piece of a note is not a word; a spelling that is also
 * listed on its own elsewhere stays one. Each note shows once, where its first
 * piece would have, however many records repeat it.
 */
export function relatedItems(words: readonly RelatedWord[]): RelatedItem[] {
  // Each record's list, uncollapsed, rebuilt from where each spelling sits.
  const lists = new Map<string, { index: number; word: string; key: string }[]>();
  for (const { word, refs } of words) {
    for (const ref of refs) {
      const place = POINTER.exec(ref.jsonPointer);
      if (place === null) continue;
      const list = `${ref.releaseId}\u0000${ref.lineNo}\u0000${place[1]}`;
      lists.set(list, [...(lists.get(list) ?? []), { index: Number(place[2]), word, key: refKey(ref) }]);
    }
  }

  const noteOf = new Map<string, string>();
  for (const entries of lists.values()) {
    entries.sort((a, b) => a.index - b.index);
    for (const [start, end] of noteRuns(entries.map((entry) => entry.word))) {
      const run = entries.slice(start, end);
      const text = run.map((entry) => entry.word).join(", ");
      for (const entry of run) noteOf.set(entry.key, text);
    }
  }

  const items: RelatedItem[] = [];
  const shownNotes = new Set<string>();
  for (const { word, refs } of words) {
    if (refs.some((ref) => !noteOf.has(refKey(ref)))) items.push({ kind: "word", word });
    for (const ref of refs) {
      const text = noteOf.get(refKey(ref));
      if (text === undefined || shownNotes.has(text)) continue;
      shownNotes.add(text);
      items.push({ kind: "note", text });
    }
  }
  return items;
}
