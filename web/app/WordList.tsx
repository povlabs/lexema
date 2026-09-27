// A run of related words — synonyms, antonyms, derived words — separated by
// `·`, each a search; eight, then `+ N more`. Used after the readings and,
// where the source ties a synonym group to one part of speech, inside a reading.

import type { RelatedWord } from "@lexema/lookup/types.ts";
import { searchHref } from "./Forms";
import {
  BLOCK,
  BLOCK_LABEL,
  WORD_BLOCK,
  MORE_CLOSED,
  MORE_OPEN,
  WORD_DOT,
  WORD_DOT_BEFORE_REST,
  WORD_LINK,
  WORD_LIST,
  WORD_LIST_ITEM,
  WORD_LIST_REST,
  WORD_MORE,
  WORD_MORE_SUMMARY,
} from "./styles.ts";

/** How many words of a list show before `+ N more`. */
export const WORD_LIST_SLICE = 8;

/** A run of words separated by `·`, each a search; eight, then `+ N more`. */
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
  const Heading = level;
  if (words.length === 0) return null;
  const rest = words.slice(WORD_LIST_SLICE);
  // The dot trails its word, so a wrapped line never opens on one. The dot
  // after the eighth word shows only once the rest are open.
  const item = (word: Pick<RelatedWord, "word">, i: number) => {
    const last = i === words.length - 1;
    const beforeRest = i === WORD_LIST_SLICE - 1 && rest.length > 0;
    return (
      <li key={word.word} className={WORD_LIST_ITEM}>
        <a className={WORD_LINK} href={searchHref(word.word)} lang="it">
          {word.word}
        </a>
        {!last && (
          <span className={beforeRest ? WORD_DOT_BEFORE_REST : WORD_DOT} aria-hidden="true">
            ·
          </span>
        )}
      </li>
    );
  };
  return (
    <section className={level === "h2" ? WORD_BLOCK : BLOCK} aria-labelledby={id}>
      <Heading className={BLOCK_LABEL} id={id}>
        {label}
      </Heading>
      <ul className={`${WORD_LIST} group/words`}>
        {words.slice(0, WORD_LIST_SLICE).map(item)}
        {rest.length > 0 && (
          <li className={WORD_LIST_ITEM}>
            <details className={WORD_MORE}>
              <summary className={WORD_MORE_SUMMARY}>
                <span className={MORE_CLOSED}>+ {rest.length} more</span>
                <span className={MORE_OPEN}>fewer</span>
              </summary>
            </details>
          </li>
        )}
        {/* The rest are in the document, shown once the summary above is open. */}
        {rest.length > 0 && (
          <li className="contents" data-more-words="">
            <ul className={WORD_LIST_REST}>
              {rest.map((word, i) => item(word, WORD_LIST_SLICE + i))}
            </ul>
          </li>
        )}
      </ul>
    </section>
  );
}
