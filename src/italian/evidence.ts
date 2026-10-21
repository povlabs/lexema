// A Wiktionary revision a fact is checked against, and its permanent link.
//
// The lookup and the Worker need only the link. They import it from here, not
// from curatedCorrections.ts, because that module builds every curated
// correction from its evidence tables when it loads, and a Worker that loads it
// spends most of its startup CPU doing so (#911).

/** One Wiktionary page revision, and what it shows that settles the fact. */
export interface Evidence {
  wiki: "it.wiktionary.org" | "en.wiktionary.org";
  title: string;
  revisionId: number;
  /** What the revision shows, as written there. */
  shows: string;
}

/** A permanent link to the revision, which stays as it was whatever the page says later. */
export const evidenceUrl = (evidence: Omit<Evidence, "shows">): string =>
  `https://${evidence.wiki}/w/index.php?title=${encodeURIComponent(evidence.title)}&oldid=${evidence.revisionId}`;
