// What one API request costs, in units (#148's table). A key's daily usage is
// the sum of these, recorded per key per day (src/api/usage.ts), ready for
// plans later. No handler states its own cost: every cost is read here.

/** Endpoints charged once per request, and how many units each costs. */
const PER_REQUEST = {
  lookup: 2,
  lemmatize: 1,
  exists: 1,
  inflect: 2,
  suggest: 3,
  nearby: 5,
  random: 2,
} as const;

/** Endpoints charged per word they are sent, and how many units each word costs. */
const PER_WORD = {
  "lookup/batch": 1,
} as const;

export type RequestPricedEndpoint = keyof typeof PER_REQUEST;
export type WordPricedEndpoint = keyof typeof PER_WORD;

/** Every endpoint of the API, as its path under `/v1/` names it. */
export type Endpoint = RequestPricedEndpoint | WordPricedEndpoint;

/** How an endpoint is priced. */
export type UnitWeight = { per: "request"; units: number } | { per: "word"; units: number };

/** The unit weight of every endpoint: one closed map, so no endpoint goes unpriced. */
export const UNIT_WEIGHT: Readonly<Record<Endpoint, UnitWeight>> = {
  ...(Object.fromEntries(Object.entries(PER_REQUEST).map(([name, units]) => [name, { per: "request", units }])) as Record<
    RequestPricedEndpoint,
    UnitWeight
  >),
  ...(Object.fromEntries(Object.entries(PER_WORD).map(([name, units]) => [name, { per: "word", units }])) as Record<
    WordPricedEndpoint,
    UnitWeight
  >),
};

export const ENDPOINTS = Object.keys(UNIT_WEIGHT) as Endpoint[];

/**
 * One answered request, as it is charged. A word-priced endpoint carries how
 * many words it was sent and a request-priced one carries nothing, so neither
 * can be charged the other way.
 */
export type Charge = { endpoint: RequestPricedEndpoint } | { endpoint: WordPricedEndpoint; words: number };

/** The units one request costs. */
export function unitCost(charge: Charge): number {
  return "words" in charge ? PER_WORD[charge.endpoint] * charge.words : PER_REQUEST[charge.endpoint];
}

/** Where every API path starts, on https://api.lexema.fyi. */
export const API_PREFIX = "/v1/";

/** The endpoint a path names, or undefined for any path that is not one. */
export function endpointOf(path: string): Endpoint | undefined {
  if (!path.startsWith(API_PREFIX)) return undefined;
  const name = path.slice(API_PREFIX.length);
  return ENDPOINTS.find((endpoint) => endpoint === name);
}
