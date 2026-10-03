# Why the search page works this way

One search box, one result page, rendered on a Cloudflare Worker with D1
underneath. This page is the reasoning. To run it, see
[RUN_THE_SITE.md](RUN_THE_SITE.md); the seed's numbers are in
[DEV_SEED.md](DEV_SEED.md); the query layer it calls is
[LOOKUP.md](LOOKUP.md).

## Where the parts live

`web/app/` holds the routes and nothing else: each route group's `layout.tsx`,
its `page.tsx` and `route.ts` files, and `globals.css`. What they render and
call lives beside it, split by site. `components/` is markup, `lib/` is what
the markup shows and the server calls, and each has a `dictionary/`, a
`developers/` and a `shared/` folder. Code imports through `@/`, which is
`web/` (`@/components/dictionary/Word`), set in both `vite.config.ts` and
`tsconfig.json`.

```
web/app/(lexema)/        lexema.fyi: the search page, attribution, /suggest and /report
web/app/(developers)/    developers.lexema.fyi: landing, docs, pricing, sign-in, the dashboard
web/components/dictionary/   the word page, the search field, the site's header and footer
web/components/developers/   the developer site's pages, its docs, menus and sign-in
web/components/developers/dashboard/  the dashboard, its dialogs and toasts
web/components/shared/   what both sites draw: links, icons and styles.ts, the one home of class strings
web/lib/dictionary/      the query, the lookup attempt, the page's grammar, reports
web/lib/developers/      the API reference, the docs pages, the dashboard's view and actions
web/lib/shared/          what both sites call: the two D1 bindings and the search shortcut
```

A dictionary file never imports from a `developers/` folder, nor the other way
round; what both need goes in `shared/`, which imports from neither.
[web/test/layout.test.ts](../web/test/layout.test.ts) fails `pnpm test` when an
import crosses, or when anything but a route file lands in `web/app/`.

The files a change to the search page most often starts from:

```
web/app/(lexema)/page.tsx                  reads the query, runs the lookup, streams the answer
web/components/dictionary/SearchPage.tsx   the shell, and the five states a query can be in
web/components/dictionary/SearchField.tsx  the search form, and the suggestion list under it
web/lib/dictionary/suggestionAsker.ts      when the field asks for suggestions, and when it answers itself
web/app/(lexema)/suggest/route.ts          GET /suggest, the list's JSON
web/components/dictionary/Reading.tsx      how one entry renders
web/lib/dictionary/params.ts               the query as it arrives in the URL
web/lib/dictionary/attempt.ts              a lookup, or the fact that it did not happen
web/lib/dictionary/db.ts                   the lookup and the suggestions, read from D1
web/lib/shared/database.ts                 the two D1 bindings: the dictionary, read-only, and the app database
web/worker/index.ts                        the Worker's entry: the host, then the API or the rate limits and vinext
web/worker/hosts.ts                        which of the three hosts a request is for, and where it goes
web/worker/rateLimit.ts                    which requests are counted, and against whose count
web/worker/dashboard.ts                    the developer dashboard's actions: make or revoke a key, delete the account;
                                           and its pages' guard: sign-in without a session, a new key's secret shown once
web/components/developers/dashboard/Dashboard.tsx  the dashboard's markup; what it shows is web/lib/developers/dashboardView.ts
src/lookup/                                the query layer, shared with the importer's tests
web/test/page.test.tsx                     the page, rendered over a fixture release
web/test/rateLimit.test.ts                 the limits, with a fake binding
web/test/dashboard.test.ts                 the dashboard's actions and pages, their CSRF and session checks
web/test/signedIn.test.tsx                 sign-in, the dashboard and its two dialogs, rendered
```

The markup is split from the wiring so it can be rendered without a Worker.
`lib/shared/database.ts` and `lib/dictionary/db.ts` reach D1 through
`cloudflare:workers`, which exists only inside workerd; everything else runs in
plain Node, which is how the rendered-page test runs in CI with no archive and
no database.

