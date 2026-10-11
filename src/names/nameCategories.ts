// The kinds of proper name Lexema takes from Wikidata (ADR 0032, #794): the
// closed list Huey ruled on 2026-10-11, in chat, quoted on
// https://github.com/povlabs/lexema/issues/794. Asked to add every category
// below but people, about 49,000 names, he answered "yes all of them". People
// were counted first, 9,330, and he answered "yes add them"
// (https://github.com/povlabs/lexema/issues/794#issuecomment-6106840562).
//
// Each category is one Wikidata class an item is an instance of (P31), with or
// without its subclasses (P279) as the counts Huey was shown were read. The
// cities alone are held to a population, and people alone to a number of
// Wikipedias. The list order is the order a spelling's name entries are shown
// in, so a country comes before a river, a river before a club, and every
// place or group before a person.

/** One kind of name: what it is called, and how Wikidata says an item is one. */
export interface NameCategory {
  /** Stable, stored on each name entry: `country`. */
  readonly id: string;
  /** What the category is, in plain English, for reports. */
  readonly title: string;
  /** The Wikidata class an item is an instance of (P31). */
  readonly instanceOf: `Q${number}`;
  /** Whether an instance of a subclass (P279) of the class counts too. */
  readonly subclasses: boolean;
  /** The population an item must state above (P1082), or none. */
  readonly populationOver?: number;
  /** A class whose instances, subclasses included, are left out, or none. */
  readonly excluding?: `Q${number}`;
  /** How many Wikipedias, at least, must have a page on an item, or none. */
  readonly wikipediasAtLeast?: number;
  /** Items the category takes whatever their number of Wikipedias, each still held to every other rule. */
  readonly alsoItems?: readonly `Q${number}`[];
}

/** Every category, in the order a spelling's name entries are shown. */
export const NAME_CATEGORIES = [
  { id: "country", title: "countries", instanceOf: "Q6256", subclasses: false },
  { id: "continent", title: "continents", instanceOf: "Q5107", subclasses: true },
  { id: "sea", title: "seas", instanceOf: "Q165", subclasses: true },
  { id: "river", title: "rivers", instanceOf: "Q4022", subclasses: false },
  { id: "lake", title: "lakes", instanceOf: "Q23397", subclasses: true },
  { id: "mountain", title: "mountains", instanceOf: "Q8502", subclasses: true },
  { id: "island", title: "islands", instanceOf: "Q23442", subclasses: false },
  { id: "comune", title: "Italian comuni", instanceOf: "Q747074", subclasses: false },
  { id: "city", title: "cities over 100,000 people", instanceOf: "Q515", subclasses: true, populationOver: 100_000 },
  { id: "international-organization", title: "international organisations", instanceOf: "Q484652", subclasses: true },
  { id: "political-party", title: "political parties", instanceOf: "Q7278", subclasses: true },
  { id: "listed-company", title: "listed companies", instanceOf: "Q891723", subclasses: true },
  { id: "football-club", title: "football clubs", instanceOf: "Q476028", subclasses: true },
  // A programming or markup language is a computer language (Q629206), not a language people speak.
  { id: "language", title: "languages", instanceOf: "Q34770", subclasses: true, excluding: "Q629206" },
  { id: "currency", title: "currencies", instanceOf: "Q8142", subclasses: true },
  { id: "holiday", title: "holidays and festivals", instanceOf: "Q1445650", subclasses: true },
  // Well-known people: a page in 50 or more Wikipedias, plus Alex Zanardi
  // (Q173188, 35 Wikipedias), the one person a news test text names that the
  // 50 leave out (#794).
  { id: "person", title: "well-known people", instanceOf: "Q5", subclasses: false, wikipediasAtLeast: 50, alsoItems: ["Q173188"] },
] as const satisfies readonly NameCategory[];

/** A category's id: `country`. */
export type NameCategoryId = (typeof NAME_CATEGORIES)[number]["id"];

/** Where `id` stands in the list: a lower place is shown first. */
export const categoryRank = (id: NameCategoryId): number => NAME_CATEGORIES.findIndex((category) => category.id === id);

/** Whether `id` names a category on the list. */
export const isNameCategoryId = (id: string): id is NameCategoryId => NAME_CATEGORIES.some((category) => category.id === id);
