// The shape every legal page shares: the dictionary's Licence and Privacy
// (#139, frames 33, 33m, 34 and 34m) and the developer site's Terms of service
// and Privacy policy (#162, frames 35, 35m, 36 and 36m). The kicker, the
// title, the date the text took effect, the lede with a rule under it, and the
// numbered sections, listed in a Contents column on a wide screen. The page's
// header and footer are its site's, so the caller draws them around this.
//
// A section's number is its place in the list, so the numbers can never skip
// or repeat, and the Contents list is drawn from the same list as the text, so
// it never names a section the page does not have.

import type { ReactNode } from "react";
import {
  LEGAL_EFFECTIVE,
  LEGAL_ITEM,
  LEGAL_ITEM_MARK,
  LEGAL_KICKER,
  LEGAL_LAYOUT,
  LEGAL_LEDE,
  LEGAL_SECTION,
  LEGAL_SECTION_HEADING,
  LEGAL_SECTION_NUMBER,
  LEGAL_SHELL,
  LEGAL_TEXT,
  LEGAL_TITLE,
} from "@/components/shared/styles.ts";
import { LegalContents } from "./LegalContents";

/** One numbered section: its id is the fragment a link to it names. */
export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** A legal page's text. `effective` is the date it took effect, `YYYY-MM-DD`. */
export interface LegalText {
  /** The line above the title, naming the site: `LEXEMA · LEGAL`. */
  kicker: string;
  title: string;
  effective: string;
  lede: string;
  sections: readonly LegalSection[];
}

/**
 * One lettered item of a section's list. The space after the mark keeps the
 * item reading "(a) copy …" as text; the layout sets the gap.
 */
export function LegalItem({ mark, children }: { mark: string; children: ReactNode }) {
  return (
    <li className={LEGAL_ITEM}>
      <span className={LEGAL_ITEM_MARK}>({mark})</span> <span>{children}</span>
    </li>
  );
}

/** `2026-10-04` as `4 October 2026`, the date a reader would say. */
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function LegalPage({ kicker, title, effective, lede, sections }: LegalText) {
  return (
    <main className={LEGAL_SHELL}>
      <div className={LEGAL_LAYOUT}>
        <LegalContents sections={sections.map(({ id, title }) => ({ id, title }))} />
        <article className={LEGAL_TEXT}>
          <p className={LEGAL_KICKER}>{kicker}</p>
          <h1 className={LEGAL_TITLE}>{title}</h1>
          <p className={LEGAL_EFFECTIVE}>Effective {DAY.format(new Date(effective))}</p>
          <p className={LEGAL_LEDE}>{lede}</p>
          {sections.map((section, i) => (
            <section key={section.id} className={LEGAL_SECTION} id={section.id} aria-labelledby={`${section.id}-heading`}>
              <h2 className={LEGAL_SECTION_HEADING} id={`${section.id}-heading`}>
                {/* The space is text, so the heading reads "1. Accounts" to a screen reader, as issue 581 asks; the flex gap draws it. */}
                <span className={LEGAL_SECTION_NUMBER}>{i + 1}.</span> {section.title}
              </h2>
              {section.body}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
