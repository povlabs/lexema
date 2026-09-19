// The search page. A server component: the query arrives in the URL, the D1
// read happens on the Worker, and the HTML that comes back already has the
// answer in it. No client-side fetching, so the page works before any
// JavaScript loads and a result is shareable by copying the address bar.

import { ReadingCard } from "./Reading";
import { search } from "./db";

export function generateMetadata({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim();
  return { title: q ? `${q} — Lexema` : "Lexema — Italian dictionary search" };
}

export default async function Page({ searchParams }: { searchParams: { q?: string } }) {
  const raw = searchParams.q ?? "";
  const result = raw.trim() === "" ? null : await search(raw);

  return (
    <main>
      <h1>Lexema</h1>
      <p className="tagline">Italian words, as the source dictionary has them.</p>

      <form action="/" method="get" role="search">
        <label htmlFor="q">Italian word</label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={raw}
          placeholder="casa"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
        />
        <button type="submit">Search</button>
      </form>

      {/* Five outcomes, each said plainly rather than collapsed into one blank
          page: nothing asked, asked badly, the lookup itself failed, asked and
          not found, asked and found. */}
      {result === null && (
        <p className="hint">
          Try <a href="/?q=sale">sale</a>, <a href="/?q=studenti">studenti</a> or{" "}
          <a href="/?q=bella">bella</a> — each shows a different kind of ambiguity.
        </p>
      )}

      {result?.outcome === "rejected" && (
        <p className="error" role="alert">
          {result.rejection.reason === "empty"
            ? "Type a word to search for."
            : `That is ${result.rejection.length} characters. The limit is ${result.rejection.limit}.`}
        </p>
      )}

      {/* The database did not answer. Saying so is the point: a reader must be
          able to tell "we could not look" from "we looked and found nothing". */}
      {result?.outcome === "failed" && (
        <p className="error" role="alert">
          The lookup failed, so this page cannot say whether <q>{raw.trim()}</q> is in the
          dictionary. Try again in a moment.
          <br />
          <small>{result.reason}</small>
        </p>
      )}

      {result?.outcome === "not-found" && (
        <p className="empty" role="status">
          Nothing in this release matches <q>{result.query.raw.trim()}</q>. Accents matter:{" "}
          <code>citta</code> and <code>città</code> are different words.
        </p>
      )}

      {result?.outcome === "found" && (
        <>
          <p className="count" role="status">
            {result.readings.length} {result.readings.length === 1 ? "entry" : "entries"} for{" "}
            <q>{result.query.raw.trim()}</q>
          </p>
          {result.readings.map((reading) => (
            <ReadingCard key={reading.recordId} reading={reading} query={result.query.raw.trim()} />
          ))}
        </>
      )}

      {result !== null && result.outcome !== "rejected" && result.outcome !== "failed" && (
        <footer className="attribution">
          <p>
            Entries come from a dictionary release derived from Wiktionary and are shown as the
            source wrote them, including where it is incomplete or wrong. Nothing on this page is
            generated.
          </p>
          <p>
            Release <code>{result.release.releaseId}</code>
            {result.release.license && <> · {result.release.license}</>}
            {result.release.sourceUrl && (
              <>
                {" "}
                ·{" "}
                <a href={result.release.sourceUrl} rel="noreferrer">
                  source
                </a>
              </>
            )}
          </p>
        </footer>
      )}
    </main>
  );
}
