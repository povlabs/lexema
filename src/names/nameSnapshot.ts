// The committed snapshot of Wikidata's names (ADR 0032, #794):
// `names/wikidata-names.jsonl`, one name item per line. `pnpm run names:fetch`
// writes it from Wikidata, and `pnpm run load:names` writes the dictionary
// from it, so a refresh is a pull request whose diff is the names that
// changed. An item one category already gave is not written again, and the
// lines are in the order a spelling's name entries are shown: by category,
// then by item number, an older item first.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { categoryRank } from "./nameCategories.js";
import { itemNumber, nameItem, type NameItem, type NameItemSpec } from "./nameItem.js";

/** Where the snapshot is committed, from the repository root. */
export const NAME_SNAPSHOT_PATH = "names/wikidata-names.jsonl";

/** Whether `a` is shown before `b`: by category, then by item number. */
export const compareNameItems = (a: NameItem, b: NameItem): number =>
  categoryRank(a.category) - categoryRank(b.category) || itemNumber(a) - itemNumber(b);

/** `items` as the snapshot holds them: each item once, under the first category in list order that gave it, in shown order. */
export function snapshotOf(items: readonly NameItem[]): NameItem[] {
  const kept = new Map<string, NameItem>();
  for (const item of [...items].sort(compareNameItems)) if (!kept.has(item.item)) kept.set(item.item, item);
  return [...kept.values()];
}

/** The snapshot's text: one JSON object per line, keys in a fixed order, ending in a newline. */
export function snapshotText(items: readonly NameItem[]): string {
  return snapshotOf(items)
    .map(({ item, label, description, category }) => `${JSON.stringify({ item, label, description, category })}\n`)
    .join("");
}

/** The items of a snapshot's text, refused unless it is exactly what `snapshotText` writes for them. */
export function parseSnapshot(text: string): NameItem[] {
  const items = text
    .split("\n")
    .filter((line, index, lines) => line !== "" || index !== lines.length - 1)
    .map((line, index) => {
      try {
        return nameItem(JSON.parse(line) as NameItemSpec);
      } catch (error) {
        throw new Error(`${NAME_SNAPSHOT_PATH} line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  if (snapshotText(items) !== text) throw new Error(`${NAME_SNAPSHOT_PATH} is not in snapshot order, holds an item twice, or is not written as names:fetch writes it`);
  return items;
}

/** The committed snapshot's items, read from `root`. */
export async function readNameSnapshot(root: string = process.cwd()): Promise<NameItem[]> {
  return parseSnapshot(await readFile(resolve(root, NAME_SNAPSHOT_PATH), "utf8"));
}
