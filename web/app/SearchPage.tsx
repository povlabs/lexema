// The page's own markup, with no database in it.
//
// Split from `page.tsx` so every state this page can be in is a value away
// rather than a running Worker away: `web/test/page.test.tsx` renders these
// components to HTML over an imported fixture release, and that test runs in CI
// with no archive and no D1. What `page.tsx` adds is where the data comes from.
//
// Nothing here is a client component. The form is a plain GET form, every
// state is decided by the URL, and the "Show all" controls are native
// `<details>`, so the page works before any JavaScript does.

import type { ReactNode } from "react";
import type { Attempt } from "./attempt.ts";
import { SearchIcon } from "./icons";
import { SiteHeader } from "./SiteHeader";
import { WordView } from "./Word";
import { wordPage } from "./wordPage.ts";
import {
  EMPTY,
  ERROR,
  HOME_NAME,
  PENDING,
  SEARCH_CLEAR,
  SEARCH_FIELD,
  SEARCH_FORM,
  SEARCH_HINT,
  SEARCH_ICON,
  SEARCH_INPUT,
  SHELL_CENTRED,
  SHELL_TOP,
  TRY_CHIP,
  TRY_LABEL,
  TRY_ROW,
} from "./styles.ts";

export { pageOrder } from "./wordPage.ts";

/**
 * The one search field: a magnifier at the left, and at the right either a
 * `×` that clears a query or, before one, the `ENTER` hint. No label above it
 * and no button beside it — Enter submits — and its accessible name is on the
 * input itself, so a screen reader still hears what it is for.
 */
function SearchForm({ raw }: { raw: string }) {
  const asked = raw.trim() !== "";
  return (
    <form className={SEARCH_FORM} action="/" method="get" role="search">
      <div className={SEARCH_FIELD}>
        <SearchIcon className={SEARCH_ICON} />
        <input
          className={SEARCH_INPUT}
          id="q"
          name="q"
          type="search"
          aria-label="Search an Italian word"
          defaultValue={raw}
          placeholder="Search an Italian word"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          lang="it"
          autoFocus={!asked}
          enterKeyHint="search"
        />
        {asked ? (
          <a className={SEARCH_CLEAR} href="/" aria-label="Clear search">
            ×
          </a>
        ) : (
          <kbd className={SEARCH_HINT} aria-hidden="true">
            ENTER
          </kbd>
        )}
      </div>
    </form>
  );
}

/**
 * The shell every state shares.
 *
 * Two states, one form. "Before a query, the page is the search bar alone,
 * centred on the screen with the site name above it and nothing else
 * competing. With a query, the bar sits at the top and the results fill the
 * page below it" (design-system-manifest.md § "The page"). Which state this is
 * is read off the query itself; the form is the same one in both, so a result
 * stays shareable by its URL and moving the bar is layout, not a second route.
 */
export function SearchPage({ raw, children }: { raw: string; children: ReactNode }) {
  if (raw.trim() === "") {
    return (
      <main className={SHELL_CENTRED}>
        <h1 className={HOME_NAME}>Lexema</h1>
        <SearchForm raw={raw} />
        {children}
      </main>
    );
  }
  return (
    <>
      <SiteHeader />
      <main className={SHELL_TOP}>
        <SearchForm raw={raw} />
        {children}
      </main>
    </>
  );
}

/** The words frame 00 offers before a query, each a search. */
export const TRY_WORDS = ["casa", "andare", "andavano", "bello", "sale", "studente"] as const;

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
 * The lookup is running: the fallback of the streaming boundary in `page.tsx`.
 * No client JavaScript, and nothing that pretends to know the answer yet.
 */
export function Pending({ raw }: { raw: string }) {
  return (
    <p className={PENDING} role="status">
      Searching for <q lang="it">{raw.trim()}</q> …
    </p>
  );
}

/**
 * Every state a probed query can land in, each said plainly rather than
 * collapsed into one blank page: asked badly, the lookup itself failed, asked
 * and not found, asked and found.
 *
 * The page has one `h1` in every state: the headword when a word was found,
 * and otherwise a heading a screen reader can land on, visually hidden because
 * the message under it says the same thing.
 */
export function Outcome({ raw, attempt }: { raw: string; attempt: Attempt }) {
  const query = raw.trim();
  if (attempt.outcome === "found") {
    return <WordView page={wordPage(attempt.query.raw.trim(), attempt.readings)} query={attempt.query.raw.trim()} />;
  }
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

      {attempt.outcome === "not-found" && (
        <p className={EMPTY} role="status">
          Nothing in this release matches <q lang="it">{attempt.query.raw.trim()}</q>. Accents
          matter: <code lang="it">citta</code> and <code lang="it">città</code> are different
          words.
        </p>
      )}
    </>
  );
}
