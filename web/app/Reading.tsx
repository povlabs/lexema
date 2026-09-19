// How one reading renders. The whole job here is to show what the source says
// and to be visibly silent where it says nothing — an empty section with a
// reason beats a confident-looking blank.

import type { GrammarClaim, Reading, Review } from "@lexema/lookup/types.ts";

/**
 * Where one reading can be checked by hand.
 *
 * The release is a Wiktextract dump of the Italian Wiktionary, so every record
 * came from a page there under its own headword. The source stores no URL, so
 * this one is built from the headword — which is why the link says "page for
 * <word>" rather than claiming to cite this reading. The archive line number
 * and JSON pointers stay next to it: they are what pin the reading to an exact
 * byte of the release, and the link is what a reader can actually click.
 */
const WIKTIONARY_PAGE = "https://it.wiktionary.org/wiki/";

function sourcePageUrl(word: string): string {
  return WIKTIONARY_PAGE + encodeURIComponent(word.replace(/ /g, "_"));
}

/** Nicer than `pos_title`, which is Italian and inconsistent. */
const POS_LABEL: Record<string, string> = {
  noun: "noun",
  verb: "verb",
  adj: "adjective",
  adv: "adverb",
  name: "name",
  phrase: "phrase",
  prep: "preposition",
  conj: "conjunction",
  pron: "pronoun",
  intj: "interjection",
  num: "numeral",
  abbrev: "abbreviation",
};

function Grammar({ claims }: { claims: GrammarClaim[] }) {
  const stated = claims.filter((c) => c.status === "stated");
  const missing = claims.filter((c) => c.status === "missing");
  const unclassified = claims.filter((c) => c.status === "unclassified");

  if (claims.length === 0) return null;

  return (
    <dl className="grammar">
      {stated.map((claim, i) =>
        claim.status === "stated" ? (
          <div key={`s${i}`} className="claim claim-stated">
            <dt>{claim.dimension}</dt>
            <dd>{claim.value}</dd>
          </div>
        ) : null,
      )}
      {/* The source was asked and said nothing. Different from never asking. */}
      {missing.map((claim, i) =>
        claim.status === "missing" ? (
          <div key={`m${i}`} className="claim claim-missing">
            <dt>{claim.dimension}</dt>
            <dd>not stated in the source</dd>
          </div>
        ) : null,
      )}
      {/* Text we will not guess at. Shown verbatim so a reader can judge it. */}
      {unclassified.map((claim, i) =>
        claim.status === "unclassified" ? (
          <div key={`u${i}`} className="claim claim-unclassified">
            <dt>unclassified</dt>
            <dd>
              <q>{claim.sourceText}</q>
            </dd>
          </div>
        ) : null,
      )}
    </dl>
  );
}

function Disputes({ reviews }: { reviews: Review[] }) {
  const disputed = reviews.filter((r) => r.status === "disputed");
  if (disputed.length === 0) return null;
  return (
    <div className="disputed" role="note">
      <strong>Disputed.</strong>{" "}
      {disputed.map((review, i) => (
        <span key={i}>
          {review.note}{" "}
          <a href={review.evidenceUrl} rel="noreferrer">
            evidence
          </a>
        </span>
      ))}
    </div>
  );
}

export function ReadingCard({ reading, query }: { reading: Reading; query: string }) {
  const pos = POS_LABEL[reading.pos] ?? reading.pos;
  const definitions = reading.senses.flatMap((sense) => sense.glosses);

  return (
    <article className="reading" aria-label={`${reading.word}, ${pos}`}>
      <header>
        <h2>
          {reading.word} <span className="pos">{pos}</span>
        </h2>
        {/* The single most important honesty signal on this page. A record that
            merely lists the query in a table is not a claim about the query, and
            saying so prevents the reader inferring a lemma nobody stated. */}
        {!reading.isAboutQuery && (
          <p className="mention">
            Does not define <q>{query}</q> — it lists the form in its own table.
          </p>
        )}
      </header>

      <Disputes reviews={reading.reviews} />

      {definitions.length > 0 ? (
        <ol className="definitions">
          {definitions.map((gloss, i) => (
            <li key={i}>{gloss.text}</li>
          ))}
        </ol>
      ) : (
        <p className="empty">The source carries no definition for this entry.</p>
      )}

      <Grammar claims={reading.grammar.record} />

      {reading.lemmaLinks.length > 0 && (
        <section className="links">
          <h3>Form of</h3>
          <ul>
            {reading.lemmaLinks.map((link, i) => (
              <li key={i}>
                {link.kind === "dangling" ? (
                  <>
                    <strong>{link.targetWord}</strong>{" "}
                    <span className="empty">— named by the source, but no entry for it here</span>
                  </>
                ) : (
                  <>
                    <strong>{link.targetWord}</strong>
                    {/* More than one candidate means the source named a word,
                        not an entry. Showing all of them is the honest move;
                        picking one would invent a fact. */}
                    {link.candidates.length > 1 && (
                      <span className="ambiguous">
                        {" "}
                        — {link.candidates.length} entries share this spelling:{" "}
                        {link.candidates.map((c) => POS_LABEL[c.pos] ?? c.pos).join(", ")}
                      </span>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {reading.inflections.length > 0 && (
        <section className="links">
          <h3>Forms pointing here</h3>
          <ul className="inline">
            {reading.inflections.map((inflection) => (
              <li key={inflection.recordId}>
                <a href={`/?q=${encodeURIComponent(inflection.word)}`}>{inflection.word}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="source">
        <a
          href={sourcePageUrl(reading.word)}
          rel="noreferrer"
          aria-label={`Wiktionary page for ${reading.word}, the source of this ${pos} entry`}
        >
          Wiktionary page for {reading.word}
        </a>{" "}
        · release line {reading.lineNo}
        {reading.evidence.map((e, i) => (
          <span key={i} className="pointer">
            {" "}
            <code>{e.pointer}</code>
          </span>
        ))}
      </footer>
    </article>
  );
}
