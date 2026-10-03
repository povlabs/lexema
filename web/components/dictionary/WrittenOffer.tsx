// A word found whose query a headword also writes with an accent or a final
// apostrophe (board 32, #478): one line under the search bar, above the
// result, "Did you mean città?". The first ranked headword is offered, as a
// link to its own search; the page says nothing about why.

import type { ReactNode } from "react";
import { searchHref } from "./Forms";
import { WRITTEN_OFFER_LEAD, WRITTEN_OFFER_LINK } from "@/components/shared/styles.ts";

/**
 * The result, with the line above it when there is a word to offer. With none,
 * the result alone, in the same place in the tree, so its markup (generated
 * ids included) is the page it was before the line existed.
 */
export function WrittenOffer({ written, children }: { written: readonly string[]; children: ReactNode }) {
  const [word] = written;
  if (word === undefined) return children;
  return (
    <>
      <p className={WRITTEN_OFFER_LEAD}>
        Did you mean{" "}
        <a className={WRITTEN_OFFER_LINK} href={searchHref(word)} lang="it">
          {word}
        </a>
        ?
      </p>
      {children}
    </>
  );
}
