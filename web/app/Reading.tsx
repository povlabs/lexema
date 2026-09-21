// How one reading renders. The whole job here is to show what the source says
// and to be visibly silent where it says nothing — an empty section with a
// reason beats a confident-looking blank.
//
// Two rules run through every section below, and both come from
// design-system-manifest.md: the interface is English and the source's own
// Italian is never translated, so every Italian string carries `lang="it"`
// inside a document that is `lang="en"`; and every candidate the lookup
// returned is rendered, never ranked down to one.

import { isNounReading } from "@lexema/lookup/types.ts";
import type {
  ArticleWithholding,
  GrammarClaim,
  NounReading,
  Reading,
  ReadingArticles,
  Review,
  SourceForm,
} from "@lexema/lookup/types.ts";

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

const posLabel = (pos: string): string => POS_LABEL[pos] ?? pos;

/** The value the source stated for one dimension, if it stated one. */
function stated(claims: readonly GrammarClaim[], dimension: string): string | undefined {
  for (const claim of claims) {
    if (claim.status === "stated" && claim.dimension === dimension) return claim.value;
  }
  return undefined;
}

/** True when the source was asked for this dimension here and said nothing. */
function isMissing(claims: readonly GrammarClaim[], dimension: string): boolean {
  return claims.some((claim) => claim.status === "missing" && claim.dimension === dimension);
}

/** An Italian word, in a page whose language is English. */
function It({ children }: { children: string }) {
  return <span lang="it">{children}</span>;
}

/** Said in words, because a section with nothing in it must still say why. */
function NotAvailable({ children }: { children: string }) {
  return <p className="empty">{children}</p>;
}

