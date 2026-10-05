// A record's *Expressions* (#213): its `proverbs[]` items, one row per phrase,
// each knowing whether the phrase is an Italian headword of its own.
//
// The item rules are src/italian/expressions.ts. The list rule is here: the
// same phrase with several meanings is one row, its meanings in source order,
// and an exact repeat adds nothing but its pointer (Huey's rulings on #213,
// 2026-10-01). The source repeats a headword's whole list on each of its
// records (`fare`: 323 on two), so a page merges its readings' lists with the
// same rule, and each phrase still shows once.

import { normalizeItalianExact } from "../italian/normalize.js";
import { keyedRead, readKeys, type KeyedRead, type LookupDatabase } from "./database.js";
import { servedBy } from "./served.js";
import type { Expression, ExpressionItem } from "./types.js";

/**
 * Lists merged into one, in order: a phrase already listed takes the other's
 * meanings it lacks and its pointers, and keeps its place.
 */
export function mergeExpressions(lists: readonly (readonly Expression[])[]): Expression[] {
  const byPhrase = new Map<string, Expression>();
  for (const expression of lists.flat()) {
    const existing = byPhrase.get(expression.phrase);
    if (existing === undefined) {
      byPhrase.set(expression.phrase, { ...expression, meanings: [...expression.meanings], refs: [...expression.refs] });
      continue;
    }
    for (const meaning of expression.meanings) if (!existing.meanings.includes(meaning)) existing.meanings.push(meaning);
    existing.refs.push(...expression.refs);
  }
  return [...byPhrase.values()];
}

/** One record's items as rows, `isHeadword` answering for each phrase. */
export function expressionsOf(items: readonly ExpressionItem[], isHeadword: (phrase: string) => boolean): Expression[] {
  return mergeExpressions([
    items.map((item) => ({
      phrase: item.phrase,
      meanings: item.meaning === null ? [] : [item.meaning],
      hasEntry: isHeadword(item.phrase),
      refs: [item.ref],
    })),
  ]);
}

/** What a row says after its phrase: its meanings joined by "; ", or null when it has none. */
export function expressionMeaning(expression: Pick<Expression, "meanings">): string | null {
  return expression.meanings.length === 0 ? null : expression.meanings.join("; ");
}

/**
 * Which of the keys are Italian headwords: one read of
 * `lookup_form_headword_by_key` for a list of any length, and on D1 one for
 * every list a page asks in one wait (`KeyedRead`, #393). Exported so a test
 * can assert the plan.
 */
export const HEADWORD_KEY_SQL: KeyedRead = keyedRead(`SELECT DISTINCT surface_key AS set_key
       FROM lookup_form
      WHERE release_id IN (${servedBy("?2")}) AND origin = 'headword'
        AND surface_key IN (SELECT value FROM json_each(?1))`);

/**
 * A record's items as rows. A phrase is a headword when a search for it
 * reaches a headword record: the key the search probes, on the headword rows
 * only, so a phrase the page links opens that entry.
 */
export async function readExpressions(
  db: LookupDatabase,
  releaseId: string,
  items: readonly ExpressionItem[],
): Promise<Expression[]> {
  if (items.length === 0) return [];
  const keys = items.map((item) => normalizeItalianExact(item.phrase));
  const rows = await readKeys<{ set_key: string }>(db, HEADWORD_KEY_SQL, keys, [releaseId]);
  const headwords = new Set(rows.map((row) => row.set_key));
  return expressionsOf(items, (phrase) => headwords.has(normalizeItalianExact(phrase)));
}
