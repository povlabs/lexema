// What Lexema asks Wikidata for each name category (ADR 0032, #794), and how
// the answer becomes name items. One SPARQL query per category, so no single
// query reaches the query service's 60-second limit: the largest category is
// under 10,000 items. An item is kept only with an Italian label, an Italian
// description and an Italian Wikipedia page.
//
// A category held to a number of Wikipedias (people) is asked of the QLever
// mirror of Wikidata instead: counting each person's Wikipedia pages runs past
// query.wikidata.org's limit, and QLever answers the whole query, labels and
// descriptions included, in seconds. The mirror is a recent copy of Wikidata,
// not the live data.

import { NAME_CATEGORIES, type NameCategory, type NameCategoryId } from "./nameCategories.js";
import { nameItem, type NameItem } from "./nameItem.js";

/** The Wikidata Query Service's SPARQL endpoint. */
export const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";

/** The QLever mirror of Wikidata's SPARQL endpoint. */
export const QLEVER_WIKIDATA_SPARQL = "https://qlever.dev/api/wikidata";

/** Sent with every query, as the Wikimedia User-Agent policy asks. */
export const USER_AGENT = "lexema-names/1 (https://lexema.fyi; https://github.com/povlabs/lexema)";

/** The prefixes query.wikidata.org predefines; QLever knows them only when a query states them. */
const PREFIXES = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX schema: <http://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
`;

/** The number of Wikipedias `category` holds an item to, or undefined when it holds it to none. */
const wikipediasOf = (category: NameCategory): number | undefined => ("wikipediasAtLeast" in category ? category.wikipediasAtLeast : undefined);

/** The endpoint `category` is asked of: QLever for a category held to a number of Wikipedias. */
export const endpointOf = (category: NameCategory): string => (wikipediasOf(category) === undefined ? WIKIDATA_SPARQL : QLEVER_WIKIDATA_SPARQL);

/**
 * The pattern that binds `?item` to an instance of `category` with pages in at
 * least `wikipedias` Wikipedias, or to one of its `alsoItems`. An item's
 * sitelink count counts every wiki, so it bounds the Wikipedias from above and
 * is read first to keep the count small. QLever compares that stored number
 * wrongly in a FILTER (no item passes), so it is copied with `+ 0` first.
 */
function wikipediasPattern(category: NameCategory, wikipedias: number): string {
  const also = "alsoItems" in category && category.alsoItems !== undefined && category.alsoItems.length > 0
    ? ` UNION {
    VALUES ?item { ${category.alsoItems.map((item) => `wd:${item}`).join(" ")} }
    ?item wdt:P31 wd:${category.instanceOf} .
  }`
    : "";
  return `{
    SELECT ?item WHERE {
      ?item wdt:P31 wd:${category.instanceOf} .
      ?item wikibase:sitelinks ?links . BIND(?links + 0 AS ?linkCount) FILTER(?linkCount >= ${wikipedias})
      ?page schema:about ?item ; schema:isPartOf ?wiki . FILTER(STRENDS(STR(?wiki), ".wikipedia.org/"))
    } GROUP BY ?item HAVING (COUNT(DISTINCT ?wiki) >= ${wikipedias})
  }${also}`;
}

/** The triple patterns that make an item one of `category`. */
function membership(category: NameCategory): string {
  const path = category.subclasses ? "wdt:P31/wdt:P279*" : "wdt:P31";
  const wikipedias = wikipediasOf(category);
  const instance = wikipedias === undefined ? `?item ${path} wd:${category.instanceOf} .` : wikipediasPattern(category, wikipedias);
  const population =
    "populationOver" in category && category.populationOver !== undefined
      ? `\n  ?item wdt:P1082 ?population . FILTER(?population > ${category.populationOver})`
      : "";
  const excluding =
    "excluding" in category && category.excluding !== undefined ? `\n  MINUS { ?item wdt:P31/wdt:P279* wd:${category.excluding} . }` : "";
  // Wikidata keeps a label every language shares under `mul` (the euro's
  // `euro`), and shows it as the Italian label where no `it` label is set.
  return `${instance}${population}${excluding}
  ?article schema:about ?item ; schema:isPartOf <https://it.wikipedia.org/> .
  OPTIONAL { ?item rdfs:label ?itLabel . FILTER(LANG(?itLabel) = "it") }
  OPTIONAL { ?item rdfs:label ?mulLabel . FILTER(LANG(?mulLabel) = "mul") }
  BIND(COALESCE(?itLabel, ?mulLabel) AS ?label)
  FILTER(BOUND(?label))`;
}

/** Every item of `category` with an Italian label, an Italian description and an Italian Wikipedia page. */
export function categoryQuery(category: NameCategory): string {
  return `${PREFIXES}SELECT DISTINCT ?item ?label ?description WHERE {
  ${membership(category)}
  ?item schema:description ?description . FILTER(LANG(?description) = "it")
}`;
}

/** How many items of `category` have an Italian label and page, and how many of those also an Italian description. */
export function categoryCountQuery(category: NameCategory): string {
  return `${PREFIXES}SELECT (COUNT(DISTINCT ?item) AS ?items) (COUNT(DISTINCT ?described) AS ?described) WHERE {
  ${membership(category)}
  OPTIONAL { ?item schema:description ?description . FILTER(LANG(?description) = "it") BIND(?item AS ?described) }
}`;
}

/** One row of a SPARQL JSON answer. */
type Binding = Record<string, { type: string; value: string } | undefined>;

/** Sends `query` to `endpoint` and returns its rows; `fetchImpl` is `fetch` unless a test passes its own. */
export async function runQuery(
  query: string,
  fetchImpl: typeof fetch = fetch,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((done) => setTimeout(done, ms)),
  endpoint: string = WIKIDATA_SPARQL,
): Promise<Binding[]> {
  const url = `${endpoint}?${new URLSearchParams({ query, format: "json" })}`;
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetchImpl(url, { headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT } });
    const text = await response.text();
    if (response.ok) {
      // A query that runs out of time mid-answer still answers 200, its JSON cut off by the error text.
      const rows = parsedRows(text);
      if (rows !== undefined) return rows;
      if (attempt >= 4) throw new Error(`Wikidata's answer is not whole JSON after ${attempt} tries: ${text.slice(-300)}`);
    } else if (attempt >= 4 || (response.status !== 429 && response.status < 500)) {
      // 429 and 5xx are the service asking for a pause; anything else is the query's fault.
      throw new Error(`Wikidata answered ${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
    }
    await pause(5_000 * attempt);
  }
}

/** The rows of a SPARQL JSON answer, or undefined when the text is not one whole answer. */
function parsedRows(text: string): Binding[] | undefined {
  try {
    const rows = (JSON.parse(text) as { results?: { bindings?: Binding[] } }).results?.bindings;
    return Array.isArray(rows) ? rows : undefined;
  } catch {
    return undefined;
  }
}

const ITEM_URI = /^http:\/\/www\.wikidata\.org\/entity\/(Q[1-9]\d*)$/;

/** The name items of one category's answer, each once. A row that is not a whole item is refused. */
export function itemsOf(category: NameCategoryId, rows: readonly Binding[]): NameItem[] {
  const seen = new Map<string, NameItem>();
  for (const row of rows) {
    const qid = ITEM_URI.exec(row.item?.value ?? "")?.[1];
    if (qid === undefined) throw new Error(`a ${category} row names no item: ${JSON.stringify(row)}`);
    // An item with two Italian labels or descriptions keeps the first the service gives.
    if (!seen.has(qid)) seen.set(qid, nameItem({ item: qid as NameItem["item"], label: row.label?.value ?? "", description: row.description?.value ?? "", category }));
  }
  return [...seen.values()];
}

/** The items of `categories`, every category unless a caller names some, one query at a time, so no service is asked twice at once. */
export async function fetchNameItems(
  fetchImpl: typeof fetch = fetch,
  log: (line: string) => void = () => {},
  categories: readonly NameCategory[] = NAME_CATEGORIES,
): Promise<NameItem[]> {
  const items: NameItem[] = [];
  for (const category of categories) {
    const found = itemsOf(category.id as NameCategoryId, await runQuery(categoryQuery(category), fetchImpl, undefined, endpointOf(category)));
    log(`${category.id}: ${found.length}`);
    items.push(...found);
  }
  return items;
}