`web/` is a workspace package rather than a separate repository, so there is
still exactly one lockfile at the root — which is what ADR 0002 asks for. It
reaches the lookup layer through a Vite alias rather than a copy, because two
copies of a query layer drift apart and the divergence shows up as a wrong
answer rather than a build error.

Server code reaches D1 through the Workers runtime's own `env`, not a framework
helper — vinext offers no `getCloudflareContext()`:

```ts
import { env } from "cloudflare:workers";
const db = fromD1(env.DB);
```

`env.DB` is the dictionary, and `fromD1` hands it out read-only: its one
method takes a single `SELECT`, so a write neither type-checks nor runs.
Accounts, keys, usage and reader reports are in the app database, `env.APP_DB`
([ADR 0018](../.decisions/0018-previews-on-workers-builds.md)).

The spike in #27 established that. `env.LEXEMA_RELEASE` picks which imported
release is served; flipping it safely is #18.

## Why a server component and no client fetching

Before a query the page is the wordmark, its pronunciation `/lekˈsɛːma/` and
*a simple dictionary* under it, and the search field, centred on the screen
([design-system-manifest.md § "The page"](../design-system-manifest.md#the-page));
with a query, the field moves to the top and the result fills the page. Both
are this one server-rendered route.

The query arrives in the URL, the D1 read happens on the Worker, and the HTML
that comes back already holds the answer. Two things follow, and each was the
point rather than a side effect: the page works before any JavaScript loads, and
a result is shareable by copying the address bar.

There is no loading state on the page
([#115](https://github.com/hueypov/lexema/issues/115)). The HTML waits for the
D1 read and carries the result in place, so it is visible with JavaScript off.
The page used to wrap the read in a `Suspense` boundary that flushed a
*Searching for …* line first. React sends the finished result after that line,
hidden, and only an inline script swaps it in, so without JavaScript a reader saw
the loading line and never the result. While the read runs, the browser shows
its own page-loading indicator instead. The search form, the home page and every
link are plain HTML and work without JavaScript; the suggestion list, the mood
tabs and `+ more` need it.

The cost is that a server component here has no way to set a response status, so
even the failed-lookup page returns 200. The state the reader needs is on the
page; the status code cannot carry it.

## Why the suggestion list is the one thing the browser fetches

Suggestions answer keystrokes, which the URL cannot carry, so `GET /suggest?q=`
is the one request the page makes while a reader reads. (The other client parts
fetch nothing until asked: the mood tabs, the measuring of the etymology line and the word lists, and the
report box, which posts only when opened and sent.) The route returns JSON rather than a rendered page, so an
answer costs the prefix query and nothing else. The browser keeps an answer
five minutes, so a reader retyping a prefix sends no request. The request names
the served version, `/suggest?q=ca&v=it-0c432803.0`: the release and the last
change applied to it, which the page reads in one row
([`servedVersion`](../src/lookup/served.ts)). A release flip or an apply moves
it, so no answer kept from before one is reused after it. There is no edge
cache: Cloudflare bills a cache hit as a request, so it would save none. Everything else above still
holds: the server renders the field as a plain `<input name="q">` in a GET form,
and without JavaScript Enter searches as it always did.

Base UI's Autocomplete owns the combobox: focus stays in the field, the arrow
keys move a highlight, Enter on a highlighted row opens that word, Enter with
none searches what was typed, and Escape closes the list. A polite live region
says how many suggestions opened. The field asks from two letters, waits 250 ms
after a keystroke before asking, and a newer keystroke aborts the older
request, so a slow answer for `ca` is never drawn over the list for `cas`. An
answer with fewer than ten suggestions is every word under its prefix, so a
longer one-word prefix that starts with it is answered from that list in the
browser, exactly as the server would answer it, and sends no request
([LOOKUP.md](LOOKUP.md#suggestions), #387). `SuggestionAsker` in
`web/lib/dictionary/suggestionAsker.ts` decides when to ask.

The `×` empties the field and puts the cursor back in it; the result on the
page stays until a new search is sent. It is still a link to the empty home
page, which is what it does with no script.

⌘K on a Mac, Ctrl+K elsewhere, scrolls to the top, smoothly unless the reader
asks for reduced motion, and puts the cursor in the field with its text
selected (`web/lib/shared/searchShortcut.ts`). It stands aside while a dialog is open
and while the reader types in another field. While the field does not have the
cursor, a muted `⌘K` or `Ctrl K` shows in the bar; it appears only once the
page has loaded its script, since the server cannot know the reader's keyboard,
and not on a touch-only screen.

The form sits inside the Autocomplete root, not around it. The root renders a
second, typeless input, and a form with two text fields and no submit button is
one Enter cannot submit.

## Why the rate limits sit in front of vinext

Requests are the cost (#19), so a visitor gets 15 searches and 120 suggestions a
minute ([#128](https://github.com/hueypov/lexema/issues/128)). The numbers are
Cloudflare's rate-limit bindings in `web/wrangler.jsonc`, with Huey's reasons
beside them. The binding counts per Cloudflare location and has only 10 s and
60 s windows.

The check is `web/worker/index.ts`, the Worker's `main`. It wraps vinext's own
App Router entry, so it runs before any route and in one place. A request counts
as a suggestion when its path is `/suggest`, and as a search when it carries a
non-empty `q`. That rule covers the HTML page and an RSC request for the same URL
alike, and every spelling of the path vinext would normalize back to `/`. Static
assets never reach the Worker, and the home page has no `q`.

A visitor is `CF-Connecting-IP`, with an IPv6 address cut to its /64, since one
host can use any address in its /64. A block is logged by which limit it was,
never by the address.

A blocked suggestion is answered in the entry with a 429 and
`{"outcome":"limited"}`; the field shows nothing for it. A blocked search still
has to render the page, with the field, so the entry marks the request and
passes it on. `page.tsx` sees the mark, renders `Limited` in place of the lookup,
and the entry sends that page as a 429 with `Retry-After: 60`. This is the one
page status a server component could not set by itself: the limit is decided
before the render starts. A mark sent by the client is removed first.

## Why the page is visibly silent

This dictionary's data is incomplete, and the page's job is to make that legible
instead of smoothing it over. The silences it refuses to hide:

**A lemma is where a reading points, not a match.** Searching `sale` returns
three entries, the three records whose headword is `sale`. Two of them say what
they are a form of, `sala` and `salire`, and those lemmas come back inside the
reading that names them rather than as entries of their own. The definition
that names each links it to its own search, and a verb lemma whose table lists
the searched form renders its whole conjugation under the reading, as *Forms of
salire*. A reader never sees
`salire` offered as a meaning of `sale`, because the source only ever said one
of `sale`'s readings is a form of it.

**An ambiguous lemma link.** `sale` says it is the plural of `sala`, and `sala`
is two entries, a noun and a verb. The link searches the word `sala`, which
shows both, instead of picking one, because picking one would invent a fact.

**Grammar the source never stated.** A form the source does not give is a dash
in its cell, with no note
([design-system-manifest.md § "The result"](../design-system-manifest.md#the-result)). `casa`'s
record has no tags and no forms. Its gender and number come only from its gloss
grammar stamp (`f sing`, #317), and with no forms nothing can be placed in a
grid, so its reading has no *Forms* block.

**Definitions that define nothing.** `casa`'s two glosses are page furniture.
They are shown verbatim when they are all a reading has. When definitions
recovered from the raw page stand in for them, as for `casa`, the furniture is
left out. Only a bare headword line is furniture: where the line goes on to
give a definition (`palo ( approfondimento) pezza onorevole…`), the seed stores
the definition after the link and the page numbers it like any other (#325).
`sala` carries Wikizionario's placeholder *"definizione mancante; se
vuoi, aggiungila tu"*, which is a template, not data: the lookup treats a gloss
that is only that as no definition (#255). A gloss that only repeats the
headword says nothing either: `presina`'s one gloss is `presina f`, and once its
gender stamp is lifted (#317) it reads `presina`. The lookup treats a gloss equal
to the headword, ignoring case, accents, apostrophes and the punctuation around
it, as no definition too (#395); one that only contains the headword (`sci`'s
`sport associato all'attività di andare sugli sci`) stays. A reading with no definition shows
its part-of-speech label alone, with no number, and the readings that have one
number 1, 2, 3 among themselves (#250).

**Definitions the extraction dropped or misfiled.** Where the raw Wiktionary page states a
definition the record does not carry as a definition (#28) — absent, or filed
under an example — the seed recovers it into a layer beside the
record, and the reading lists it after the record's own definitions, with its
examples. The first definition shows its own first example, or none when it
has none: no other definition's example stands in. One control per reading shows
the other definitions and every other example, each under its own definition,
including extra examples on the first definition and examples on nested items. Nothing marks it as recovered
([ADR 0016](../.decisions/0016-page-shows-no-origin-marks.md)); the layer keeps
its own provenance in the data. `casa` shows its seven definitions this way.
When the record filed a recovered definition as an example (`lap steel
guitar`), the page shows that text once, as the definition, and not again as
an example.
An item of a list a definition opens with a colon (`accollato`'s
`attributo araldico che si applica a:`) sits inside that definition as a
bulleted list, whether the definition is the record's or itself recovered
(#123, Huey's ruling: "nest"). Only the top of the list is numbered and counted.
An item nests only where recovery matches the line that opens its list. A
recovered definition is matched by its page line. A sense the record carries is
matched by text: exactly one sense has a gloss equal to the line's text, and no
other `#` line in the section has that text. A gloss that only quotes the line
matches nothing. When there is no match, the item stays numbered at the top of
the list, as before (`filetto`'s heraldic items). A sense that opens such a list is a definition, never
furniture, even when its gloss starts like `casa`'s.

**A search that found nothing.** The page says `No entry for "<query>"` and
offers what is close, in order: the same letters with an accent, a spelling one
edit away, the words that begin with it, or how to search instead
([the lookup reference](LOOKUP.md#when-nothing-is-found)). The old "Nothing in
this release matches … Accents matter" line is gone: the accent step now finds
`città` for `citta` itself.

**A word only its forms name.** About 9,000 lemmas have no record of their own,
but the bot-made records of their forms say which form they are
(`verbalizzo`, "prima persona singolare dell'indicativo presente di
verbalizzare"). Before the not-found page, the page's search reads those
`form_of` edges and shows the word with its forms table: each reading headed by
its part of speech alone (`Verbo`), a verb's forms placed by
`it-verb-form-gloss/v1`, a noun's or adjective's plurals by `it-plural-gloss/v1`
([#453](https://github.com/hueypov/lexema/issues/453)). It shows no
definitions block and says nothing of what the word lacks. A word whose forms
take no cell keeps the not-found page. The developer API's lookup does not do
this, so its answers are unchanged; the probe is `declaredLemma` in
[src/lookup/declaredLemma.ts](../src/lookup/declaredLemma.ts), run from
[web/lib/dictionary/searchAttempt.ts](../web/lib/dictionary/searchAttempt.ts).
The measured reach is in
[the report](../reports/2026-10-03-declared-lemmas.md).

**A lookup that did not happen.** No release, a D1 error, or a release built by
a different normalizer all produce a page that says the lookup failed. That is
deliberately not the "found nothing" message: a reader must be able to tell *we
could not look* from *we looked and the word is not here*. The
reason is logged and not printed: a database message names releases, tables and
bindings, which is the operator's business and not the reader's.

**A form the source listed, and one it did not.** A noun, adjective or
inflecting phrase names its record's own gender and number after its part of
speech in the reading's heading (`1 · Aggettivo · maschile, singolare`), only
what the record states and nothing when it states neither, and shows a
gender-and-number grid; its article lines are rule
`it-articles/v3` (`src/italian/articles.ts`) applied to each spelling, the headword's with the record's own IPA. A form
that states a number but no gender takes the record's gender only when the
record states exactly one; otherwise it takes no cell. A verb shows
a conjugation with mood tabs; which mood a form goes in is rule `it-moods/v1`
(`src/italian/moods.ts`), which reads the shape of the source's row: person
tags for the indicativo, a pronoun beginning *che* for the congiuntivo, a bare
pronoun on a tense-only row for the condizionale. Neither rule is named on the
page (ADR 0016). A form that takes no cell, such as `parlarsi (coniugazione)`,
the link to the reflexive verb, is not shown, and nothing says so: Huey ruled on
2026-09-27 that the result page shows data only, never a note on what it could
not place. Every form that has a cell is shown, variants such as `vo`, `annò`
and `anderò` included. A block with nothing in it is absent.

**Ambiguity in both directions.** A `form_of` edge names a word, and a word can
be several records. The link on a form reading's definition searches that word,
so every record spelling it shows there. A verb form whose lemma word is several
verb records shows each record's table, and shows two identical tables once
(`chiusi` → `chiudere`). A lemma the release has no entry for is not mentioned
(Huey, on #142). The lookup returns every record the
query matches as a reading, and a lemma the query also matched through its
table — `sala` and `salire` for `sale` — is not one of those records but the
lemma of the reading that points to it
([the lookup reference](LOOKUP.md#result-fields)). Any record that lists the
query and is no reading's lemma keeps a reading of its own, drawn like any
other, with no line saying why it is there.

**One expand control.** Etymology, the word lists and Definitions share one
control (`web/components/dictionary/More.tsx`): `+ more` right after what shows, and, open, `less`
at the very end, with no count. It is a native `<details>` placed after all the
content it reveals; that content is its sibling, not its child, and CSS shows it
once the `<details>` is open (`:has(details[open])`). So with the rest hidden
the control follows the last thing that shows, and with it shown the control is
last of all. Everything is in the HTML and opens with no script.

An Etymology block cuts its text to one line with an ellipsis, and open lets it
wrap with `less` after its last word (`web/components/dictionary/OneLine.tsx`). A word list
(`web/components/dictionary/WordList.tsx`) shows the words that fit on its first line: once
hydrated it lays every word out, measures which fit with `+ more` after them,
and hides the rest, again on a resize or when closed. Without a script the
first eight show. In both, a text or list that fits needs no control and shows
none. Definitions show the first definition and its own first example, then
`+ more` under it; open, every definition with its examples in order.

**Once per word.** Pronunciation, etymologies, synonyms, antonyms and derived
words are read from `source_record_json` and render once: the IPA under the
headword, and the facts after the last reading. Syllable breaks are not shown. The source usually
repeats them on every record of a headword, but not always. In release
`it-0c432803`, 16,659 of the 16,792 headwords with more than one record carry
the six fields identically on each; 133 do not. So the page shows the union of
what the records carry, each item once, rather than one record's copy.

**Once per reading, where the source says so.** The records of a headword
usually carry the same etymologies, but not always: `bacca`'s two records list
two and one. The page takes every distinct text from every record once, as it
does for each word fact above, and places each by its own label
(`web/lib/dictionary/readingLabels.ts`). In 2,756 of the 3,276 headwords with two or more
etymologies, each text opens with a bracket label, mostly a part of speech:
`sale` has `(sostantivo singolare)` and `(sostantivo plurale)`.

On a word with two readings or more, an etymology whose label names exactly
one reading moves into it, without the label, even when it is the word's only
one (`strutto`: `(voce verbale) vedi struggere`). A label names a reading whose
`pos_title` is its part of speech or begins with it: `(aggettivo)` names
`sette`'s *Aggettivo numerale*. Words after the part of speech do not stop it
(`dai`'s `(voce verbale di dare)`), and `singolare`/`plurale` or
`transitivo`/`intransitivo` right after it narrow to the reading whose record
states them. A whole label that is itself a `pos_title` with a comma,
`(sostantivo, forma flessa)` on `ori`, names that reading.

A label that names more than one reading does not move, because moving it would
copy one text into two places, and identical things show once. That covers a
compound label naming two readings (`medico`'s `(aggettivo e sostantivo)`) and
a label that fits two readings of the same kind: a bare `(sostantivo)` beside
*Sostantivo* and *Sostantivo, forma flessa* (`sette`), or `(voce verbale)` on
`svolta`, which has two *Voce verbale* readings. An etymology that is only a
label (`cazzi`'s `(voce verbale)`) moves and leaves nothing to show, so its
reading gets no Etymology block.

Synonyms follow the same rule where the source groups them: in 207 headwords a
part-of-speech `raw_tags` on one synonym opens a group that runs to the next
label. `vivere`'s `sostantivo` group moves to its noun reading; its `verbo`
group fits two *Verbo* readings and stays after the readings. Topic labels
(`calcio`'s `(sport)`), unlabelled texts and ungrouped lists stay there too, and
the page says nothing about what it did not match.

## Why a report is stored and nothing more

Every word page ends with `Source ↗ · Report a mistake` (#51). The link opens a
small box: what is wrong, which reading (optional), and details, with no account
and no email. `POST /report` (`web/app/(lexema)/report/route.ts`, `web/lib/dictionary/report.ts`)
stores the report in `reader_report`, in the app database, and changes nothing on the page; a person
reviews it (#12) and may then write a `claim_review` row. A report is not stored
in `claim_review` itself, because that table holds reviewed verdicts, not
reports waiting for one. A report on a reading keeps that reading's source line
and its digest, so a re-seed cannot point it at another record
([docs/RECORD_IDENTITY.md](./RECORD_IDENTITY.md#a-readers-report-names-a-line)).
The person's answer is stored on the report, with `pnpm run report answer`
([DEVELOPMENT.md](../DEVELOPMENT.md#review-a-readers-report)); no page and no
API answer reads a report or its answer.

Spam is kept out in four layers, as ruled on #51: the `REPORT_LIMIT` Worker
binding stops a burst (2 a minute) before D1 is touched, and the ruled 5 reports
an hour is counted over the stored rows, because the binding has no hourly
period; a hidden honeypot field and a 3-second minimum between opening the box
and sending it drop a bot's report while answering it as sent. The 3 seconds are
measured on the server's clock alone: when the box opens it asks `POST
/report/open` for a random token, which is stored with the server's time in
`report_opening`, and the report is timed against it and consumes it when it is
stored, so a reader's clock never enters the check. Cloudflare Turnstile is
checked before storing only when both `TURNSTILE_SITE_KEY` (a var) and
`TURNSTILE_SECRET_KEY` (a secret) are set; with either missing it is off, and
the Worker logs which key is missing, so a half-configured Worker never refuses
every report. After any answer that did not store the report, the box resets the
widget for a fresh token, because a token can be used once. The visitor is
stored as a SHA-256 of their rate-limit key, never as an address.

## Why a disputed claim is a row and not a code path

A disputed claim is left untouched, and the result page does not show the
dispute: Huey ruled on 2026-09-27 that the page shows data only, with no note
on disputed data. The verdicts come from `claim_review` rows, and no seed
writes one: Huey ruled on 2026-09-23 that no dispute comes from Lexema (#117).
Disputes and corrections come from readers' reports (#51), which a person
reviews (#12). Who reviews, on what evidence, and how a verdict is reached is
still #12; what is settled is that a review is data beside the claim, never a
change to it.

The importer copies the source and says nothing about whether it is right; a
review is a claim about the source, made on evidence the source does not
contain, so it is a separate write over a release the import already made.

## Why the source link is labelled the way it is

The page ends with exactly one *Source* link, labelled *Source* and nothing
more. It opens the Italian Wiktionary page of the spelling in the page's title:
`macchina` links to *macchina*'s page, which holds both the noun and the form of
*macchinare*, and `andavano` links to *andavano*'s page though it also shows
`andare`'s table. A searched expression's short page links to the expression's
page instead: `vado via` links to `andare via`'s page, never the searched
word's; a search that spells two expressions links to the first one the page
shows: `volto le spalle` links to *voltare le spalle*
([#291](https://github.com/hueypov/lexema/issues/291);
[design law](../design-system-manifest.md#layout)).
[ADR 0009](../.decisions/0009-two-licences-and-a-source-link.md), as amended on
[#281](https://github.com/hueypov/lexema/issues/281), keeps the credit itself on
`/attribution`, which the site footer reaches from every page, and in each API
result's `attribution` field. Its accessible name is longer than its text —
"Wiktionary page for X, the source of this page (opens in a new tab)".

Every link that leaves Lexema opens in a new tab (`target="_blank"
rel="noopener noreferrer"`, `web/components/shared/ExternalLink.tsx`), so the page stays where
the reader left it: the Source links on a result, and the credit, licence and source links on `/attribution`. Each says
so to a screen reader. Links inside Lexema stay in the same tab.

The release stores no per-record URL, so the link is *constructed* from the
headword rather than recorded with the data. Each reading still carries its
record's archive line as `data-line`, so the page stays checkable against the
release without printing the line on the page.

## Why the credit is on its own page

The search page carries no credit line, no licence name and no contributor text.
That is ADR 0009's ruling, and the licence permits it: CC BY-SA 4.0 lets the
credit be satisfied by a link to a page that carries the required information.
`/attribution` is that page — the contributors, the page histories where their
names are, the licence with its link, what Lexema restructured, and where the
served release came from: the Wiktionary dump and the kaikki.org download. Only
those two, by Huey's ruling on [#133](https://github.com/hueypov/lexema/issues/133);
the release's other facts are in
[`src/source/archiveFacts.ts`](../src/source/archiveFacts.ts).

`components/dictionary/Attribution.tsx` is the markup, and `app/(lexema)/attribution/page.tsx` is the wiring.
The page reads no database: it shows the published archive's source from
`src/source/archiveFacts.ts`, so it shows it even while production has no D1. A
fact that is not recorded renders as *not recorded* in words, and a field the draft in
[ATTRIBUTION_NOTICES.md](ATTRIBUTION_NOTICES.md) leaves open renders as open,
naming what would settle it. Neither a blank nor a plausible-looking value is
allowed to stand in for either.

## Why the seed goes through generated SQL

Local D1 is reached through `wrangler d1 execute --file`. The archive parser
streams each admitted record into batched D1 SQL; there is no SQLite staging
database, prefix cutter, or second import/export path. The development seed
uses the committed fifty-word `fixtures/dev-seed.jsonl` and applies that SQL to
an isolated `.data/seed-state` database. The full archive is maintained at
[`source/it-extract.jsonl.gz`](https://github.com/hueypov/lexema-data/blob/main/source/it-extract.jsonl.gz);
a local copy at the repository root remains gitignored. The same seed loads a
full release in numbered SQL parts
([RUN_AN_IMPORT.md § Run it](RUN_AN_IMPORT.md#run-it)).

## Why local work uses a committed fixture

The fixture is a bounded, reviewable fifty-word set with its transitive
`form_of` closure. It lets a fresh checkout exercise the same parser,
provenance, lookup, and grammar projection without downloading the archive or
silently serving an incomplete archive as a complete release. A query for a
word outside that set is an honest empty result. To run against another archive,
set `SEED_INPUT`; the local full-archive copy is conventionally
`it-extract.jsonl.gz` at the repository root.

## Known rough edges

- No favicon, so the dev log carries a 404 for it.

## Not in scope

Attaching D1 in production and smoke tests
against a real URL (#19). Deploying is [DEPLOY.md](DEPLOY.md).
