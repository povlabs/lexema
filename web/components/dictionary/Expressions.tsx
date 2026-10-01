"use client";

// One *Expressions* section (#213): the expressions the source lists for the
// word, or, on a form's page, for a word it is a form of (*Expressions with
// andare*). No count on the label. Closed, the first row, then `+ more` when
// there are others; open, every row, then `less` (More.tsx). A phrase that is
// its own headword is bright and links to its entry; one that is not is dimmer
// and plain. A list longer than thirty rows takes *Find an expression* once
// open, matching the phrase or the meaning.
//
// Every row is in the HTML, and the block is Base UI's collapsible. Closing it
// empties the box, so a closed list always shows its first row.

import { Collapsible } from "@base-ui/react/collapsible";
import { Input } from "@base-ui/react/input";
import { useState } from "react";
import { expressionMeaning } from "@lexema/lookup/expressions.ts";
import type { Expression } from "@lexema/lookup/types.ts";
import { SearchIcon } from "@/components/shared/icons";
import { matchesExpression, takesFilter, type ExpressionSection } from "@/lib/dictionary/wordPage.ts";
import { searchHref } from "./Forms";
import { More } from "./More";
import {
  BLOCK_LABEL,
  EXPRESSION_FILTER,
  EXPRESSION_FILTER_ICON,
  EXPRESSION_FILTER_INPUT,
  EXPRESSION_LINK,
  EXPRESSION_LIST,
  EXPRESSION_MEANING,
  EXPRESSION_PHRASE,
  EXPRESSION_ROW,
  EXPRESSION_ROW_EXTRA,
  EXPRESSION_ROW_FILTERED,
  EXPRESSIONS,
  EXPRESSIONS_MORE,
  WORD_BLOCK,
} from "@/components/shared/styles.ts";

/** The section's label: `Expressions`, or `Expressions with andare` for a lemma's. */
export const expressionsLabel = (section: ExpressionSection): string =>
  section.kind === "own" ? "Expressions" : `Expressions with ${section.lemma}`;

function Row({ expression, className }: { expression: Expression; className: string }) {
  const meaning = expressionMeaning(expression);
  return (
    <li className={className} data-expression="">
      {expression.hasEntry ? (
        <a className={EXPRESSION_LINK} href={searchHref(expression.phrase)} lang="it">
          {expression.phrase}
        </a>
      ) : (
        <span className={EXPRESSION_PHRASE} lang="it">
          {expression.phrase}
        </span>
      )}
      {meaning !== null && (
        <p className={EXPRESSION_MEANING} lang="it">
          {meaning}
        </p>
      )}
    </li>
  );
}

export function Expressions({ section, id }: { section: ExpressionSection; id: string }) {
  const [typed, setTyped] = useState("");
  const { expressions } = section;
  const list = `${id}-list`;
  return (
    <section className={WORD_BLOCK} aria-labelledby={id}>
      <h2 className={BLOCK_LABEL} id={id}>
        {expressionsLabel(section)}
      </h2>
      <Collapsible.Root className={EXPRESSIONS} onOpenChange={(open) => open || setTyped("")}>
        {takesFilter(section) && (
          <div className={EXPRESSION_FILTER}>
            <SearchIcon className={EXPRESSION_FILTER_ICON} />
            <Input
              className={EXPRESSION_FILTER_INPUT}
              type="search"
              placeholder="Find an expression"
              aria-label="Find an expression"
              aria-controls={list}
              value={typed}
              onValueChange={setTyped}
            />
          </div>
        )}
        <ul className={EXPRESSION_LIST} id={list}>
          {expressions.map((expression, i) => (
            <Row
              key={expression.phrase}
              expression={expression}
              className={
                !matchesExpression(expression, typed) ? EXPRESSION_ROW_FILTERED : i === 0 ? EXPRESSION_ROW : EXPRESSION_ROW_EXTRA
              }
            />
          ))}
        </ul>
        {expressions.length > 1 && <More className={EXPRESSIONS_MORE} controls={list} />}
      </Collapsible.Root>
    </section>
  );
}
