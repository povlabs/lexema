// Which of the dictionary's requests the per-visitor limits count, and what
// each says once its count is spent (#128). worker/shared/rateLimit.ts counts.

import type { ReportAnswer } from "@/lib/dictionary/report.ts";
import type { SuggestAnswer } from "@/lib/dictionary/suggestAnswer.ts";
import type { Counted, Counter, DictionaryLimit } from "../shared/rateLimit.ts";

/** The body each of the dictionary's JSON-answered limits is blocked with. */
export interface DictionaryBodies {
  suggest: SuggestAnswer;
  report: ReportAnswer;
  "report-open": ReportAnswer;
}

/** A counted dictionary request, each limit with only its own answer. */
export type DictionaryCounted = Counted<DictionaryLimit, DictionaryBodies>;

const SUGGEST_LIMITED: SuggestAnswer = { outcome: "limited" };
const REPORT_LIMITED: ReportAnswer = { outcome: "limited" };

const SUGGEST: DictionaryCounted = { limit: "suggest", blocked: { by: "json", body: SUGGEST_LIMITED } };
const REPORT: DictionaryCounted = { limit: "report", blocked: { by: "json", body: REPORT_LIMITED } };
const REPORT_OPEN: DictionaryCounted = { limit: "report-open", blocked: { by: "json", body: REPORT_LIMITED } };
const SEARCH: DictionaryCounted = { limit: "search", blocked: { by: "page" } };

/**
 * The path a route handler answers a request on. vinext serves every route
 * under its own path and again with one `.rsc` appended (`stripRscSuffix`,
 * vinext's server/app-rsc-cache-busting.js), so `/report/open.rsc` reaches
 * the `/report/open` handler; a limit that matched only the bare path let it
 * through uncounted (#621).
 */
const routePathOf = (pathname: string): string => (pathname.endsWith(".rsc") ? pathname.slice(0, -".rsc".length) : pathname);

/**
 * Which limit a dictionary request counts against, or none.
 *
 * `/suggest` is a suggestion. Anything else carrying a non-empty `q` is a
 * search: the page runs its lookup for the first `q` when its trimmed value is
 * not empty (app/(lexema)/page.tsx), and that holds for the HTML request and for an RSC
 * request for the same URL alike. Counting every other path with a `q` too
 * (`/licence?q=…`, a mistyped path) costs a reader nothing and means no
 * spelling of the page's path that vinext normalizes back to `/` gets past the
 * limit. The home page without a query and static assets are never counted;
 * assets do not even reach the Worker. The route handlers are matched on
 * `routePathOf`, so their `.rsc` spellings count as they do.
 */
export const dictionaryLimitOf: Counter<DictionaryLimit, DictionaryBodies> = (url) => {
  const path = routePathOf(url.pathname);
  if (path === "/suggest") return SUGGEST;
  // A report's hourly allowance is counted over stored reports (lib/dictionary/report.ts);
  // this binding only stops a burst before the database is touched.
  if (path === "/report") return REPORT;
  // Opening the box stores a token; counted apart so opening does not use up sending.
  if (path === "/report/open") return REPORT_OPEN;
  if ((url.searchParams.get("q") ?? "").trim() !== "") return SEARCH;
  return undefined;
};
