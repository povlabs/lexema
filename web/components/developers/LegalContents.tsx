"use client";

// A legal page's Contents column (#162, boards 35 and 36): one link per
// numbered section, the section being read in `text-strong`. The server marks
// the first; once the script runs, the mark follows the reader.

import { useEffect, useState } from "react";
import {
  LEGAL_CONTENTS_LABEL,
  LEGAL_CONTENTS_LINK,
  LEGAL_CONTENTS_LIST,
  LEGAL_CONTENTS_NUMBER,
} from "@/components/shared/styles.ts";

export interface ContentsEntry {
  readonly id: string;
  readonly heading: string;
}

/**
 * How far below the window's top, in px, a section must start to be the one
 * being read: under the 32 px a Contents link scrolls a section to, and above
 * where a short section's successor then starts.
 */
const READ_LINE = 96;

/**
 * The entry being read: the last whose section starts above `READ_LINE`,
 * else the first; at the foot of the page, the last, whose heading may never reach the line.
 */
const readingOf = (entries: readonly ContentsEntry[]): string | undefined => {
  const atFoot = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  if (atFoot && window.scrollY > 0) return entries.at(-1)?.id;
  let reading = entries[0]?.id;
  for (const { id } of entries) {
    const top = document.getElementById(id)?.getBoundingClientRect().top;
    if (top !== undefined && top <= READ_LINE) reading = id;
  }
  return reading;
};

export function LegalContents({ entries }: { entries: readonly ContentsEntry[] }) {
  const [reading, setReading] = useState<string | undefined>(entries[0]?.id);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setReading(readingOf(entries)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [entries]);

  return (
    <nav aria-labelledby="legal-contents">
      <h2 className={LEGAL_CONTENTS_LABEL} id="legal-contents">
        Contents
      </h2>
      <ol className={LEGAL_CONTENTS_LIST}>
        {entries.map((entry, index) => (
          <li key={entry.id}>
            <a className={LEGAL_CONTENTS_LINK} href={`#${entry.id}`} aria-current={entry.id === reading ? "location" : undefined}>
              <span className={LEGAL_CONTENTS_NUMBER}>{index + 1}.</span>
              {entry.heading}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
