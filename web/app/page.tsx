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
import { SEARCH_LIMITED_HEADER } from "../worker/rateLimit.ts";
import { FirstLoad, Limited, Outcome, Pending, SearchPage } from "./SearchPage";
import { firstQuery, type QueryParam } from "./params";
import { search } from "./db";

interface PageProps {
  searchParams: { q?: QueryParam };
}

export function generateMetadata({ searchParams }: PageProps) {
  const q = firstQuery(searchParams.q).trim();
  return { title: q ? `${q} — Lexema` : "Lexema — Italian dictionary search" };
}

/** The half that waits on D1, so the shell above it can flush before it does. */
async function Results({ raw }: { raw: string }) {
  return <Outcome raw={raw} attempt={await search(raw)} />;
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
