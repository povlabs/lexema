// Whether a typed query is an Italian article and one word, by rule
// `it-article-query/v1` (#738).
//
// People search a noun with its article: `una macchina`, `la macchina`,
// `l'acqua`. No record heads that text, so the lookup reads it, last of all
// its routes, as the article and the word, and answers the word's readings.
// This rule only splits the query:
//
//   una macchina        `una` and `macchina`
//   l'acqua, l’acqua    `l'` and `acqua`: an elided article joins its word with
//                       an apostrophe and no space
//   gli zaini           `gli` and `zaini`
//   la                  no word
//   della macchina      `della` is an articulated preposition, not an article
//   la macchina rossa   more than one word
//
// The articles are one closed list: the definite and indefinite forms rule
// `it-articles/v3` (src/italian/articles.ts) gives a word. Its partitives
// (`del`, `delle`) are not here, and neither is any other articulated
// preposition. Which reading the article agrees with is not this rule's: the
// lookup reads it off each reading's own articles (src/lookup/articles.ts).

import { normalizeItalianExact } from "./normalize.js";

/** The rule's name and version. */
export const ARTICLE_QUERY_RULE = "it-article-query/v1" as const;

/** The articles written before their word with a space. */
const SPACED_ARTICLES = ["il", "lo", "la", "i", "gli", "le", "un", "uno", "una"] as const;

/** The elided articles, joined to their word by the apostrophe they end with. */
const ELIDED_ARTICLES = ["l'", "un'"] as const;

/** Every article the rule reads: the definite and indefinite forms `it-articles/v3` gives. */
export const QUERY_ARTICLES = [...SPACED_ARTICLES, ...ELIDED_ARTICLES] as const;

export type QueryArticle = (typeof QUERY_ARTICLES)[number];

declare const articleQueryBrand: unique symbol;

/**
 * A query read as an article and one word. It carries a brand only this module
 * can write, so an article with no word, or a word read without the rule, is
 * not a value this type holds.
 */
export interface ArticleQuery {
  readonly [articleQueryBrand]: typeof ARTICLE_QUERY_RULE;
  readonly rule: typeof ARTICLE_QUERY_RULE;
  readonly article: QueryArticle;
  /** The word after the article, normalized as the index keys it: `macchina`, `acqua`. */
  readonly word: string;
}

/** One word: no space in it, and opening on a letter. */
const WORD = /^\p{L}\S*$/u;

const isSpaced = (token: string): token is (typeof SPACED_ARTICLES)[number] =>
  (SPACED_ARTICLES as readonly string[]).includes(token);

/**
 * How the rule reads `query`: the article and the word, or undefined when it
 * is not an article from the list and one word. The query is normalized first,
 * so any of the four apostrophes `normalizeItalianExact` folds joins an elided
 * article (`l’acqua`), and the case it was typed in does not matter.
 */
export function articleQuery(query: string): ArticleQuery | undefined {
  const key = normalizeItalianExact(query);
  const elided = ELIDED_ARTICLES.find((article) => key.startsWith(article));
  if (elided !== undefined) return read(elided, key.slice(elided.length));
  const [article, word, ...more] = key.split(/\s+/u);
  if (more.length > 0 || word === undefined || !isSpaced(article)) return undefined;
  return read(article, word);
}

function read(article: QueryArticle, word: string): ArticleQuery | undefined {
  if (!WORD.test(word)) return undefined;
  // The one place the brand is written: the query has just been read as an article and one word.
  return { rule: ARTICLE_QUERY_RULE, article, word } as ArticleQuery;
}
