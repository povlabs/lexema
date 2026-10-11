// What Lexema asks Wikidata for each name category (ADR 0032, #794), and how
// the answer becomes name items. One SPARQL query per category, so no single
// query reaches the query service's 60-second limit: the largest category is
// under 10,000 items. An item is kept only with an Italian label, an Italian
// description and an Italian Wikipedia page.

import { NAME_CATEGORIES, type NameCategory, type NameCategoryId } from "./nameCategories.js";
import { nameItem, type NameItem } from "./nameItem.js";

/** The Wikidata Query Service's SPARQL endpoint. */
export const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";

/** Sent with every query, as the Wikimedia User-Agent policy asks. */
export const USER_AGENT = "lexema-names/1 (https://lexema.fyi; https://github.com/povlabs/lexema)";

/** The triple patterns that make an item one of `category`. */
function membership(category: NameCategory): string {
  const path = category.subclasses ? "wdt:P31/wdt:P279*" : "wdt:P31";
  const population =
    "populationOver" in category && category.populationOver !== undefined
      ? `\n  ?item wdt:P1082 ?population . FILTER(?population > ${category.populationOver})`
      : "";
  const excluding =
    "excluding" in category && category.excluding !== undefined ? `\n  MINUS { ?item wdt:P31/wdt:P279* wd:${category.excluding} . }` : "";
  // Wikidata keeps a label every language shares under `mul` (the euro's
  // `euro`), and shows it as the Italian label where no `it` label is set.
  return `?item ${path} wd:${category.instanceOf} .${population}${excluding}
  ?article schema:about ?item ; schema:isPartOf <https://it.wikipedia.org/> .
  OPTIONAL { ?item rdfs:label ?itLabel . FILTER(LANG(?itLabel) = "it") }
  OPTIONAL { ?item rdfs:label ?mulLabel . FILTER(LANG(?mulLabel) = "mul") }
  BIND(COALESCE(?itLabel, ?mulLabel) AS ?label)
  FILTER(BOUND(?label))`;
}

/** Every item of `category` with an Italian label, an Italian description and an Italian Wikipedia page. */
export function categoryQuery(category: NameCategory): string {
  return `SELECT DISTINCT ?item ?label ?description WHERE {
  ${membership(category)}
  ?item schema:description ?description . FILTER(LANG(?description) = "it")
}`;
}

/** How many items of `category` have an Italian label and page, and how many of those also an Italian description. */
export function categoryCountQuery(category: NameCategory): string {
  return `SELECT (COUNT(DISTINCT ?item) AS ?items) (COUNT(DISTINCT ?described) AS ?described) WHERE {
  ${membership(category)}
  OPTIONAL { ?item schema:description ?description . FILTER(LANG(?description) = "it") BIND(?item AS ?described) }
}`;
}

/** One row of a SPARQL JSON answer. */
type Binding = Record<string, { type: string; value: string } | undefined>;

/** Sends `query` and returns its rows; `fetchImpl` is `fetch` unless a test passes its own. */
export async function runQuery(query: string, fetchImpl: typeof fetch = fetch, pause: (ms: number) => Promise<void> = (ms) => new Promise((done) => setTimeout(done, ms))): Promise<Binding[]> {
  const url = `${WIKIDATA_SPARQL}?${new URLSearchParams({ query, format: "json" })}`;
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

/** Every category's items, one query at a time, so the service is never asked twice at once. */
export async function fetchNameItems(fetchImpl: typeof fetch = fetch, log: (line: string) => void = () => {}): Promise<NameItem[]> {
  const items: NameItem[] = [];
  for (const category of NAME_CATEGORIES) {
    const found = itemsOf(category.id, await runQuery(categoryQuery(category), fetchImpl));
    log(`${category.id}: ${found.length}`);
    items.push(...found);
  }
  return items;
}
