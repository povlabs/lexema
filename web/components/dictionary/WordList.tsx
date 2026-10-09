"use client";

// A run of related words — synonyms, antonyms, derived words, suggestions —
// separated by `·`, each a search. A note the source wrote inside the list
// (relatedList.ts) sits in the run where it came, as text, read-only. Closed,
// the items that fit on one line, then `+ altro` right after the last of them;
// open, every item, then `meno`
// (More.tsx). Used after the readings and, where the source ties a synonym
// group to one part of speech, inside a reading.
//
// Every item is in the HTML, and the list is Base UI's collapsible, open or
// closed. Which words fit on the line needs measuring: until that runs, the
// first eight show.

import { Collapsible } from "@base-ui/react/collapsible";
import { useEffect, useRef, useState } from "react";
import type { RelatedItem } from "@/lib/dictionary/relatedList.ts";
import { searchHref } from "./Forms";
import { More } from "./More";
import {
  BLOCK,
  BLOCK_LABEL,
  WORD_BLOCK,
  WORD_DOT,
  WORD_DOT_BEFORE_REST,
  WORD_LINK,
  WORD_LIST,
  WORD_LIST_ITEM,
  WORD_LIST_ITEM_REST,
  WORD_LIST_MORE_UNNEEDED,
  WORD_NOTE,
} from "@/components/shared/styles.ts";

/** How many words show closed before the list is measured, or with no script. */
export const WORD_LIST_SLICE = 8;

/**
 * How many words fit on the first line with `+ altro` after them, laid out with
 * every word showing; all of them when they fit on one line alone. At least
 * one, so the control always follows a word.
 */
function wordsOnFirstLine(list: HTMLElement, more: HTMLElement): number {
  const words = [...list.querySelectorAll<HTMLElement>(":scope > [data-item]")].map((word) =>
    word.getBoundingClientRect(),
  );
  const [first] = words;
  if (first === undefined) return 0;
  const onFirstLine = (word: DOMRect) => word.top < first.top + first.height / 2;
  if (words.every(onFirstLine)) return words.length;
  const right = list.getBoundingClientRect().right;
  const room = more.getBoundingClientRect().width + (parseFloat(getComputedStyle(list).columnGap) || 0);
  let fit = 0;
  while (fit < words.length && onFirstLine(words[fit]) && words[fit].right + room <= right + 0.5) fit += 1;
  return Math.max(fit, 1);
}

export function WordList({
  id,
  label,
  items,
  level = "h2",
}: {
  id: string;
  label: string;
  items: readonly RelatedItem[];
  /** `h3` inside a reading, `h2` after the readings. */
  level?: "h2" | "h3";
}) {
  const list = useRef<HTMLUListElement>(null);
  const toggle = useRef<HTMLLIElement>(null);
  const [shown, setShown] = useState(Math.min(WORD_LIST_SLICE, items.length));

  useEffect(() => {
    const element = list.current;
    const more = toggle.current;
    if (element === null || more === null) return;
    const measure = () => {
      // Only a closed list is measured; an open one shows every word.
      if (element.hasAttribute("data-open")) return;
      element.dataset.measuring = "";
      const fit = wordsOnFirstLine(element, more);
      delete element.dataset.measuring;
      setShown(fit);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // A list closed after a resize is measured again.
    const toggled = new MutationObserver(measure);
    toggled.observe(element, { attributeFilter: ["data-open"] });
    void document.fonts.ready.then(measure);
    return () => {
      observer.disconnect();
      toggled.disconnect();
    };
  }, [items.length]);

  if (items.length === 0) return null;
  const Heading = level;
  const cut = shown < items.length;
  return (
    <section className={level === "h2" ? WORD_BLOCK : BLOCK} aria-labelledby={id}>
      <Heading className={BLOCK_LABEL} id={id} lang="it">
        {label}
      </Heading>
      <Collapsible.Root className={WORD_LIST} id={`${id}-words`} render={<ul ref={list} />}>
        {items.map((item, i) => (
          <li
            key={item.kind === "word" ? `word:${item.word}` : `note:${item.text}`}
            className={i < shown ? WORD_LIST_ITEM : WORD_LIST_ITEM_REST}
            data-item=""
          >
            {item.kind === "word" ? (
              <a className={WORD_LINK} href={searchHref(item.word)} lang="it">
                {item.word}
              </a>
            ) : (
              <span className={WORD_NOTE} lang="it">
                {item.text}
              </span>
            )}
            {/* The dot trails its item, so a wrapped line never opens on one. */}
            {i < items.length - 1 && (
              <span className={cut && i === shown - 1 ? WORD_DOT_BEFORE_REST : WORD_DOT} aria-hidden="true">
                ·
              </span>
            )}
          </li>
        ))}
        {/* Last, so it ends what shows, open or closed; kept when every word
            fits, so a narrower window can bring it back. */}
        <li ref={toggle} className={cut ? WORD_LIST_ITEM : WORD_LIST_MORE_UNNEEDED}>
          <More place="words" controls={`${id}-words`} />
        </li>
      </Collapsible.Root>
    </section>
  );
}