function Grammar({ claims, label }: { claims: GrammarClaim[]; label: string }) {
  if (claims.length === 0) return null;

  return (
    <dl className="grammar" aria-label={label}>
      {claims.map((claim, i) => {
        if (claim.status === "stated") {
          return (
            <div key={i} className="claim claim-stated">
              <dt>{claim.dimension}</dt>
              <dd>{claim.value}</dd>
            </div>
          );
        }
        // The source was asked and said nothing. Different from never asking.
        if (claim.status === "missing") {
          return (
            <div key={i} className="claim claim-missing">
              <dt>{claim.dimension}</dt>
              <dd>not stated in the source</dd>
            </div>
          );
        }
        // Text we will not guess at. Shown verbatim so a reader can judge it.
        return (
          <div key={i} className="claim claim-unclassified">
            <dt>unclassified</dt>
            <dd>
              <q lang="it">{claim.sourceText}</q>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * A claim review, shown as a warning attached to the claim it is about.
 *
 * A disputed claim is never quietly dropped and never quietly corrected: the
 * source keeps saying what it said, and the page says that the evidence
 * disagrees. This is the state the `studente` verb claim is in.
 */
function Disputes({ reviews }: { reviews: Review[] }) {
  const disputed = reviews.filter((review) => review.status === "disputed");
  if (disputed.length === 0) return null;
  return (
    <div className="disputed" role="note">
      <p>
        <strong>Disputed by later research.</strong> This entry is shown as the source wrote it;
        the evidence below disagrees with it.
      </p>
      <ul>
        {disputed.map((review, i) => (
          <li key={i}>
            {review.note}{" "}
            <a href={review.evidenceUrl} rel="noreferrer">
              evidence
            </a>{" "}
            · reviewed {review.reviewedAt} by {review.reviewedBy} · claim{" "}
            <code>{review.ref.jsonPointer}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One `forms[]` entry: the Italian spelling, and what the source said about it. */
function FormEntry({ form }: { form: SourceForm }) {
  return (
    <li>
      <It>{form.surface}</It>
      <Grammar claims={form.claims} label={`grammar for ${form.surface}`} />
      {form.formSource !== null && (
        <span className="form-source">
          from <It>{form.formSource}</It>
        </span>
      )}
    </li>
  );
}

/**
 * Every form this record lists, in source order.
 *
 * A listed form is not a claim that this record is the base word —
 * `studentessa` lists `studenti` — so the section says whose table it is.
 */
function Forms({ reading }: { reading: Reading }) {
  return (
    <section className="links" aria-labelledby={`forms-${reading.recordId}`}>
      <h3 id={`forms-${reading.recordId}`}>Forms listed by this entry</h3>
      {reading.forms.length === 0 ? (
        <NotAvailable>Not available in the source: this entry lists no forms.</NotAvailable>
      ) : (
        <ul className="forms">
          {reading.forms.map((form) => (
            <FormEntry key={form.index} form={form} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The article a reader would need in front of this word.
 *
 * The release carries no article field at all — the dataset spot check looked
 * and found none — and an article follows from gender and number, which this
 * source often leaves out. Deriving one here would be invention, so the section
 * says what is true and stops.
 *
 * Nouns do not use this: `it-articles/v1` derives their articles from stated
 * gender and number, and `NounArticles` below shows what it returned.
 */
function Articles({ reading }: { reading: Reading }) {
  const gender = stated(reading.grammar.record, "gender");
  const number = stated(reading.grammar.record, "number");
  return (
    <section className="links" aria-labelledby={`articles-${reading.recordId}`}>
      <h3 id={`articles-${reading.recordId}`}>Articles</h3>
      <NotAvailable>
        {gender === undefined || number === undefined
          ? "Not available in the source: this release carries no article, and the gender or number an article agrees with is not stated here either."
          : `Not available in the source: this release carries no article. The source states ${gender} and ${number}; Lexema does not turn that into an article yet.`}
      </NotAvailable>
    </section>
  );
}

// A noun is read for three things the generic card answers badly: what it
// agrees with, how it goes singular and plural, and which article stands in
// front of it. Each gets its own section below, and each says so in words when
// the source gives it nothing — an empty table would read as "no plural", which
// is a claim the source did not make.

/** The dimensions an article agrees with, stated or visibly not. */
const AGREEMENT_DIMENSIONS = ["gender", "number"] as const;

/**
 * Gender and number, in the header, in the `Grammar` component's own words.
 *
 * Rendered from the two dimensions rather than from whatever claims the record
 * happens to carry, so a noun the source said nothing about still shows both
 * rows — `casa` is that noun, and its silence is the point.
 */
function NounAgreement({ reading }: { reading: NounReading }) {
  return (
    <dl className="grammar" aria-label={`grammar for ${reading.word}`}>
      {AGREEMENT_DIMENSIONS.map((dimension) => {
        const value = stated(reading.grammar.record, dimension);
        return value === undefined ? (
          <div key={dimension} className="claim claim-missing">
            <dt>{dimension}</dt>
            <dd>not stated in the source</dd>
          </div>
        ) : (
          <div key={dimension} className="claim claim-stated">
            <dt>{dimension}</dt>
            <dd>{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** One spelling the source files under a number, with the gender it gave it. */
interface NumberedSurface {
  key: string;
  surface: string;
  gender: string | undefined;
}

/**
 * The record's spellings, grouped by the number the source stated for each.
 *
 * The headword goes under the record's own number, and every forms row under
 * its own — which is the only grouping the source supports. A row the source
 * gave no number is not guessed into one; it stays in the forms section below,
 * where it is listed without a claim about it.
 */
function numberedSurfaces(reading: Reading, number: "singular" | "plural"): NumberedSurface[] {
  const surfaces: NumberedSurface[] = [];
  if (stated(reading.grammar.record, "number") === number) {
    surfaces.push({
      key: "headword",
      surface: reading.word,
      gender: stated(reading.grammar.record, "gender"),
    });
  }
  for (const form of reading.forms) {
    if (stated(form.claims, "number") !== number) continue;
    surfaces.push({
      key: `form-${form.index}`,
      surface: form.surface,
      gender: stated(form.claims, "gender"),
    });
  }
  return surfaces;
}

/** One cell of the table: every spelling filed under that number, verbatim. */
function NumberCell({ surfaces }: { surfaces: NumberedSurface[] }) {
  if (surfaces.length === 0) return <span className="empty">not stated in the source</span>;
  return (
    <>
      {surfaces.map((entry, i) => (
        <span key={entry.key}>
          {i > 0 && ", "}
          {/* Exactly as the source spelled it: `studente/studentessa` is one
              string the source wrote, not two words to split apart. */}
          <It>{entry.surface}</It>
          {entry.gender !== undefined && <span className="muted"> {entry.gender}</span>}
        </span>
      ))}
    </>
  );
}

function NounNumbers({ reading }: { reading: NounReading }) {
  const singular = numberedSurfaces(reading, "singular");
  const plural = numberedSurfaces(reading, "plural");

  return (
    <section className="links" aria-labelledby={`numbers-${reading.recordId}`}>
      <h3 id={`numbers-${reading.recordId}`}>Singular and plural</h3>
      {singular.length === 0 && plural.length === 0 ? (
        <NotAvailable>
          Not available in the source: this entry gives neither a singular nor a plural — neither on
          the record itself nor on any form it lists.
        </NotAvailable>
      ) : (
        <table className="numbers">
          <tbody>
            <tr>
              <th scope="row">singular</th>
              <td>
                <NumberCell surfaces={singular} />
              </td>
            </tr>
            <tr>
              <th scope="row">plural</th>
              <td>
                <NumberCell surfaces={plural} />
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Why there is no article, said as a sentence rather than left blank. */
function withheldSentence(withholding: ArticleWithholding): string {
  switch (withholding.reason) {
    case "no-gender-or-number-stated":
      return "No article is shown: an article agrees with gender and number, and the source states neither for this entry.";
    case "gender-not-stated":
      return "No article is shown: an article agrees with gender, and the source does not state one for this entry.";
    case "number-not-stated":
      return "No article is shown: an article agrees with number, and the source does not state one for this entry.";
    case "gender-is-not-masculine-or-feminine":
      return `No article is shown: the source gives the gender as ${withholding.statedGender}, which is neither masculine nor feminine, so no article agrees with it.`;
    case "number-is-not-singular-or-plural":
      return `No article is shown: the source gives the number as ${withholding.statedNumber}, which is neither singular nor plural, so no article agrees with it.`;
    case "surface-not-handled":
      return `No article is shown: rule it-articles/v1 derives an article for a single word, and this entry's headword is not one.`;
  }
}

/**
 * The articles, and where they came from.
 *
 * These are the one thing on this page the source did not say: `it-articles/v1`
 * derives them from the gender and number the source *did* state, so every row
 * carries that label where a reader can see it, and the section never shows a
 * derived article beside a source fact without saying which is which.
 */
function NounArticles({ articles, recordId }: { articles: ReadingArticles; recordId: number }) {
  return (
    <section className="links" aria-labelledby={`articles-${recordId}`}>
      <h3 id={`articles-${recordId}`}>Articles</h3>
      {articles.status === "derived" ? (
        <>
          <table className="articles">
            <thead>
              <tr>
                <th scope="col">kind</th>
                <th scope="col">article</th>
                <th scope="col">with the word</th>
                <th scope="col">derived by</th>
              </tr>
            </thead>
            <tbody>
              {articles.articles.map((article) => (
                <tr key={article.kind}>
                  <th scope="row">{article.kind}</th>
                  <td>
                    <It>{article.article}</It>
                  </td>
                  <td>
                    <It>{article.displayForm}</It>
                  </td>
                  <td className="muted">
                    <code>{article.sourceType}</code> · <code>{article.rule}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">
            Not from the source: Lexema derives these from the{" "}
            {articles.articles[0].gender} {articles.articles[0].number} the source states, by rule{" "}
            <code>it-articles/v1</code>.
          </p>
        </>
      ) : (
        <NotAvailable>{withheldSentence(articles.withholding)}</NotAvailable>
      )}
    </section>
  );
}

/**
 * The record's forms grouped the way a conjugation table groups them.
 *
 * Grouping is by the tense the source stated, and by nothing else: no mood in
 * this release is stated structurally, so a group says so rather than filling
 * the gap in. An entry naming the auxiliary verb is not an inflected form and
 * is kept out of the tenses.
 */
function Conjugations({ reading }: { reading: Reading }) {
  const auxiliaries = reading.forms.filter((form) => stated(form.claims, "form-role") === "auxiliary");
  const byTense = new Map<string, SourceForm[]>();
  for (const form of reading.forms) {
    const tense = stated(form.claims, "tense");
    if (tense === undefined || stated(form.claims, "form-role") === "auxiliary") continue;
    const group = byTense.get(tense);
    if (group) group.push(form);
    else byTense.set(tense, [form]);
  }

  return (
    <section className="links" aria-labelledby={`conjugations-${reading.recordId}`}>
      <h3 id={`conjugations-${reading.recordId}`}>Grouped conjugations</h3>
      {byTense.size === 0 ? (
        <NotAvailable>
          Not available in the source: no form in this entry carries a tense to group by.
        </NotAvailable>
      ) : (
        [...byTense].map(([tense, forms]) => (
          <div key={tense} className="conjugation-group">
            <h4>{tense}</h4>
            <ul className="forms">
              {forms.map((form) => {
                const person = [stated(form.claims, "person"), stated(form.claims, "number")]
                  .filter((part) => part !== undefined)
                  .join(", ");
                return (
                <li key={form.index}>
                  <It>{form.surface}</It>{" "}
                  {person !== "" && <span className="muted">{person}</span>}
                  {isMissing(form.claims, "mood") && (
                    <span className="ambiguous"> · mood not stated in the source</span>
                  )}
                </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
      {auxiliaries.length > 0 && (
        <p className="muted">
          Auxiliary named by the source:{" "}
          {auxiliaries.map((form, i) => (
            <span key={form.index}>
              {i > 0 ? ", " : ""}
              <It>{form.surface}</It>
            </span>
          ))}
          . Not an inflected form of this word.
        </p>
      )}
    </section>
  );
}

/** Every record a word could mean, listed rather than chosen between. */
function Candidates({ candidates }: { candidates: { recordId: number; word: string; pos: string }[] }) {
  return (
    <>
      {candidates.map((candidate, i) => (
        <span key={candidate.recordId}>
          {i > 0 && ", "}
          <It>{candidate.word}</It> ({posLabel(candidate.pos)})
        </span>
      ))}
    </>
  );
}

/**
 * Claims about the record that the noun header has not already shown.
 *
 * Gender and number are in the header, so repeating them under it would say the
 * same thing twice; everything else the source stated about the record — an
 * unclassified tag such as `form-of` — still has to be visible.
 */
function otherRecordClaims(claims: GrammarClaim[]): GrammarClaim[] {
  return claims.filter((claim) => {
    if (claim.status === "unclassified") return true;
    return !AGREEMENT_DIMENSIONS.some((dimension) => dimension === claim.dimension);
  });
}

export function ReadingCard({ reading, query }: { reading: Reading; query: string }) {
  const pos = posLabel(reading.pos);
  // Nouns get their own layout (#53). Every other part of speech renders what
  // it rendered before, unchanged. The narrowing is the type's own: a noun
  // reading carries articles and no other reading has the field.
  const noun = isNounReading(reading) ? reading : undefined;

  return (
    <article className="reading" aria-label={`${reading.word}, ${pos}`}>
      <header>
        <h2>
          <It>{reading.word}</It> <span className="pos">{pos}</span>
        </h2>
        {/* The single most important honesty signal on this page. A record that
            merely lists the query in a table is not a claim about the query, and
            saying so prevents the reader inferring a lemma nobody stated. */}
        {!reading.isAboutQuery && (
          <p className="mention">
            Does not define <q lang="it">{query}</q> — it lists the form in its own table.
          </p>
        )}
        {noun && <NounAgreement reading={noun} />}
      </header>

      <Disputes reviews={reading.reviews} />

      {/* Senses stay apart, with their own labels: the source wrote several
          meanings and merging them into one list would invent a single one. */}
      {reading.senses.length === 0 ? (
        <p className="empty">The source carries no sense for this entry.</p>
      ) : (
        <ol className="definitions">
          {reading.senses.map((sense) => (
            <li key={sense.index}>
              {sense.glosses.length === 0 ? (
                <span className="empty">
                  The source carries no definition for this sense.
                </span>
              ) : (
                sense.glosses.map((gloss, i) => (
                  <p key={i} lang="it" className="gloss">
                    {gloss.text}
                  </p>
                ))
              )}
              {sense.labels.length > 0 && (
                <p className="labels">
                  {sense.labels.map((label, i) => (
                    <span key={i} className="label">
                      {i > 0 && " "}
                      <It>{label.label}</It>
                    </span>
                  ))}
                </p>
              )}
              <Grammar
                claims={reading.grammar.bySense.get(sense.index) ?? []}
                label={`grammar for sense ${sense.index + 1}`}
              />
            </li>
          ))}
        </ol>
      )}

      {noun ? (
        <>
          <Grammar
            claims={otherRecordClaims(noun.grammar.record)}
            label={`other grammar for ${noun.word}`}
          />
          <NounNumbers reading={noun} />
          <NounArticles articles={noun.articles} recordId={noun.recordId} />
          <Forms reading={noun} />
        </>
      ) : (
        <>
          <Grammar claims={reading.grammar.record} label={`grammar for ${reading.word}`} />
          <Articles reading={reading} />
          <Forms reading={reading} />
          <Conjugations reading={reading} />
        </>
      )}

      {reading.lemmaLinks.length > 0 && (
        <section className="links" aria-labelledby={`form-of-${reading.recordId}`}>
          <h3 id={`form-of-${reading.recordId}`}>Form of</h3>
          <ul>
            {reading.lemmaLinks.map((link, i) => (
              <li key={i}>
                {link.kind === "dangling" ? (
                  <>
                    <It>{link.targetWord}</It>{" "}
                    <span className="empty">— named by the source, but no entry for it here</span>
                  </>
                ) : (
                  <>
                    <It>{link.targetWord}</It>
                    {/* More than one candidate means the source named a word,
                        not an entry. Showing all of them is the honest move;
                        picking one would invent a fact. */}
                    {link.candidates.length > 1 && (
                      <span className="ambiguous">
                        {" "}
                        — {link.candidates.length} entries share this spelling:{" "}
                        <Candidates candidates={link.candidates} />. The source does not say which.
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
        <section className="links" aria-labelledby={`inflections-${reading.recordId}`}>
          <h3 id={`inflections-${reading.recordId}`}>Forms pointing here</h3>
          <ul>
            {reading.inflections.map((inflection, i) => (
              <li key={`${inflection.recordId}-${i}`}>
                <a href={`/?q=${encodeURIComponent(inflection.word)}`} lang="it">
                  {inflection.word}
                </a>{" "}
                <span className="muted">({posLabel(inflection.pos)})</span> — declares itself a form
                of <It>{inflection.targetWord}</It>
                {/* The reverse direction is ambiguous in exactly the way the
                    forward one is: the edge names a word, and this reading is
                    only one of the records spelling it. */}
                {inflection.targetCandidates.length > 1 && (
                  <span className="ambiguous">
                    {" "}
                    — {inflection.targetCandidates.length} entries share that spelling:{" "}
                    <Candidates candidates={inflection.targetCandidates} />. The source does not say
                    which of them this form belongs to.
                  </span>
                )}
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
          Wiktionary page for <It>{reading.word}</It>
        </a>{" "}
        · release line {reading.ref.lineNo}
        {reading.evidence.map((e, i) => (
          <span key={i} className="pointer">
            {" "}
            <code>{e.ref.jsonPointer}</code>
          </span>
        ))}
      </footer>
    </article>
  );
}
