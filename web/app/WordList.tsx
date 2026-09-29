"use client";

// A run of related words — synonyms, antonyms, derived words, suggestions —
// separated by `·`, each a search. Closed, the words that fit on one line, then
// `+ more` right after the last of them; open, every word, then `less`
// (More.tsx). Used after the readings and, where the source ties a synonym
// group to one part of speech, inside a reading.
//
// Every word is in the HTML, and the list is Base UI's collapsible, open or
// closed. Which words fit on the line needs measuring: until that runs, the
// first eight show.

import { Collapsible } from "@base-ui/react/collapsible";
import { useEffect, useRef, useState } from "react";
import type { RelatedWord } from "@lexema/lookup/types.ts";
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
  WORD_MORE,
} from "./styles.ts";

/** How many words show closed before the list is measured, or with no script. */
export const WORD_LIST_SLICE = 8;

/**
 * How many words fit on the first line with `+ more` after them, laid out with
 * every word showing; all of them when they fit on one line alone. At least
 * one, so the control always follows a word.
 */
function wordsOnFirstLine(list: HTMLElement, more: HTMLElement): number {
  const words = [...list.querySelectorAll<HTMLElement>(":scope > [data-word]")].map((word) =>
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
  words,
  level = "h2",
}: {
  id: string;
  label: string;
  words: readonly Pick<RelatedWord, "word">[];
  /** `h3` inside a reading, `h2` after the readings. */
  level?: "h2" | "h3";
}) {
  const list = useRef<HTMLUListElement>(null);
  const toggle = useRef<HTMLLIElement>(null);
  const [shown, setShown] = useState(Math.min(WORD_LIST_SLICE, words.length));

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
  }, [words.length]);

  if (words.length === 0) return null;
  const Heading = level;
  const cut = shown < words.length;
  return (
    <section className={level === "h2" ? WORD_BLOCK : BLOCK} aria-labelledby={id}>
      <Heading className={BLOCK_LABEL} id={id}>
        {label}
      </Heading>
      <Collapsible.Root className={WORD_LIST} id={`${id}-words`} render={<ul ref={list} />}>
        {words.map(({ word }, i) => (
          <li key={word} className={i < shown ? WORD_LIST_ITEM : WORD_LIST_ITEM_REST} data-word="">
            <a className={WORD_LINK} href={searchHref(word)} lang="it">
              {word}
            </a>
            {/* The dot trails its word, so a wrapped line never opens on one. */}
            {i < words.length - 1 && (
              <span className={cut && i === shown - 1 ? WORD_DOT_BEFORE_REST : WORD_DOT} aria-hidden="true">
                ·
              </span>
            )}
          </li>
        ))}
        {/* Last, so it ends what shows, open or closed; kept when every word
            fits, so a narrower window can bring it back. */}
        <li ref={toggle} className={cut ? WORD_LIST_ITEM : WORD_LIST_MORE_UNNEEDED}>
          <More className={WORD_MORE} controls={`${id}-words`} />
        </li>
      </Collapsible.Root>
    </section>
  );
}
