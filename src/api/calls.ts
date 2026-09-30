// What one API request counts, in calls (Huey, #183 and #161): every endpoint
// counts 1 call, and `lookup/batch` counts 1 call per word it is sent. A key's
// daily usage is the sum of these, recorded per key per day
// (src/api/usage.ts). No handler states its own count: every count is read here.

/** How an endpoint is counted: 1 call per request, or 1 call per word it is sent. */
export type CallBasis = "request" | "word";

/** How every endpoint is counted: one closed map, so no endpoint goes uncounted. */
export const CALL_BASIS = {
  lookup: "request",
  lemmatize: "request",
  exists: "request",
  inflect: "request",
  suggest: "request",
  nearby: "request",
  random: "request",
  "lookup/batch": "word",
} as const satisfies Record<string, CallBasis>;

/** Every endpoint of the API, as its path under `/v1/` names it. */
export type Endpoint = keyof typeof CALL_BASIS;

/** The endpoints counted on one basis. */
export type EndpointCountedPer<B extends CallBasis> = { [E in Endpoint]: (typeof CALL_BASIS)[E] extends B ? E : never }[Endpoint];

export const ENDPOINTS = Object.keys(CALL_BASIS) as Endpoint[];

/** Whether an endpoint counts 1 call per word it is sent. */
export const countedPerWord = (endpoint: Endpoint): endpoint is EndpointCountedPer<"word"> => CALL_BASIS[endpoint] === "word";

/**
 * One answered request, as it is charged. A word-counted endpoint carries how
 * many words it was sent and a request-counted one carries nothing, so neither
 * can be charged the other way.
 */
export type Charge = { endpoint: EndpointCountedPer<"request"> } | { endpoint: EndpointCountedPer<"word">; words: number };

/** The calls one answered request counts. */
export function callCost(charge: Charge): number {
  return "words" in charge ? charge.words : 1;
}

/** Where every API path starts, on https://api.lexema.fyi. */
export const API_PREFIX = "/v1/";

/** The endpoint a path names, or undefined for any path that is not one. */
export function endpointOf(path: string): Endpoint | undefined {
  if (!path.startsWith(API_PREFIX)) return undefined;
  const name = path.slice(API_PREFIX.length);
  return ENDPOINTS.find((endpoint) => endpoint === name);
}
