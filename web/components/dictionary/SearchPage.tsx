// The page's own markup, with no database in it.
//
// Split from `page.tsx` so every state this page can be in is a value away
// rather than a running Worker away: `web/test/page.test.tsx` renders these
// components to HTML over an imported fixture release, and that test runs in CI
// with no archive and no D1. What `page.tsx` adds is where the data comes from.
//
// The interactive parts are client components on Base UI (ADR 0010): the
// search form, whose suggestion list answers keystrokes (`SearchField.tsx`),
// the mood tabs over a conjugation (`MoodTabs.tsx`), and the one `+ more`
// (`More.tsx`). The form is still a plain GET form, every state is decided by
// the URL, and every mood's table and everything `+ more` reveals is in the
// HTML the server sends.

import type { ReactNode } from "react";
import type { Attempt } from "@/lib/dictionary/attempt.ts";
import { SearchField } from "./SearchField";
import { SiteHeader } from "./SiteHeader";
import { NotFound } from "./NotFound";
import { PhraseView } from "./Phrase";
import { WordView } from "./Word";
import { phrasePage } from "@/lib/dictionary/phrasePage.ts";
import { wordPage } from "@/lib/dictionary/wordPage.ts";
import { SITE_NAME, SITE_PRONUNCIATION, SITE_TAGLINE } from "@/lib/dictionary/params.ts";
import {
  ERROR,
  HOME_NAME,
  HOME_PRONUNCIATION,
  HOME_TAGLINE,
  SHELL_CENTRED,
  SHELL_TOP,
  TRY_CHIP,
  TRY_LABEL,
  TRY_ROW,
} from "@/components/shared/styles.ts";

export { pageOrder } from "@/lib/dictionary/wordPage.ts";

/**
 * The shell every state shares.
 *
 * Two states, one form. "Before a query, the page is the search bar alone,
 * centred on the screen with the site name above it and nothing else
 * competing. With a query, the bar sits at the top and the results fill the
 * page below it" (design-system-manifest.md § "The page"). Which state this is
 * is read off the query itself; the form is the same one in both, so a result
 * stays shareable by its URL and moving the bar is layout, not a second route.
 *
 * `version` is the served version's token, which the field's suggestion
 * requests name (SearchField.tsx).
 */
export function SearchPage({ raw, version, children }: { raw: string; version: string; children: ReactNode }) {
  if (raw.trim() === "") {
    return (
      <main className={SHELL_CENTRED}>
        <h1 className={HOME_NAME}>{SITE_NAME}</h1>
        <p className={HOME_PRONUNCIATION} aria-label="Pronunciation">
          {SITE_PRONUNCIATION}
        </p>
        <p className={HOME_TAGLINE}>{SITE_TAGLINE}</p>
        <SearchField raw={raw} version={version} />
        {children}
      </main>
    );
  }
  return (
    <>
      <SiteHeader />
      <main className={SHELL_TOP}>
        <SearchField raw={raw} version={version} />
        {children}
      </main>
    </>
  );
}

/** The words frame 00 offers before a query, each a search. */
export const TRY_WORDS = ["casa", "andare", "bello", "sale", "studente"] as const;

/** Nothing asked yet. */
export function FirstLoad() {
  return (
    <nav className={TRY_ROW} aria-label="Try a word">
      <span className={TRY_LABEL}>Try</span>
      {TRY_WORDS.map((word) => (
        <a key={word} className={TRY_CHIP} href={`/?q=${word}`} lang="it">
          {word}
        </a>
      ))}
    </nav>
  );
}

/**
 * Too many searches from this visitor this minute (worker/rateLimit.ts), so
 * the lookup did not run and the page answers with a 429. Said plainly, with
 * the search field still above it; nothing here claims anything about the
 * word, because nobody looked.
 */
export function Limited({ raw }: { raw: string }) {
  return (
    <>
      <h1 className="sr-only">
        Search for <span lang="it">{raw.trim()}</span>
      </h1>
      <p className={ERROR} role="alert">
        Too many searches in the last minute, so this one did not run. Try again in a minute.
      </p>
    </>
  );
}

/**
 * Every state a probed query can land in, each said plainly rather than
 * collapsed into one blank page: asked badly, the lookup itself failed, asked
 * and not found, asked and found.
 *
 * The page has one `h1` in every state: the headword when a word was found
 * (the search as typed when it was an expression, Phrase.tsx),
 * `No entry for "<query>"` when none was (NotFound.tsx), and otherwise a
 * heading a screen reader can land on, visually hidden because the message
 * under it says the same thing.
 */
export function Outcome({ raw, attempt, siteKey }: { raw: string; attempt: Attempt; siteKey?: string }) {
  const query = raw.trim();
  if (attempt.outcome === "found") {
    const searched = attempt.query.raw.trim();
    // A searched expression opens its own short page (#214), not the headword's entry.
    if (attempt.route.kind === "phrase") {
      return <PhraseView page={phrasePage(searched, attempt.route, attempt.readings)} siteKey={siteKey} />;
    }
    return <WordView page={wordPage(searched, attempt.readings)} siteKey={siteKey} />;
  }
  if (attempt.outcome === "not-found") return <NotFound query={attempt.query.raw.trim()} nearby={attempt.nearby} />;
  return (
    <>
      <h1 className="sr-only">
        Search for <span lang="it">{query}</span>
      </h1>
      {attempt.outcome === "rejected" && (
        <p className={ERROR} role="alert">
          {attempt.rejection.reason === "empty"
            ? "Type a word to search for."
            : `That is ${attempt.rejection.length} characters. The limit is ${attempt.rejection.limit}.`}
        </p>
      )}

      {/* The database did not answer. Saying so is the point: a reader must be
          able to tell "we could not look" from "we looked and found nothing".
          Why it failed is in the Worker's log, not on this page. */}
      {attempt.outcome === "failed" && (
        <p className={ERROR} role="alert">
          The lookup failed, so this page cannot say whether <q lang="it">{query}</q> is in the
          dictionary. Try again in a moment.
        </p>
      )}

    </>
  );
}
