# Word pages with nothing to show, and what their Wikizionario pages hold

Read-only measurement for [#699](https://github.com/povlabs/lexema/issues/699),
2026-10-06. It counts the headwords whose word page has no reading that shows
anything, and reads each one's raw page. It changes no rule, writes no
dictionary row and adds no change declaration. The questions at the end are
also posted [on the issue](https://github.com/povlabs/lexema/issues/699#issuecomment-6025929392).

The [machine-readable list](2026-10-06-empty-word-pages.json) has every counted
headword: its readings (record id, part of speech, archive line), its page
revision, its class and, for each class, the page lines the class rests on.

## What was run

| | |
|---|---|
| Release | `it-0c432803`, archive SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf` |
| Dump | `itwiktionary-20260701` (SHA-1 `2bdd444236f7dcd26fee3652dbd641c31d0d9651`) |
| Seed | `seedSql` into a local SQLite file, as a full-release `pnpm run seed:dev` seeds: raw pages, the recovered layer (#28), the page-only entries, both hiding rules and the curated corrections. No feed is applied. |
| Rule | `searchAttempt` and `wordPage()` ([wordPage.ts](../web/lib/dictionary/wordPage.ts)) at `origin/main` 996d1d8, after #694 |
| Script | [tools/measureEmptyWordPages.ts](../tools/measureEmptyWordPages.ts), with [tools/emptyWordPages/](../tools/emptyWordPages/) |

Re-run it from the repository root, with the archive and dump in
`.data/source/`. The seed takes about 3 minutes, the search about 20, and the
work directory must not exist yet:

```sh
pnpm exec tsx tools/measureEmptyWordPages.ts seed .data/source/it-extract.jsonl.gz .data/source/itwiktionary-20260701-pages-articles.xml.bz2 <work dir>
TSX_TSCONFIG_PATH=web/tsconfig.json pnpm exec tsx tools/measureEmptyWordPages.ts search .data/source/it-extract.jsonl.gz .data/source/itwiktionary-20260701-pages-articles.xml.bz2 <work dir>
TSX_TSCONFIG_PATH=web/tsconfig.json pnpm exec tsx tools/measureEmptyWordPages.ts classify .data/source/it-extract.jsonl.gz .data/source/itwiktionary-20260701-pages-articles.xml.bz2 <work dir> > reports/2026-10-06-empty-word-pages.json
```

## Which pages count

The script searches every headword of the release, 541,433 of them: each
distinct `word` of an archive record or a page-only entry. It searches the way
the page does (`searchAttempt`), then builds the page with `wordPage()`. A
headword counts when every reading the page lists is a bare reading. That is
the rule #694 set: a reading shows nothing when it has no definition or example
of its own, no `Form of` line, no table of its own or of a lemma, and no
etymology or synonym tied to it. Recovered definitions and lemma lines count,
because `wordPage()` counts them.

| Search result | Headwords |
|---|---:|
| A page where some reading shows something | 540,165 |
| **A page where every reading is bare** | **1,261** |
| No page: the search finds nothing | 7 |

The rough scan on #696 found about 510. Most of the gap is the `{{Nodef}}`
placeholder: 871 of the 1,277 records behind these pages carry the gloss
`definizione mancante; se vuoi, aggiungila tu`. A scan that counts any gloss
counts those records as having one, and the page does not show it.

## The three classes

Each headword's raw page is read twice:

- By the existing readers: the recovered layer (`recoverDefinitions` in
  [recovery.ts](../src/italian/recovery.ts), ADR 0012), run for each record the
  page shows, and the readers of rules `italian-page-entry/v1` and `v2`
  ([wikitext.ts](../src/italian/wikitext.ts)).
- By a measurement's detector, `definitionTextLines` in
  [pageText.ts](../tools/emptyWordPages/pageText.ts). It finds Italian
  definition text in any layout and names the layout. It is not a parsing rule:
  nothing reads it but this script. It reads the lines of each Italian
  part-of-speech section, and the prose between `{{-it-}}` and the first
  heading. A line counts when words are left once templates, links, pictures,
  bold runs, the headword and grammar words are gone. A line under a `#` line
  with `{{Nodef}}`, and an italic line anywhere but a `#` line or the headword
  line, do not count: those are the page saying it has no definition, and
  usage examples.

| Class | Meaning | Headwords |
|---|---|---:|
| Truly empty | The raw page has no Italian definition text | **1,079** |
| Already recovered | An existing rule reads text the release does not carry | **0** |
| Missed | The page has Italian definition text that no admitted rule reads | **182** |
| **Total** | | **1,261** |

Every counted headword has a raw page, and every truly empty page has at least
one Italian part-of-speech section. 863 of the 1,079 truly empty pages write
`{{Nodef}}` there themselves.

A looser check backs the truly empty class. Every line of those 1,079 pages
outside the translation, syllable, pronunciation, etymology, reference and
related-word sections was listed when it held one word or more. 78 pages hold
such a line, and each was read by hand. None is a definition: each is a
headword line with its grammar stamp (`{{Pn}} ''m sing''`, `{{Pn}} ''g ding''`),
a bold headword with nothing after it but grammar or its spelling variants
(`'''Valter, [[Walter]], [[Gualtiero]]'''  ''m''`), a `#` line that only
repeats the headword (`# '''sci di fondo''';`), a `{{Nodef}}` line, a usage
sentence under one (`fondarsi`), or `{{Transitivo|it}}hhhhhhhh` on
`diplomatizzare`. One page is close: `maggioria` writes
`# [[prevalenza]], [[superiorità]].` under `{{-sin-}}`, and this report reads it
as that section's synonyms.

### The two named pages

- **`sbucciapatate`: truly empty.** Revision 3994965. Its only Italian section
  opens on line 2, `{{-sost-|it}}`. Line 3, `'''sbucciapatate'''`, is the bold
  headword and nothing else. Line 4 opens `{{-trad-}}`.
- **`ottemperanza`: missed, layout `headword-line-italic`.** Revision 3712308.
  Its section opens on line 2, `{{-sost-|it}}`. Line 3 is
  `{{Pn}} ''f sing  osservanza e applicazione di quanto stabilito da un'autorita' o imposto come obbligo.''`:
  the grammar stamp `f sing` and the definition sit in one italic run on the
  headword line. The recovered layer reads only lines below a `#` line, and
  this page has none.

## The missed headwords, by layout

All 182 missed headwords have an archive record. Rules `italian-page-entry/v1`
and `v2` admit only a page with no record (ADR 0024, ADR 0028), so the one
admitted reader for these pages is the recovered layer. It reads none of them:
its sections hold no `#` line with text below it. So **no group is read by an
existing, admitted rule.** The `v2` reader reads `demotivare`'s two `#` lines,
but that rule does not admit a page with a record.

| Layout | Headwords | Read by an admitted rule | Examples |
|---|---:|---|---|
| `*` bullet line under the part-of-speech heading (`bullet-line`) | 99 | none | `decrepito`, `agamico`, `centouno` |
| Plain line under the part-of-speech heading, no list mark (`prose-line`) | 64 | none | `bavaglio`, `museruola`, `furbo` |
| `:` indented line (`indented-line`) | 9 | none | `coi`, `sugli`, `sforzare` |
| `#` line under a stray heading: `{{-sill-}}`, `{{-trad-}}` before its box, `====Pronuncia====` (`hash-line`) | 4 | none (`v2` reader reads `demotivare`, not admitted) | `longanimità`, `trasgressivo`, `demotivare`, `live` |
| `#*` line with no `#` line above it (`hash-sub-line`) | 2 | none | `harmonium`, `casaccio` |
| Definition after the headword on the headword line (`headword-line-plain`) | 2 | none | `clavicembalista`, `comignolo eolico` |
| Definition inside the italic grammar stamp (`headword-line-italic`) | 1 | none | `ottemperanza` |
| `;` line under the part-of-speech heading (`semicolon-line`) | 1 | none | `scafandro` |
| **Total** | **182** | | |

81 of the 99 bullet-line pages are numbers, such as `centouno`:
`* {{Term|matematica|it}} [[numero]] che viene dopo il [[cento]] e prima del [[centodue]]`.
In the prose-line group, 9 are acronym expansions (`SIAE`, `ENAV`) and 5 number
their meanings `1.`, `2.` (`furbo`, `scopabile`). A few prose lines are notes
rather than meanings: `fuoco artificiale` says `Vedi [[fuochi d'artificio]].`,
and `Sofonisba` says where the name comes from. The detector does not judge
text, so it counts them.

## What was recovered

Nothing. No group is read by an existing, admitted rule, so there is no
recovered fact to write, no change declaration under `dictionary-changes/`, and
no `source_record_json` line touched. No agent wrote D1, deployed or ran a
workflow.

No declaration command could carry such a recovery either. The six commands
([declaration.ts](../src/update/declaration.ts)) write records, hidings,
normalizations, corrections and page-only entries. Only the seed writes the
recovered layer ([recoveredLayer.ts](../src/import/recoveredLayer.ts), called
from [seedSql.ts](../src/import/seedSql.ts)), and the shared dictionary changes
only through declarations. Question 9 asks about that.

## Questions for Huey

Each "yes" is a new rule for the recovered layer, and likely an amendment of
ADR 0012. Counts are headwords in `it-0c432803`.

1. **`*` bullet line (99).** Read a `*` line under the part-of-speech heading as
   a definition? `decrepito`, `agamico`, and 81 numbers like `centouno`.
2. **Plain line (64).** Read a plain line under the part-of-speech heading, with
   no list mark, as a definition? `bavaglio`, `museruola`, `furbo`. A few notes
   come along (`fuoco artificiale`, `Sofonisba`).
3. **`:` indented line (9).** Read it as a definition? `coi`, `sugli`, `sforzare`.
4. **`#` line under a stray heading (4).** Read a `#` line under `{{-sill-}}`,
   under `{{-trad-}}` before its box, or under `====Pronuncia====` as its part
   of speech's definition? `longanimità`, `trasgressivo`, `demotivare`, `live`.
5. **`#*` line with no `#` line above (2).** Read it as a definition?
   `harmonium`, `casaccio`.
6. **Definition after the headword (2).** Read the words after the headword and
   its grammar on the headword line as a definition? `clavicembalista`,
   `comignolo eolico`.
7. **Definition inside the grammar stamp (1).** Read `ottemperanza`'s line 3 as
   the stamp `f sing` plus a definition?
8. **`;` line (1).** Read it as a definition? `scafandro`.
9. **A command to write it.** If any answer above is yes, may a new command
   (for example `load:recovered-definitions`, with its own declaration) write
   recovered definitions for records that already exist?
