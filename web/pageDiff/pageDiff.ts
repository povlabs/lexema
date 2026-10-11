// What a change did to the word pages (#808): every word page rendered at a
// base commit and at a head commit, compared word for word.
//
// A snapshot names each word that has a page and the SHA-256 of the page's
// markup. A word with no page at a commit (not found, refused, failed) is not
// in that commit's snapshot, so a word is added when only the head has its
// page and removed when only the base has it.

/** One word's rendered page, as a snapshot line holds it. */
export interface RenderedPage {
  word: string;
  /** SHA-256 of the page's markup, in hex. */
  sha256: string;
}

/** Every word page of one commit, by word. */
export class PageSnapshot {
  private constructor(private readonly pages: ReadonlyMap<string, string>) {}

  /** The pages, each word once; a word given twice is refused, as a render never writes one twice. */
  static of(pages: Iterable<RenderedPage>): PageSnapshot {
    const byWord = new Map<string, string>();
    for (const { word, sha256 } of pages) {
      if (byWord.has(word)) throw new Error(`the snapshot names ${JSON.stringify(word)} twice`);
      byWord.set(word, sha256);
    }
    return new PageSnapshot(byWord);
  }

  /** A snapshot file: one JSON `RenderedPage` per line. */
  static parse(text: string): PageSnapshot {
    return PageSnapshot.of(
      text
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as RenderedPage),
    );
  }

  get size(): number {
    return this.pages.size;
  }

  words(): string[] {
    return [...this.pages.keys()];
  }

  digestOf(word: string): string | undefined {
    return this.pages.get(word);
  }
}

const byWord = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The pages a change touched: compared on both sides, changed, added and removed. */
export class PageDiff {
  private constructor(
    /** Words with a page at both commits. */
    readonly compared: number,
    readonly changed: readonly string[],
    readonly added: readonly string[],
    readonly removed: readonly string[],
  ) {}

  static between(base: PageSnapshot, head: PageSnapshot): PageDiff {
    let compared = 0;
    const changed: string[] = [];
    const added: string[] = [];
    for (const word of head.words()) {
      const before = base.digestOf(word);
      if (before === undefined) added.push(word);
      else {
        compared += 1;
        if (before !== head.digestOf(word)) changed.push(word);
      }
    }
    const removed = base.words().filter((word) => head.digestOf(word) === undefined);
    return new PageDiff(compared, changed.sort(byWord), added.sort(byWord), removed.sort(byWord));
  }

  get unchanged(): number {
    return this.compared - this.changed.length;
  }

  /** The summary a pull request posts, in Markdown. */
  summary(base: string, head: string, seed: string): string {
    const list = (title: string, words: readonly string[]) =>
      words.length === 0 ? [] : ["", `**${title} (${words.length}):** ${words.join(", ")}`];
    return [
      `### Word page render diff`,
      "",
      `Base \`${base}\`, head \`${head}\`, seed \`${seed}\`.`,
      "",
      "| Pages | Count |",
      "|---|---:|",
      `| compared | ${this.compared} |`,
      `| changed | ${this.changed.length} |`,
      `| added | ${this.added.length} |`,
      `| removed | ${this.removed.length} |`,
      ...list("Changed", this.changed),
      ...list("Added", this.added),
      ...list("Removed", this.removed),
    ].join("\n");
  }
}
