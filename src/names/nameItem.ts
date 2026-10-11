// One proper name from Wikidata (ADR 0032, #794): an item, its Italian label,
// its Italian description and the category that admitted it. `nameItem` is
// the only way to make one, so an item without a label or a description, or
// of a category off the list, is not a value the dictionary can hold.

import { isNameCategoryId, type NameCategoryId } from "./nameCategories.js";

/** What a name item is made from; `nameItem` checks it. */
export interface NameItemSpec {
  /** The Wikidata item: `Q794`. */
  item: `Q${number}`;
  /** Its Italian label, as Wikidata states it: `Iran`. */
  label: string;
  /** Its Italian description, as Wikidata states it: `stato dell'Asia occidentale`. */
  description: string;
  category: NameCategoryId;
}

declare const checked: unique symbol;

/** A name item `nameItem` checked; no other value has this type. */
export type NameItem = Readonly<NameItemSpec> & { readonly [checked]: true };

/** Why a spec is not a name item. */
export class InvalidNameItem extends Error {
  override readonly name = "InvalidNameItem";
}

const ITEM = /^Q[1-9]\d*$/;

const blank = (text: string): boolean => text.trim() === "" || text.trim() !== text;

export function nameItem(spec: NameItemSpec): NameItem {
  const refuse = (why: string): never => {
    throw new InvalidNameItem(`name item ${JSON.stringify(spec.item)}: ${why}`);
  };
  if (!ITEM.test(spec.item)) refuse("not a Wikidata item id");
  if (blank(spec.label)) refuse("its label is empty or has surrounding spaces");
  if (blank(spec.description)) refuse("its description is empty or has surrounding spaces");
  if (!isNameCategoryId(spec.category)) refuse(`${spec.category} is not a name category`);
  return Object.freeze({ item: spec.item, label: spec.label, description: spec.description, category: spec.category }) as NameItem;
}

/** The item's number, for ordering: `Q794` is 794. */
export const itemNumber = (item: Pick<NameItem, "item">): number => Number(item.item.slice(1));

/** An item's page on Wikidata, which a name entry's *Fonte* link and its API credit open. */
export const wikidataItemUrl = (item: `Q${number}`): string => `https://www.wikidata.org/wiki/${item}`;
