"use client";

// A legal page's Contents column, on a wide screen only: one link per section,
// and the section being read drawn highlighted and marked
// `aria-current="location"` (#581). At the top of the page that is section 1,
// as frames 33 to 36 draw it, and the server's HTML marks it so. As the reader
// scrolls, the mark moves to the last section whose heading has passed the
// read line; scrolled to the very end, to the last section, whose heading may
// never reach that line. A section opened by its link keeps the mark while it
// is in view.

import { useEffect, useState } from "react";
import {
  LEGAL_CONTENTS,
  LEGAL_CONTENTS_INNER,
  LEGAL_CONTENTS_LABEL,
  LEGAL_CONTENTS_LINK,
  LEGAL_CONTENTS_LIST,
  LEGAL_CONTENTS_NUMBER,
} from "@/components/shared/styles.ts";

/** A section the Contents names: its id and its title. */
export interface ContentsEntry {
  id: string;
  title: string;
}

/**
 * How far below the window's top, in px, a section's top must have scrolled
 * to be the one being read. A Contents link scrolls its section to 32 px
 * (`LEGAL_SECTION`'s `scroll-mt-8`), well inside it.
 */
const READ_LINE = 96;

/** The index of the section being read, from where each section's top sits now. */
export function readingIndex(tops: readonly number[], scrolledToEnd: boolean): number {
  if (scrolledToEnd) return Math.max(tops.length - 1, 0);
  let index = 0;
  tops.forEach((top, i) => {
    if (top <= READ_LINE) index = i;
  });
  return index;
}

/** `label` names the column in its site's language: *Indice*, *Contents*. */
export function LegalContents({ label, sections }: { label: string; sections: readonly ContentsEntry[] }) {
  const [current, setCurrent] = useState(0);
  const ids = sections.map((section) => section.id).join(" ");

  useEffect(() => {
    const list = ids.split(" ");
    const elements = list.map((id) => document.getElementById(id));
    // A section the reader went to by its link, or by an address naming it,
    // stays the one being read while it is in view, though near the end of
    // the page its heading cannot scroll up to the read line.
    let chosen = list.indexOf(decodeURIComponent(window.location.hash.slice(1)));
    const update = () => {
      const tops = elements.map((element) => element?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY);
      if (chosen >= 0 && tops[chosen] >= -1 && tops[chosen] < window.innerHeight) {
        setCurrent(chosen);
        return;
      }
      chosen = -1;
      const root = document.documentElement;
      const scrolledToEnd = window.scrollY > 0 && window.scrollY + window.innerHeight >= root.scrollHeight - 1;
      setCurrent(readingIndex(tops, scrolledToEnd));
    };
    const choose = () => {
      chosen = list.indexOf(decodeURIComponent(window.location.hash.slice(1)));
      update();
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("hashchange", choose);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("hashchange", choose);
    };
  }, [ids]);

  return (
    <nav className={LEGAL_CONTENTS} aria-labelledby="contents">
      <div className={LEGAL_CONTENTS_INNER}>
        {/* A label, not a heading, so the page's first heading is its title. */}
        <p className={LEGAL_CONTENTS_LABEL} id="contents">
          {label}
        </p>
        <ol className={LEGAL_CONTENTS_LIST}>
          {sections.map((section, i) => (
            <li key={section.id}>
              <a className={LEGAL_CONTENTS_LINK} href={`#${section.id}`} aria-current={i === current ? "location" : undefined}>
                {/* The space is text, so the link reads "1. Accounts", as issue 581 asks; the number's slot draws it. */}
                <span className={LEGAL_CONTENTS_NUMBER}>{i + 1}.</span> {section.title}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
