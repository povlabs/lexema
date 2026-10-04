// Which raw pages the seed offers as page-only entries (ADR 0028, #499).
//
// A full release offers every raw page no Italian record spells: there, "no
// record in the archive" means "no record in the release". The fifty-word
// development fixture cannot say that, since most words are missing from it
// only because they are not among the fifty. So a fixture seed offers only the
// titles a whole-release measurement found record-less, the committed list
// `fixtures/unrecorded-page-titles.json`, and reads no other page as a
// candidate, whichever raw page source it is given.

import { readFile } from "node:fs/promises";
import type { RawPageSource } from "../source/rawPage.js";

/** The committed list's path, from the repository root. */
export const UNRECORDED_PAGE_TITLES_FILE = "fixtures/unrecorded-page-titles.json";

/**
 * The titles a release has raw pages for with Italian definitions and no
 * Italian record, as one measurement of the whole release counted them.
 */
export interface UnrecordedPageTitles {
  /** The release the measurement read: `it-` and its archive's first eight hex digits. */
  release: string;
  /** The measurement the titles come from, a path from the repository root. */
  measuredBy: string;
  /** Each title once, sorted. */
  titles: readonly string[];
}

type Offer =
  | { kind: "every-unrecorded-page" }
  | { kind: "listed"; list: UnrecordedPageTitles };

export class PageOnlyCandidates {
  private constructor(private readonly offer: Offer) {}

  /** A full release: every raw page whose title no Italian record spells (ADR 0028). */
  static everyUnrecordedPage(): PageOnlyCandidates {
    return new PageOnlyCandidates({ kind: "every-unrecorded-page" });
  }

  /** A bounded fixture: only the titles a whole-release measurement found record-less. */
  static listed(list: UnrecordedPageTitles): PageOnlyCandidates {
    return new PageOnlyCandidates({ kind: "listed", list });
  }

  /**
   * What `pnpm run seed:dev` offers for its input: every unrecorded page for a
   * release archive (`.gz`), the committed list for a fixture.
   */
  static async forSeedInput(input: string, listFile: string): Promise<PageOnlyCandidates> {
    if (input.endsWith(".gz")) return PageOnlyCandidates.everyUnrecordedPage();
    return PageOnlyCandidates.listed(await readUnrecordedPageTitles(listFile));
  }

  /**
   * The titles to try, each once. A listed title the source holds no page for
   * is left out, so the list is walked and never the source.
   */
  *titlesIn(source: RawPageSource): Iterable<string> {
    if (this.offer.kind === "every-unrecorded-page") {
      yield* source.titles();
      return;
    }
    for (const title of this.offer.list.titles) {
      if (source.page(title) !== undefined) yield title;
    }
  }

  /** One line for a seed's log. */
  describe(): string {
    return this.offer.kind === "every-unrecorded-page"
      ? "every raw page with no Italian record"
      : `the ${this.offer.list.titles.length} record-less titles of ${this.offer.list.release} (${this.offer.list.measuredBy})`;
  }
}

/** Read and check the committed list: a release id, its measurement, and sorted, distinct titles. */
export async function readUnrecordedPageTitles(file: string): Promise<UnrecordedPageTitles> {
  const payload: unknown = JSON.parse(await readFile(file, "utf8"));
  if (typeof payload !== "object" || payload === null) throw new Error(`${file}: not a JSON object`);
  const { release, measuredBy, titles } = payload as Record<string, unknown>;
  if (typeof release !== "string" || !/^it-[0-9a-f]{8}$/.test(release)) throw new Error(`${file}: release must be it-<8 hex digits>`);
  if (typeof measuredBy !== "string" || measuredBy === "") throw new Error(`${file}: measuredBy must name the measurement`);
  if (!Array.isArray(titles) || !titles.every((title): title is string => typeof title === "string" && title !== "")) {
    throw new Error(`${file}: titles must be non-empty strings`);
  }
  titles.forEach((title, index) => {
    if (index > 0 && !(titles[index - 1] < title)) throw new Error(`${file}: titles must be sorted and distinct, at ${JSON.stringify(title)}`);
  });
  return { release, measuredBy, titles };
}
