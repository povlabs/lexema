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
`developers/` and a `shared/` folder. `worker/` is the code that answers a
request before vinext does, split the same way, plus `api/` for the JSON API;
its one file outside a site folder is `index.ts`, the entry that wires the
sites together. Code imports through `@/`, which is
`web/` (`@/components/dictionary/Word`), set in both `vite.config.ts` and
`tsconfig.json`.

```
web/app/(lexema)/        lexema.fyi: the search page, /licence, /privacy, /suggest and /report
web/app/(developers)/    developers.lexema.fyi: landing, docs, pricing, sign-in, the dashboard
web/components/dictionary/   the word page, the search field, the site's header and footer
web/components/developers/   the developer site's pages, its docs, menus and sign-in
web/components/developers/dashboard/  the dashboard, its dialogs and toasts
web/components/shared/   what both sites draw: links, icons and styles.ts, the one home of class strings
web/lib/dictionary/      the query, the lookup attempt, the page's grammar, reports
web/lib/developers/      the API reference, the docs pages, the dashboard's view and actions
web/lib/shared/          what both sites call: the two D1 bindings and the search shortcut
web/worker/index.ts      the Worker's entry, the one file that imports every site
web/worker/dictionary/   a shared link's card, and which dictionary requests the limits count
web/worker/developers/   sign-in, whether sign-up is open, billing, the dashboard's actions, Stripe's webhook, and their limits
web/worker/api/          the JSON API at api.lexema.fyi
web/worker/shared/       the hosts, the stage, the request log, the health check and the rate-limit counter
```

A dictionary file never imports from a `developers/` folder, nor the other way
round; what both need goes in `shared/`, which imports from no site. The API
may import dictionary code, since it is the dictionary in another format, but
not developer-site code; the developer site may import API code, which it
documents and meters. [web/test/layout.test.ts](../web/test/layout.test.ts)
fails `pnpm test` when an import crosses, when a file under `components/`,
`lib/` or `worker/` sits in no site's folder, or when anything but a route file
lands in `web/app/`.

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
web/worker/shared/hosts.ts                 which of the three hosts a request is for, and where it goes
web/worker/shared/rateLimit.ts             counts a request against whose count, and answers it once blocked
web/worker/dictionary/limits.ts            which dictionary requests are counted; developers/limits.ts, the developer site's
web/worker/developers/dashboard.ts         the developer dashboard's actions: make or revoke a key, delete the account;
                                           and its pages' guard: sign-in without a session, a new key's secret shown once
