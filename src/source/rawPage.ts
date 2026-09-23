// Raw Wiktionary pages: the second upstream input, beside the Kaikki archive.
//
// The archive is Wiktextract's reading of Italian Wiktionary. Where that reading
// drops text the page states (#28), the page itself is the only place the text
// still exists, so the recovered layer reads it here. A page is one revision of
// one title, saved verbatim, and its revision id travels with every value read
// from it.
//
// Two things feed a `RawPageSource`: the Italian Wiktionary dump the archive was
// built from (`wiktionaryDump.ts`), and the pages committed under `fixtures/`,
// which a fresh clone and CI read. Nothing downstream knows which one it is
// reading.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** The wiki every raw page is read from. Italian Wiktionary only. */
export const RAW_PAGE_WIKI = "it.wiktionary.org" as const;

/** One revision of one Italian Wiktionary page, as saved. */
export interface RawPage {
  wiki: typeof RAW_PAGE_WIKI;
  /** The page title, which is the headword the archive record spells. */
  title: string;
  /** The MediaWiki revision id the wikitext is from. */
  revisionId: number;
  /** When that revision was saved, ISO-8601. */
  timestamp: string;
  /** The revision's wikitext, byte for byte. Line 1 is its first line. */
  wikitext: string;
}

/** Where a value read off a raw page came from: the revision and the line. */
export interface RawPageRef {
  wiki: typeof RAW_PAGE_WIKI;
  title: string;
  revisionId: number;
  /** 1-based line in the revision's wikitext. */
  line: number;
}

/** Raw pages by title. At most one revision per title. */
export interface RawPageSource {
  page(title: string): RawPage | undefined;
  /** How many pages the source holds. */
  readonly size: number;
}

export function rawPageSource(pages: Iterable<RawPage>): RawPageSource {
  const byTitle = new Map<string, RawPage>();
  for (const page of pages) {
    const held = byTitle.get(page.title);
    if (held !== undefined) {
      throw new Error(
        `two revisions of ${JSON.stringify(page.title)} (${held.revisionId} and ${page.revisionId}); ` +
          `a raw page source holds one revision per title`,
      );
    }
    byTitle.set(page.title, page);
  }
  return { page: (title) => byTitle.get(title), size: byTitle.size };
}

/** `fixtures/upstream-pages/<title>.wikitext` opens with this comment and nothing else on the line. */
const SAVED_PAGE_HEADER =
  /^<!-- it\.wiktionary\.org\/wiki\/(.+) revision (\d+) \(([^)]+)\), CC BY-SA 4\.0\. Saved verbatim\. -->\n/;

/** A regression page from `fixtures/upstream-pages/`, header comment removed. */
export function readSavedPage(text: string, file: string): RawPage {
  const header = SAVED_PAGE_HEADER.exec(text);
  if (header === null) throw new Error(`${file}: no revision header on line 1`);
  return {
    wiki: RAW_PAGE_WIKI,
    title: header[1],
    revisionId: Number(header[2]),
    timestamp: header[3],
    wikitext: text.slice(header[0].length),
  };
}

/**
 * A sampled page from `fixtures/upstream-wikitext/`, or nothing when the API
 * answered that the page is missing upstream.
 */
export function readSampledPage(json: string, file: string): RawPage | undefined {
  const payload: unknown = JSON.parse(json);
  if (typeof payload !== "object" || payload === null) throw new Error(`${file}: not a JSON object`);
  const { word, revid, timestamp, wikitext, missing } = payload as Record<string, unknown>;
  if (missing === true) return undefined;
  if (typeof word !== "string" || typeof revid !== "number" || typeof timestamp !== "string" || typeof wikitext !== "string") {
    throw new Error(`${file}: expected word, revid, timestamp and wikitext`);
  }
  return { wiki: RAW_PAGE_WIKI, title: word, revisionId: revid, timestamp, wikitext };
}

/**
 * Every raw page committed under `fixtures/`: the saved regression pages and the
 * sampled page cache. A title in both would be two revisions of one page, and
 * `rawPageSource` refuses that rather than picking one.
 */
export async function loadFixturePages(fixturesDir: string): Promise<RawPageSource> {
  const pages: RawPage[] = [];
  const saved = join(fixturesDir, "upstream-pages");
  for (const name of (await readdir(saved)).filter((file) => file.endsWith(".wikitext")).sort()) {
    pages.push(readSavedPage(await readFile(join(saved, name), "utf8"), name));
  }
  const sampled = join(fixturesDir, "upstream-wikitext");
  for (const name of (await readdir(sampled)).filter((file) => file.endsWith(".json")).sort()) {
    const page = readSampledPage(await readFile(join(sampled, name), "utf8"), name);
    if (page !== undefined) pages.push(page);
  }
  return rawPageSource(pages);
}
