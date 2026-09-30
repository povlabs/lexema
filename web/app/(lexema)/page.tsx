// The search page. A server component: the query arrives in the URL, the D1
// read happens on the Worker, and the HTML that comes back already has the
// answer in it. No client-side fetching, so the page works before any
// JavaScript loads and a result is shareable by copying the address bar.
//
// The markup itself is in SearchPage.tsx, which knows nothing about D1. This
// file is the wiring: read the query, run the lookup, and put the two together
// behind a streaming boundary so the page can say it is searching.
//
// A search over the visitor's limit is decided before this runs, in
// worker/rateLimit.ts, which marks the request; a marked request renders the
// "too many searches" state and never reaches `search`.

import { headers } from "next/headers";
import { Suspense } from "react";
import { SEARCH_LIMITED_HEADER } from "@/worker/rateLimit.ts";
import { FirstLoad, Limited, Outcome, Pending, SearchPage } from "@/components/dictionary/SearchPage";
import type { Attempt } from "@/lib/dictionary/attempt.ts";
import { cardOf, HOME_CARD, linkPreview } from "@/lib/dictionary/card.ts";
import { firstQuery, pageTitle, type QueryParam, type TitleOutcome } from "@/lib/dictionary/params";
import { wordPage } from "@/lib/dictionary/wordPage.ts";
import { search, servedRelease, turnstile } from "@/lib/dictionary/db";
import { requestOrigin } from "@/lib/shared/requestOrigin.ts";

interface PageProps {
  searchParams: { q?: QueryParam };
}

/** What the tab's title says about a lookup's answer. */
function titleOutcome(attempt: Attempt): TitleOutcome {
  if (attempt.outcome === "not-found") return "not-found";
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
      release: servedRelease(),
      origin: requestOrigin(requestHeaders),
    }),
  };
}

/** The half that waits on D1, so the shell above it can flush before it does. */
async function Results({ raw }: { raw: string }) {
  return <Outcome raw={raw} attempt={await search(raw)} siteKey={turnstile()?.siteKey} />;
}

export default async function Page({ searchParams }: PageProps) {
  const raw = firstQuery(searchParams.q);
  const limited = (await headers()).has(SEARCH_LIMITED_HEADER);

  return (
    <SearchPage raw={raw}>
      {raw.trim() === "" ? (
        <FirstLoad />
      ) : limited ? (
        <Limited raw={raw} />
      ) : (
        // The loading state a server-rendered page can honestly have: React
        // streams `Pending` in the result's place and replaces it when the
        // lookup answers. No client fetching, and nothing to get wrong if
        // JavaScript never arrives.
        <Suspense fallback={<Pending raw={raw} />}>
          <Results raw={raw} />
        </Suspense>
      )}
    </SearchPage>
  );
}
