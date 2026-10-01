// The `raw_page` rows a seed writes: one per page revision that a recovered
// definition (#28) or a hidden record (#382) was read from, each written the
// first time a row needs it, so both layers point at one row per page.

import type { RawPage } from "../source/rawPage.js";
import type { ImportStatement } from "./importRelease.js";

/** A page revision, without its text. */
export type PageRevision = Omit<RawPage, "wikitext">;

export class RawPageRows {
  private readonly ids = new Map<string, number>();

  constructor(
    private readonly insert: ImportStatement,
    private readonly rows: { raw_page: number },
  ) {}

  /** The page's `page_id`, writing its row the first time it is asked for. */
  idOf(releaseId: string, page: PageRevision): number {
    const held = this.ids.get(page.title);
    if (held !== undefined) return held;
    const pageId = this.ids.size + 1;
    this.insert.run(pageId, releaseId, page.wiki, page.title, page.revisionId, page.timestamp);
    this.rows.raw_page += 1;
    this.ids.set(page.title, pageId);
    return pageId;
  }
}
