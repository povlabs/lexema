// The shape both legal pages share (#139, frames 33, 33m, 34 and 34m): the
// kicker, the title, the date the text took effect, the lede with a rule under
// it, and the numbered sections, listed in a Contents column on a wide screen.
//
// A section's number is its place in the list, so the numbers can never skip
// or repeat, and the Contents list is drawn from the same list as the text, so
// it never names a section the page does not have.

import type { ReactNode } from "react";
import {
  LEGAL_CONTENTS,
  LEGAL_CONTENTS_INNER,
  LEGAL_CONTENTS_LABEL,
  LEGAL_CONTENTS_LINK,
  LEGAL_CONTENTS_LIST,
  LEGAL_CONTENTS_NUMBER,
  LEGAL_EFFECTIVE,
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
import { SiteHeader } from "./SiteHeader";

/** One numbered section: its id is the fragment a link to it names. */
export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** A legal page's text. `effective` is the date it took effect, `YYYY-MM-DD`. */
export interface LegalText {
  title: string;
  effective: string;
  lede: string;
  sections: readonly LegalSection[];
}

/** `2026-10-04` as `4 October 2026`, the date a reader would say. */
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function LegalPage({ title, effective, lede, sections }: LegalText) {
  return (
    <>
      <SiteHeader />
      <main className={LEGAL_SHELL}>
        <div className={LEGAL_LAYOUT}>
          <nav className={LEGAL_CONTENTS} aria-labelledby="contents">
            <div className={LEGAL_CONTENTS_INNER}>
              {/* A label, not a heading, so the page's first heading is its title. */}
              <p className={LEGAL_CONTENTS_LABEL} id="contents">
                Contents
              </p>
              <ol className={LEGAL_CONTENTS_LIST}>
                {sections.map((section, i) => (
                  <li key={section.id}>
                    <a className={LEGAL_CONTENTS_LINK} href={`#${section.id}`}>
                      <span className={LEGAL_CONTENTS_NUMBER}>{i + 1}</span>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
          <article className={LEGAL_TEXT}>
            <p className={LEGAL_KICKER}>LEXEMA · LEGAL</p>
            <h1 className={LEGAL_TITLE}>{title}</h1>
            <p className={LEGAL_EFFECTIVE}>Effective {DAY.format(new Date(effective))}</p>
            <p className={LEGAL_LEDE}>{lede}</p>
            {sections.map((section, i) => (
              <section key={section.id} className={LEGAL_SECTION} id={section.id} aria-labelledby={`${section.id}-heading`}>
                <h2 className={LEGAL_SECTION_HEADING} id={`${section.id}-heading`}>
                  <span className={LEGAL_SECTION_NUMBER}>{i + 1}</span>
                  {section.title}
                </h2>
                {section.body}
              </section>
            ))}
          </article>
        </div>
      </main>
    </>
  );
}
