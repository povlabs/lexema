// The search page. A server component: the query arrives in the URL, the D1
// read happens on the Worker, and the HTML that comes back already has the
// answer in it. No client-side fetching, so the page works before any
// JavaScript loads and a result is shareable by copying the address bar.
//
// The markup itself is in SearchPage.tsx, which knows nothing about D1. This
// file is the wiring: read the query, run the lookup, and put the two together.
//
// There is no streaming boundary around the lookup (#115). React would flush a
// loading line in the result's place and send the result later, hidden, for an
// inline script to swap in; with JavaScript off that script never runs and the
// reader sees only the loading line. So the HTML waits for the lookup and
// carries the result in place, visible with or without JavaScript.
//
// A search over the visitor's limit is decided before this runs, in
// worker/rateLimit.ts, which marks the request; a marked request renders the
// "too many searches" state and never reaches `search`.

import { headers } from "next/headers";
import { SEARCH_LIMITED_HEADER } from "@/worker/rateLimit.ts";
import { FirstLoad, Limited, Outcome, SearchPage } from "@/components/dictionary/SearchPage";
import type { Attempt } from "@/lib/dictionary/attempt.ts";
import { cardOf, HOME_CARD, linkPreview } from "@/lib/dictionary/card.ts";
import { firstQuery, pageTitle, type QueryParam, type TitleOutcome } from "@/lib/dictionary/params";
import { wordPage } from "@/lib/dictionary/wordPage.ts";
import { search, servedVersion, turnstile } from "@/lib/dictionary/db";
import { requestOrigin } from "@/lib/shared/requestOrigin.ts";

interface PageProps {
  searchParams: { q?: QueryParam };
}

/** What the tab's title says about a lookup's answer. */
function titleOutcome(attempt: Attempt): TitleOutcome {
  if (attempt.outcome === "not-found") return "not-found";
  if (attempt.outcome === "declared-lemma") return { found: attempt.page.headword };
  if (attempt.outcome !== "found") return undefined;
  // A searched expression's page is titled as typed (#214).
  const searched = attempt.query.raw.trim();
  return { found: attempt.route.kind === "phrase" ? searched : wordPage(searched, attempt.readings).headword };
}

/**
 * The tab's title, and the tags a shared link's preview reads (#304): a word
 * found is previewed with its own card, and everything else with the home card.
 */
export async function generateMetadata({ searchParams }: PageProps) {
  const raw = firstQuery(searchParams.q);
  const requestHeaders = await headers();
  // The card's address names the served version (#368), read beside the
  // lookup rather than after it, and memoised with it.
  const version = servedVersion();
  // A search over the visitor's limit is not run for its title either. The
  // same memoised search the result renders from (db.ts).
  const attempt = raw.trim() === "" || requestHeaders.has(SEARCH_LIMITED_HEADER) ? undefined : await search(raw);
  const title = pageTitle(raw, attempt === undefined ? undefined : titleOutcome(attempt));
  return {
    title,
    ...linkPreview({
      title,
      card: attempt === undefined ? HOME_CARD : cardOf(attempt),
      word: raw,
      version: await version,
      origin: requestOrigin(requestHeaders),
    }),
  };
}

export default async function Page({ searchParams }: PageProps) {
  const raw = firstQuery(searchParams.q);
  const limited = (await headers()).has(SEARCH_LIMITED_HEADER);

  // The search field names the served version in its suggestion requests
  // (#368): the one generateMetadata read, memoised.
  return (
    <SearchPage raw={raw} version={await servedVersion()}>
      {raw.trim() === "" ? (
        <FirstLoad />
      ) : limited ? (
        <Limited raw={raw} />
      ) : (
        <Outcome raw={raw} attempt={await search(raw)} siteKey={turnstile()?.siteKey} />
      )}
    </SearchPage>
  );
}
