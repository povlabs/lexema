// The code beside each guide page of the docs (board 31b, Huey on #177): a
// request, and under it what the API answers it with. Every answer is the
// API's own for that request, sent by the sender it names;
// web/test/developers.test.tsx sends each one to `handleApi` and fails when a
// body, a status or a header drifts. Where a page prints only part of an
// answer, it folds the whole answer (`fold`), never a shorter copy of it.

import { ENDPOINT_REFERENCE, LOOKUP_EXAMPLE, fold, formatJson, type ApiRequest, type Fold, type QueryStyle } from "./apiReference.ts";
import type { Guide } from "./docsPages.ts";
import { ANDAVANO_AS_VERB, SALE } from "./guideAnswers.ts";

/** `/exists`'s example: a short answer, printed whole. */
const EXISTS = ENDPOINT_REFERENCE.exists.examples[0];

/**
 * The requests a minute of the key the examples are sent with. The headers
 * printed are those of the key's first request in a minute, 20 seconds into
 * it; the `429`'s, of the request after its limit, in that same second.
 */
export const EXAMPLE_PER_MINUTE = 60;

/**
 * Who sends a guide's request. `key`: a valid key, its minute's first
 * request. `no-key`: no `X-API-Key`. `unknown-key`: a key Lexema never
 * issued. `spent-key`: a valid key past its `EXAMPLE_PER_MINUTE`.
 */
export type Sender = "key" | "no-key" | "unknown-key" | "spent-key";

/** What an answer prints: its body, folded or whole, or its rate-limit headers and any body. */
export type Shown =
  | { kind: "body"; body: unknown; fold?: Fold }
  | { kind: "headers"; headers: readonly (readonly [string, string])[]; body?: unknown };

export interface GuideAnswer {
  sender: Sender;
  status: 200 | 400 | 401 | 429;
  shown: Shown;
}

export interface GuidePanel {
  /** The request panel's name: `Your first request` on the introduction. */
  requestTitle: "Your first request" | "Request";
  request: ApiRequest;
  /** The answers, one tab each; the first is sent with a valid key. */
  answers: readonly [GuideAnswer & { sender: "key" }, ...GuideAnswer[]];
}

/** The rate-limit headers of a key's request in its minute, as the API sends them. */
const limitHeaders = (remaining: number): [string, string][] => [
  ["RateLimit-Limit", String(EXAMPLE_PER_MINUTE)],
  ["RateLimit-Remaining", String(remaining)],
  ["RateLimit-Reset", "40"],
];

const MISSING_KEY = { error: { code: "missing_key", message: "Send your API key in the X-API-Key header." } };
const INVALID_KEY = { error: { code: "invalid_key", message: "This API key is not valid." } };
const RATE_LIMITED = {
  error: { code: "rate_limited", message: `This key may make ${EXAMPLE_PER_MINUTE} requests a minute. Retry after 40 s.` },
};

/** Each guide page's request and answers. */
export const GUIDE_PANELS: Readonly<Record<Guide, GuidePanel>> = {
  introduction: {
    requestTitle: "Your first request",
    request: { path: LOOKUP_EXAMPLE.path },
    answers: [
      {
        sender: "key",
        status: 200,
        shown: {
          kind: "body",
          body: LOOKUP_EXAMPLE.response,
          fold: {
            query: "whole",
            release_id: "whole",
            results: [{ word: "whole", pos: "whole", pos_title: "whole", definitions: "closed", forms: "closed", attribution: "closed" }],
          },
        },
      },
    ],
  },
  authentication: {
    requestTitle: "Request",
    request: { path: EXISTS.path },
    answers: [
      { sender: "key", status: 200, shown: { kind: "body", body: EXISTS.response } },
      { sender: "unknown-key", status: 401, shown: { kind: "body", body: INVALID_KEY } },
    ],
  },
  "units-and-limits": {
    requestTitle: "Request",
    request: { path: "lookup?q=sale" },
    answers: [
      { sender: "key", status: 200, shown: { kind: "headers", headers: limitHeaders(EXAMPLE_PER_MINUTE - 1) } },
      {
        sender: "spent-key",
        status: 429,
        shown: { kind: "headers", headers: [...limitHeaders(0), ["Retry-After", "40"]], body: RATE_LIMITED },
      },
    ],
  },
  errors: {
    requestTitle: "Request",
    request: { path: "lookup?q=sale&limit_definitions=0" },
    answers: [
      {
        sender: "key",
        status: 400,
        shown: {
          kind: "body",
          body: { error: { code: "invalid_parameter", message: 'limit_definitions must be a positive integer; got "0".' } },
        },
      },
      { sender: "no-key", status: 401, shown: { kind: "body", body: MISSING_KEY } },
      { sender: "spent-key", status: 429, shown: { kind: "body", body: RATE_LIMITED } },
    ],
  },
  "grammar-values": {
    requestTitle: "Request",
    request: { path: "lookup?q=andavano&pos=verb&mood=indicativo&tense=imperfetto" },
    answers: [
      {
        sender: "key",
        status: 200,
        shown: {
          kind: "body",
          body: ANDAVANO_AS_VERB,
          fold: {
            query: "whole",
            release_id: "whole",
            results: [{ word: "whole", pos: "whole", match: "whole", definitions: "closed", forms: "closed", attribution: "closed" }],
          },
        },
      },
    ],
  },
  attribution: {
    requestTitle: "Request",
    request: { path: "lookup?q=sale" },
    answers: [
      {
        sender: "key",
        status: 200,
        shown: {
          kind: "body",
          body: SALE,
          fold: { query: "whole", release_id: "whole", results: [{ word: "whole", pos: "whole", attribution: "whole" }, "closed"] },
        },
      },
    ],
  },
};

/**
 * How a guide prints its request's query: in the address when it has one
 * parameter, as board 31b draws the introduction's; each apart when it has
 * more, as board 31 draws an endpoint's, so no line runs long.
 */
export const queryStyleOf = (request: ApiRequest): QueryStyle =>
  new URLSearchParams(request.path.split("?")[1] ?? "").size > 1 ? "separate" : "inline";

/** An answer as its panel prints it, lines no wider than `width` where the JSON allows. */
export function printedAnswer({ shown }: GuideAnswer, width: number): string {
  if (shown.kind === "body") return formatJson(shown.fold === undefined ? shown.body : fold(shown.body, shown.fold), width);
  const headers = shown.headers.map(([name, value]) => `${name}: ${value}`).join("\n");
  return shown.body === undefined ? headers : `${headers}\n\n${formatJson(shown.body, width)}`;
}
