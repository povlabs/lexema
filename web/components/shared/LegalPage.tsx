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
  type LegalNumberDigits,
  type LegalSite,
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
  /** The line above the title, naming the site: `LEXEMA · NOTE LEGALI`. */
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

/** A `YYYY-MM-DD` date as a reader of `locale` would say it: `4 October 2026`, `4 ottobre 2026`. */
export const dayIn = (locale: "en-GB" | "it-IT"): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * The words a legal page draws around its text, in its site's language: the
 * dictionary is Italian (#791), the developer site English.
 */
const CHROME: Readonly<Record<LegalSite, { contents: string; effective: (date: Date) => string }>> = {
  dictionary: { contents: "Indice", effective: (date) => `In vigore dal ${dayIn("it-IT").format(date)}` },
  developers: { contents: "Contents", effective: (date) => `Effective ${dayIn("en-GB").format(date)}` },
};

/** How many digits the highest of `count` section numbers has. */
export function numberDigits(count: number): LegalNumberDigits {
  return count > 9 ? 2 : 1;
}

/**
 * A legal page, in its site's column: `site` sets the edge the text starts on,
 * so it lines up with that site's header on a phone as on a wide screen.
 */
export function LegalPage({ site, kicker, title, effective, lede, sections }: LegalText & { site: LegalSite }) {
  return (
    <main className={LEGAL_SHELL[site]}>
      <div className={LEGAL_LAYOUT[numberDigits(sections.length)]}>
        <LegalContents label={CHROME[site].contents} sections={sections.map(({ id, title }) => ({ id, title }))} />
        <article className={LEGAL_TEXT}>
          <p className={LEGAL_KICKER}>{kicker}</p>
          <h1 className={LEGAL_TITLE}>{title}</h1>
          <p className={LEGAL_EFFECTIVE}>{CHROME[site].effective(new Date(effective))}</p>
          <p className={LEGAL_LEDE}>{lede}</p>
          {sections.map((section, i) => (
            <section key={section.id} className={LEGAL_SECTION} id={section.id} aria-labelledby={`${section.id}-heading`}>
              <h2 className={LEGAL_SECTION_HEADING} id={`${section.id}-heading`}>
                {/* The space is text, so the heading reads "1. Accounts" to a screen reader, as issue 581 asks; the number's slot draws it. */}
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