web/components/developers/dashboard/Dashboard.tsx  the dashboard's markup; what it shows is web/lib/developers/dashboardView.ts
src/lookup/                                the query layer, shared with the importer's tests
web/test/page.test.tsx                     the page, rendered over a fixture release
web/test/wordPageRules.test.tsx            one page-wide check per word-page rule, on real words; a rule not built is a todo
web/test/wordPageShapeWords.ts             one real word for each page shape of the #707 census, which those checks run on
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
*un dizionario semplice* under it, and the search field, centred on the screen
([design-system-manifest.md § "The page"](../design-system-manifest.md#the-page));
with a query, the field moves to the top and the result fills the page. Both
are this one server-rendered route.

The query arrives in the URL, the D1 read happens on the Worker, and the HTML
that comes back already holds the answer. Two things follow, and each was the
point rather than a side effect: the page works before any JavaScript loads, and
a result is shareable by copying the address bar.

There is no loading state on the page
([#115](https://github.com/povlabs/lexema/issues/115)). The HTML waits for the
D1 read and carries the result in place, so it is visible with JavaScript off.
The page used to wrap the read in a `Suspense` boundary that flushed a
*Searching for …* line first. React sends the finished result after that line,
hidden, and only an inline script swaps it in, so without JavaScript a reader saw
the loading line and never the result. While the read runs, the browser shows
its own page-loading indicator instead. The search form, the home page and every
link are plain HTML and work without JavaScript; the suggestion list, the mood
tabs and `+ altro` need it.

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
minute ([#128](https://github.com/povlabs/lexema/issues/128)). The numbers are
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
the searched form renders its whole conjugation under the reading, as *Forme di
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
`sport associato all'attività di andare sugli sci`) stays. A reading with no definition has no
*Definizioni* block, and it is numbered like every other reading: `salivare`
reads `1 · Aggettivo` then `2 · Verbo` (#687, reversing #250). A reading with
nothing to show at all, `litigante`'s noun, is left out before numbering, so
`litigante` reads `1 · Aggettivo` then `2 · Voce verbale`; a page where no
reading has anything to show keeps their headings (#694). When it has only one,
that heading is the part of speech alone, with no number (`LoneBareReading`):
`fare l'abitudine` reads `Locuzione verbale`, and the report dialog names it
the same way (#696).

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

**A search that found nothing.** The page says `Nessuna voce per "<query>"` and
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
([#453](https://github.com/povlabs/lexema/issues/453)). It shows no
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
([the lookup reference](LOOKUP.md#result-fields)). Only the records about the
query are readings: a record that only lists the query in its table is another
word's, and shows only as the verb of a block, below. `costruttrici` shows none
of costruttore's or costruttori's records, and `grande` not `grandissimo`,
whose only tie is its gloss (Huey's rule 2 of 2026-10-06,
[#695](https://github.com/povlabs/lexema/issues/695#issuecomment-6024404411);
[design law](../design-system-manifest.md#how-a-word-page-renders)). The
lookup and the API still return them.

A page none of whose records about the query has anything to show (`gravida`,
`citta`) draws the records that list the query instead. A noun or adjective
record, not itself a form, whose plain grid spells the query in a cell is a
grid's form block, as a form record's block reads (Huey's rule 4 of
2026-10-06, built by [#700](https://github.com/povlabs/lexema/issues/700)):
`gravida` shows `1 · Aggettivo, forma flessa · femminile, singolare`, the base
record's part of speech with `forma flessa` and the cells' gender and number,
then one line per cell built by rule `it-grid-form-line/v1`
([`gridFormLine.ts`](../web/lib/dictionary/gridFormLine.ts)), "femminile
singolare di gravido", in the names the grid heads its rows and columns with,
then gravido's *Definizioni* and *Forme di gravido* (`GridFormBlock`). Like a
verb form line, the line is Lexema's text, built when the page is built, never
stored, and unmarked on the page (ADR 0008, 0012, 0016). The other records
keep their readings, as every page did before #695, less two kinds of form;
#696 ruled only that a lone one carries no number. A record
that lists the query and declares itself a form of a reading about the query
has no reading of its own, and nor has a record that declares itself a form of
one of those:
`bello`'s page does not repeat `bella`, `belli`, `bellissimo` and
`bellissime`, whose table its own reading already shows (Huey, 2026-10-05, on
#622; `formsOfQueryReadings` in `src/lookup/types.ts`). In the same way, a
record that lists the query and declares itself a form of a lemma that a
reading about the query is a form of has no reading of its own, and nor has a
record that declares itself a form of one of those: `bella`'s page does not
show `belli`, `belle`, `bellissimo` or `bellissime`, since they are forms of
`bello` as `bella` is, and `studenti`'s does not show `studentessa`, another
form of `studente` (Huey, 2026-10-05, on
[#626](https://github.com/povlabs/lexema/issues/626): "bella is the same as
bello"; `otherFormsOfQueryLemmas` in `src/lookup/types.ts`). Only a declared
`form_of` edge counts, never a gloss, and a record is matched by its identity.
The lookup still returns those records, and the lemma reading lists them under
its inflections. Any other record that lists the query keeps a reading of its
own, drawn like any other, with no line saying why it is there: a record that
declares no `form_of` edge, or one whose edge names some other word.

A noun or adjective form about the query shows its base word's grid, the one
that word's own reading draws, as *Forme di bello* under `bella`'s adjective
reading and *Forme di casa* under `case`, in place of its own grid
([ruling](https://github.com/povlabs/lexema/issues/626#issuecomment-6001258715)),
with nothing marked. Its base word is the word its `form_of` edge names, of its
own part of speech when it names one, followed through a record that is itself
a form to the word that one names: `bellissima` → `bellissimo` → `bello`, and
`costruttrici` → `costruttrice` → `costruttore` (Huey's rule 1 of 2026-10-06,
[#695](https://github.com/povlabs/lexema/issues/695#issuecomment-6024404411)).
Every base word whose table lists the form shows, through a `forms[]` entry the
query hit on the edge's candidate or the form's own plural gloss (#145); when
none does, the first base word shows anyway, as a verb's table does (#666):
`lavoratrici` shows lavoratore's noun grid, which lists only `lavoratori`.
`parti`'s record names `parte`, and, on two lines about `parto`, `neonato` and
itself (`Parti`); only parte's table lists it, so only parte's shows. A link
that names only the query's own records is no base word. The search reads the
base records with the same lookup a search of the word runs, one more round for
each link of a chain (`web/lib/dictionary/searchAttempt.ts`); the lookup and the
API do not change.

The form records about the query of one base word are one block (rule 1,
"never two blocks … for the same word"): `pageDrafts` puts each noun or
adjective form in the slot of the first form of its first base word, so
`costruttrici`'s, `bella`'s and `grandi`'s adjective and noun records each
show as one block. The first record heads it (`FormOfReading.reading`), the
others ride in `also`, and the form lines list every record's in turn, a line
another record already gave shown once with both records' examples
(`recordLinesOf`, `definitionTextKey`). The block's *Definizioni* are those of
the first record's first base word, as a verb form block reads its first
table's; its tables are one per base word.

A table shows once on a page, and so does one base record's *Definizioni*
(`Drawn` in `wordPage.ts`; rule 1, "never two … tables for the same word"):
`essere`'s and `vivere`'s two verb records draw one conjugation, under the
first, and a base word's grid shows once, whichever of its records it is read
from.

**One block per verb a form belongs to.** A searched verb form shows one block
for each verb it is a form of, as frame 37 draws it
([#636](https://github.com/povlabs/lexema/issues/636), Huey's ruling of
2026-10-06): `1 · Voce verbale · salire`, that verb's form-of lines right under
it with no label, then *Definizioni*, the verb record's own, then *Forme di
salire*, the verb's conjugation opened where the searched cell is (frames 17 and
37, [#686](https://github.com/povlabs/lexema/issues/686)). The definitions are
those of the record whose table the block shows first: a verb that is a reading
brings its own, and a verb a form record names has its senses read by
`withVerbDefinitions` (`src/lookup/lookup.ts`) in the same wait as the search's
other reads after the lookup, so a page sends more statements and no more calls
(`web/test/pageStatements.test.ts`). A noun or adjective form that shows its
lemma's grid draws the same way, its own lines under its heading and the lemma
record's definitions as its *Definizioni*. The table is a lemma link's `listing` or the verb reading's
own `forms`, both already in the lookup's answer, so the page reads nothing
more for it; a verb whose table does not list the form (`andati`: andare's lists
only `andato`) has a block with no table. A block's lines come from two places:

- A form record about the query. Each of its definitions goes to the verb its
  `form_of` edge names: `salivate`'s record gives salivare's block its two
  lines, and `saliva`'s, which names salivare on one sense and salire on the
  other, gives one line to each. A definition with no edge at all goes to the
  record's first verb (`macchina`'s second sense). A record with a definition
  whose edges name only words that are not verbs keeps its reading, unsplit
  (`andarsene`'s "andare sovrappensiero").
- A verb on the page whose own table lists the query, when no record about the
  query names that verb. A compound form such as `sono andato` is only a cell
  of andare's table, and `salivate` is a cell of salire's that no record says
  it is. The block's lines are one per cell the query hit, built by rule
  `it-verb-form-line/v2` ([src/italian/verbFormLine.ts](../src/italian/verbFormLine.ts)):
  "prima persona singolare del passato prossimo indicativo di andare"
  ([#627](https://github.com/povlabs/lexema/issues/627)). The shape is fixed —
  person, number, `del` or `dell'` and the tense, the mood, `di` and the verb —
  and the tense and mood are the names the table shows (`TENSE_NAMES` in
  `src/italian/moods.ts`), read from the same placement the table marks, so the
  line and the cell never disagree. A cell of the non-finite line is named as
  the table names it (`NON_FINITE_NAMES`), then `di` and the verb: `stato`,
  which essere's table lists only as its participio, gets essere's block with
  "participio di essere" (v2,
  [#695](https://github.com/povlabs/lexema/issues/695)). `siamo andati` fills a cell of the
  indicativo and one of the congiuntivo and gets both lines; identical lines
  show once. The verb's record has no reading of its own: its table and its
  definitions are the block's. These blocks lead the page.

An imperative, the infinitive and a cell `it-moods/v1` cannot place give no
line, and a verb with no line gives no block; on a page with a record about the
query that shows something, it is no reading either (rule 2). A word that is
also an entry of its own (`sale` the noun, `andare` itself) keeps that entry as
a normal reading. The rule-built line is Lexema's text, a grammatical
paraphrase built from source tags (ADR 0008), built when the page is built
(`web/lib/dictionary/wordPage.ts`) and never stored by the seed (ADR 0012). The
page shows no mark for it (ADR 0016); its type, `VerbFormLine`, carries
`sourceType: "lexema-deterministic"`, the rule and the pointer of the `forms[]`
entry it was built from, apart from a source line by type. A block has its own
anchor, named by its verb, and its jump link reads `3 Voce verbale · salire`.
Jump links start at three readings, or at two readings about two different
words, as ruled in
[design-system-manifest.md § 2](../design-system-manifest.md#2-numbers-and-jump-links):
`studente` lists `1 Sostantivo` and `2 Voce verbale · studiare`, and `salivate`
lists `1 Voce verbale · salire` and `2 Voce verbale · salivare`
(`showsJumpLinks` in `wordPage.ts`,
[#654](https://github.com/povlabs/lexema/issues/654),
[#714](https://github.com/povlabs/lexema/issues/714)). The report dialog names every record
a block shows, its form records and the verb records its lines were built from,
once each, under the block's number and heading. The lookup and the API do not
change.

**One expand control.** Etymology, the word lists and Definitions share one
control (`web/components/dictionary/More.tsx`): `+ altro` right after what shows, and, open, `meno`
at the very end, with no count. It is a native `<details>` placed after all the
content it reveals; that content is its sibling, not its child, and CSS shows it
once the `<details>` is open (`:has(details[open])`). So with the rest hidden
the control follows the last thing that shows, and with it shown the control is
last of all. Everything is in the HTML and opens with no script.

An Etymology block cuts its text to one line with an ellipsis, and open lets it
wrap with `meno` after its last word (`web/components/dictionary/OneLine.tsx`). A word list
(`web/components/dictionary/WordList.tsx`) shows the words that fit on its first line: once
hydrated it lays every word out, measures which fit with `+ altro` after them,
and hides the rest, again on a resize or when closed. Without a script the
first eight show. In both, a text or list that fits needs no control and shows
none. Definitions show the first definition and its own first example, then
`+ altro` under it; open, every definition with its examples in order.

**Once per word.** Pronunciation, etymologies, synonyms, antonyms and derived
words are read from `source_record_json` and render once: the IPA under the
headword, and the facts after the last reading. Syllable breaks are not shown.
The etymologies and word lists are those of the records about the query that
are not forms: what a form record says of its word (`vedi bello` on `bella`,
`da andare` on `vada`, `si · muova` as vada's synonyms) is its base word's,
and no page shows it, and no page shows a base word's *Expressions* (Huey's
rule 3 of 2026-10-06 on
[#695](https://github.com/povlabs/lexema/issues/695#issuecomment-6024404411),
built by [#700](https://github.com/povlabs/lexema/issues/700)). A form
record's own expressions, its pronunciation and its hyphenation are the
searched word's, and stay (`andate`'s Expressions). The source usually
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
one reading moves into it, without the label (`sale`'s `(sostantivo
singolare)`). One whose label names only form-of readings, one or more, shows
nowhere: it is the base word's (rule 3, #700), as `sale`'s `(sostantivo
plurale) vedi sala` and `strutto`'s only one, `(voce verbale) vedi struggere`,
are. So no form's reading or block has an Etymology or Synonyms of its own
(P14). A label names a reading whose
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
*Sostantivo* and *Sostantivo, forma flessa* (`sette`), or `(sostantivo)` on
`stato`, which has two *Sostantivo* readings, `stato` and `Stato`. An etymology that is only a
label (`cazzi`'s `(voce verbale)`) moves and leaves nothing to show, so its
reading gets no Etymology block.

Synonyms follow the same rule where the source groups them: in 207 headwords a
part-of-speech `raw_tags` on one synonym opens a group that runs to the next
label. `vivere`'s `sostantivo` group moves to its noun reading; its `verbo`
group fits two *Verbo* readings and stays after the readings. A group whose
label names only form-of readings shows nowhere, as such an etymology does. Topic labels
(`calcio`'s `(sport)`), unlabelled texts and ungrouped lists stay there too, and
the page says nothing about what it did not match.

## Why a report is stored and nothing more

Every word page ends with `Fonte ↗ · Segnala un errore` (#51). The link opens a
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

A search that finds nothing ends with `Segnala una parola mancante` (#441), which
opens the same box on the trimmed query, through the same `POST /report` and
spam layers. There the box asks no "what is wrong" and offers no reading: it
sends `missing`, a sixth `choice` the word page never offers, and the report is
stored with the query as its `word`, no `record_id` or source line, and the
served release. While it waits, its details are optional and may be stored
empty, and every other waiting report needs some; once any report is answered,
it has none (see below). `reader_report` CHECKs refuse a `missing` report that
names a record, and empty details on any other waiting report.

Spam is kept out in four layers, as ruled on #51: the `REPORT_LIMIT` Worker
binding stops a burst (2 a minute) before D1 is touched, and opening the box
counts against `REPORT_OPEN_LIMIT`. Both bindings count every spelling vinext
routes to the same handler: a `.rsc` suffix (`/report/open.rsc`), and repeated
slashes or dot segments (`/report//open`), which vinext collapses before it
matches a route (`routePathOf` in `web/worker/shared/hosts.ts`, #621).
`/suggest` is counted the same way. And the ruled 5 reports
an hour is counted over the stored rows, because the binding has no hourly
period; a hidden honeypot field and a 3-second minimum between opening the box
and sending it drop a bot's report while answering it as sent. The 3 seconds are
measured on the server's clock alone: when the box opens it asks `POST
/report/open` for a random token, which is stored with the server's time in
`report_opening`, and the report is timed against it and consumes it when it is
stored, so a reader's clock never enters the check. Cloudflare Turnstile is
checked before storing when both `TURNSTILE_SITE_KEY` (a var) and
`TURNSTILE_SECRET_KEY` (a secret) are set, and a pass counts only when
siteverify names the request's own hostname. On a local or Preview Worker with
either key missing it is off, and the Worker warns which key is missing, so a
half-configured Worker never refuses every report. On production it fails
closed instead (#621): with either key missing, `POST /report` and `POST
/report/open` answer `failed` with a 503 and the Worker logs an error naming the
missing key, so bot protection never switches off unseen. After any answer that
did not store the report, the box resets the widget for a fresh token, because a
token can be used once.

The visitor is stored as a one-way code, never as an address: the
HMAC-SHA-256 of their rate-limit key under the Worker secret
`REPORT_VISITOR_KEY`, as 64 hex characters (#621). Without that secret no
address can be tried against a code. With it unset or blank, `POST /report`
answers `failed` with a 503, stores nothing, and the Worker logs `report box
closed: REPORT_VISITOR_KEY not set`; every other route keeps serving. Where each
stage gets the secret is [DEPLOY.md](DEPLOY.md#set-the-report-boxs-secrets) and
[RUN_THE_SITE.md](RUN_THE_SITE.md#send-a-report-locally).

A report keeps the reader's own data only while it serves, as Huey ruled on
2026-10-04 (#570). The visitor code serves only the hourly count, and anyone
holding `REPORT_VISITOR_KEY` could still try addresses against it, so it is erased one hour after the report: the
Worker's cron trigger, every five minutes, sets `visitor_hash` to NULL on each
report received an hour ago or earlier (`forgetVisitors`,
`web/worker/dictionary/reportSweep.ts`). The reader's note is erased when the
report is answered, in the same write as the answer, and a `reader_report`
CHECK refuses an answered report that still has one. The report itself stays,
and nothing deletes it. D1 Time Travel keeps up to 30 days of history, so an erased
value can last there that long
([docs/RUN_THE_SITE.md](./RUN_THE_SITE.md#roll-back)).

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

The page ends with exactly one *Fonte* link, labelled *Fonte* and nothing
more. It opens the Italian Wiktionary page of the spelling in the page's title:
`macchina` links to *macchina*'s page, which holds both the noun and the form of
*macchinare*, and `andavano` links to *andavano*'s page though it also shows
`andare`'s table. A searched expression's short page links to the expression's
page instead: `vado via` links to `andare via`'s page, never the searched
word's; a search that spells two expressions links to the first one the page
shows: `volto le spalle` links to *voltare le spalle*
([#291](https://github.com/povlabs/lexema/issues/291);
[design law](../design-system-manifest.md#layout)).
[ADR 0009](../.decisions/0009-two-licences-and-a-source-link.md), as amended on
[#281](https://github.com/povlabs/lexema/issues/281) and
[#139](https://github.com/povlabs/lexema/issues/139), keeps the credit itself on
`/licence`, which the site footer reaches from every page, and in each API
result's `attribution` field. Its accessible name is longer than its text —
"Wiktionary page for X, the source of this page (opens in a new tab)".

Every link that leaves Lexema opens in a new tab (`target="_blank"
rel="noopener noreferrer"`, `web/components/shared/ExternalLink.tsx`), so the page stays where
the reader left it: the Source links on a result, and the credit, licence and source links on `/licence`. Each says
so to a screen reader. Links inside Lexema stay in the same tab.

The release stores no per-record URL, so the link is *constructed* from the
headword rather than recorded with the data. Each reading still carries its
record's archive line as `data-line`, so the page stays checkable against the
release without printing the line on the page.

## Why the credit is on its own page

The search page carries no credit line, no licence name and no contributor text.
That is ADR 0009's ruling, and the licence permits it: CC BY-SA 4.0 lets the
credit be satisfied by a link to a page that carries the required information.
`/licence` is that page ([#139](https://github.com/povlabs/lexema/issues/139)):
the licence and what it allows, the sources and where each entry's authors are
recorded, what Lexema adapted, the release the content is up to date with, the
no-warranty notice and the trademark line. Its words are Huey's approved text,
in a faithful Italian version since #791. `/privacy` beside it is the Privacy
notice, and the footer on every page links *Licenza*, *Privacy*, *Contatti* and
*API*, marking the page being shown. *API*, named *Sviluppatori* until
[#796](https://github.com/povlabs/lexema/issues/796), links the developer site.

`/attribution`, the page's old address, answers a permanent redirect to
`/licence` (`worker/shared/hosts.ts`). A browser never sends a URL's fragment, so
`/licence`'s sections carry the old page's ids: `#licence`, `#where`, `#changed`,
`#version` and `#trademarks` land on the sections that replaced them.

`components/dictionary/Licence.tsx` and `Privacy.tsx` are the markup, over the
shared `LegalPage.tsx`, and `app/(lexema)/licence/page.tsx` and
`app/(lexema)/privacy/page.tsx` are the wiring. The Licence page reads no
database. The release it names is read from the change declarations in
`dictionary-changes/` when the site is built (`web/vite.config.ts`): the
`update:auto` feed release built from the latest dump, or the master release
when no declaration feeds one, with its dump from
[`src/source/archiveFacts.ts`](../src/source/archiveFacts.ts)
(`src/source/servedRelease.ts`). A release with no recorded dump fails the build
rather than show a page without one.

## Why the seed goes through generated SQL

Local D1 is reached through `wrangler d1 execute --file`. The archive parser
streams each admitted record into batched D1 SQL; there is no SQLite staging
database, prefix cutter, or second import/export path. The development seed
uses the committed fifty-word `fixtures/dev-seed.jsonl` and applies that SQL to
an isolated `.data/seed-state` database. The full archive is maintained at
[`source/it-extract.jsonl.gz`](https://github.com/povlabs/lexema-data/blob/main/source/it-extract.jsonl.gz);
its local copy lives in the gitignored source cache, `.data/source/`. The same seed loads a
full release in numbered SQL parts
([RUN_AN_IMPORT.md § Run it](RUN_AN_IMPORT.md#run-it)).

## Why local work uses a committed fixture

The fixture is a bounded, reviewable fifty-word set with its transitive
`form_of` closure. It lets a fresh checkout exercise the same parser,
provenance, lookup, and grammar projection without downloading the archive or
silently serving an incomplete archive as a complete release. A query for a
word outside that set is an honest empty result. To run against another archive,
set `SEED_INPUT`; the local full-archive copy is
`.data/source/it-extract.jsonl.gz`, which `pnpm run source:fetch` fetches from
`povlabs/lexema-data`.

## Known rough edges

- No favicon, so the dev log carries a 404 for it.

## Not in scope

Attaching D1 in production and smoke tests
against a real URL (#19). Deploying is [DEPLOY.md](DEPLOY.md).
