# Italian articles: the rules, their references, and where we stop, 2026-10-01

Investigation for [#5](https://github.com/povlabs/lexema/issues/5). It checks
the article rule [`src/italian/articles.ts`](../src/italian/articles.ts) and the
lookup layer around it, [`src/lookup/articles.ts`](../src/lookup/articles.ts),
against two named grammar references and the source. The rule is now
`it-articles/v2`. The tests are [`test/articles.test.ts`](../test/articles.test.ts).

## References

**R1. Treccani, *La grammatica italiana* (2012), «Articoli» and «Partitivo, articolo».**
[articoli](https://www.treccani.it/enciclopedia/articoli_(La-grammatica-italiana)/),
[partitivo](https://www.treccani.it/enciclopedia/articolo-partitivo_(La-grammatica-italiana)/),
read 2026-10-01.

- Settles: the forms. Definite `il, lo, l'` / `i, gli` (masculine), `la, l'` /
  `le` (feminine). Indefinite `un, uno` / `una, un'`, and the indefinite "ha
  soltanto il singolare". The singular partitive is "poco frequente" and goes
  with "una materia non numerabile" (*del denaro*); the plural partitive
  "funziona come plurale dell'articolo indeterminativo" (*dei buoni risultati*).
- Does not settle: which initial takes which form. The page gives the forms as
  two tables and no conditions.

**R2. Treccani, *Enciclopedia dell'Italiano* (2010), «Articolo».**
[articolo](https://www.treccani.it/enciclopedia/articolo_(Enciclopedia-dell'Italiano)/),
read 2026-10-01.

- Settles the masculine singular: `lo` before ‹z›, ‹x›, semivowel ‹i› (*lo
  iato*), ‹s› + consonant, including exotic spellings (*lo Swatch*, *lo
  shampoo*), ‹gn› and ‹ps›. For ‹pn› "la norma prevederebbe lo" (*lo
  pneumatico*), though *il pneumatico* "non riceve più censura". `il` before
  "le restanti consonanti o gruppi consonantici". `l'` before a vowel and
  semivowel ‹u› (*l'uomo*); before ‹w› "a rigore" too, "ma scritture come il web
  o il whisky sono oramai prevalenti".
- Settles the plural: `gli` before a vowel and the `lo` group, `i` elsewhere,
  "anche, isolato, gli dei". The feminine "ha sempre le". Plurals never elide.
- Settles the indefinite: `uno` before the `lo` group, `un` elsewhere; `una`
  before a consonant or semivowel (*una iattura*), `un'` before a vowel. No true
  indefinite plural: the partitive stands in. The indefinite is "incompatibile
  con i nomi di massa", which take the partitive instead.
- Does not settle: ‹h›, ‹j›, ‹y›, foreign clusters (‹pt›, ‹th›, ‹ts›), or how to
  tell semivowel ‹i› (*iato*) from vowel ‹i› (*ione*) in spelling. It gives no
  word list for loanwords.

## The rule, `it-articles/v2`

Inputs: one spelling, one gender (`masculine` | `feminine`), one number
(`singular` | `plural`). Output: a non-empty list of articles, each labelled
with its kind, agreement and rule id — or one withholding cause.

| Initial (lowercased) | Group | Masc. sg. | Masc. pl. | Fem. sg. | Reference |
|---|---|---|---|---|---|
| vowel, incl. `u` + vowel | vowel | `l'`, `un` | `gli`, `degli` | `l'`, `un'` | R2 |
| `s` + consonant, `z`, `x`, `gn`, `ps`, `pn` | lo | `lo`, `uno` | `gli`, `degli` | `la`, `una` | R2 (`pn` by the norm) |
| consonant + vowel, `[bcdfgptv][lr]`, `ch`/`gh` + `e`/`i`, `qu` | il | `il`, `un` | `i`, `dei` | `la`, `una` | R2 |
| anything else | — | withheld | withheld | withheld | — |

- The feminine plural is `le`, `delle` before every initial (R2), so an
  unsettled initial does not stop it: `le iene`.
- A singular gets definite and indefinite. A plural gets definite and partitive,
  labelled `partitive`, never `indefinite` (R1, R2).
- **The singular partitive is no longer given.** It goes with mass nouns (R1,
  R2), and the source never says whether a noun is one. v1 gave `dello studente`
  as a partitive.
- **One lexeme exception:** `dei`/`dèi`, masculine plural, takes `gli`, `degli`
  (R2). In any other agreement the spelling is withheld as `irregular-surface`.
  The source tags its own `dei` record masculine singular (line 38151); that
  record gets no article.

### Where the rule withholds

| Cause | When | Examples from the source |
|---|---|---|
| `composite-surface` | space, slash, hyphen or apostrophe | `spina dorsale`, `e-mail`, `'ndrangheta`, `mo'` |
| `not-a-spelled-word` | not all letters, a capital after the first letter, or no vowel | `3`, `kwh`, `megaFLOPS`, `API` |
| `initial-sound-not-settled` | `h`, `j`, `w`, `y`; `i` + vowel; any cluster outside the table; a letter outside the Italian alphabet | `hobby`, `jazz`, `won`, `yogurt`, `iato`, `ione`, `champagne`, `pterodattilo`, `föhn` |
| `irregular-surface` | an exception spelling in an agreement it does not cover | `dei` tagged singular |
| `missing-or-ambiguous-gender-number` | no gender or no number given | — |

`i` + vowel is withheld because the spelling cannot say which sound it is. R2
gives *lo iato* for a semivowel ‹i›, but the same spelling opens words read with
a full vowel ‹i› (`io`, `ione`), and R2 gives no way to tell them apart. `ch` + `a`/`o`/`u`
is a spelling Italian never writes, so it marks a loanword (*champagne*,
*chance*). Composites are withheld because the article depends on how the
compound is read, and neither reference covers compounds.

**Known gap:** `ch` + `e`/`i` is read as Italian `/k/`, so `il` group. A loan
like *chef* is not said with `/k/`, yet gets `il chef`, and neither reference
rules on it. Spelling cannot tell it from *chela*.

## The lookup layer

`readingPartOfSpeech` runs once per reading, with that record's own headword and
grammar ([`src/lookup/lookup.ts`](../src/lookup/lookup.ts), `buildReading`), so
**articles attach per reading, not per query**. `sale` is two records in the
source (line 21651, masculine singular; line 21652, feminine plural, a form of
`sala`) and gets `il sale` on one and `le sale` on the other. A test holds this.

It reads only the gender and number the source stated about the record:

- **`casa` gets no fabricated gender.** Its record has no tags at all (line 1;
  "f sing" appears only inside a gloss), so it is withheld as
  `no-gender-or-number-stated`.
- **Invariable `città` is withheld**, as `number-is-not-singular-or-plural` with
  `statedNumber: "invariable"`. Choosing *la città* or *le città* would claim a
  number the source did not state.
- **Fixed here:** v1 took the first stated gender and the first stated number.
  A record stating two genders (`psichiatra`, `arancione`) got only the first
  one's articles: `arancione` came out `l'arancione, un'arancione`, feminine,
  for the colour noun. It is now withheld as `more-than-one-gender-stated`, and
  the same for two numbers (`khmer`).
- A surface the rule refuses comes back as `surface-not-handled` with the rule's
  own `cause`, so the reason can be said in a sentence.

The issue says the page prints the withholding reason. It does not: the word
page shows data, never a note on what it could not place (Huey on
[#142](https://github.com/povlabs/lexema/issues/142), cited in `genderGrid.ts`), and its grid calls
the rule per cell ([`web/lib/dictionary/genderGrid.ts`](../web/lib/dictionary/genderGrid.ts))
and draws no article line where it refuses. The reason travels in the API's
`articles` field ([docs/LOOKUP.md](../docs/LOOKUP.md)), and the tests cover it there.

## What changed, measured

Every Italian noun record in release `it-0c432803` (52,885 records), headword
only, record tags as its grammar, v1 against v2. v1's singular partitive is left
out of the comparison, since v2 drops it on every singular.

| Outcome | Records |
|---|---:|
| Same articles | 33,667 |
| Withheld in both | 17,723 |
| v1 derived, v2 withholds: two genders stated | 1,332 |
| v1 derived, v2 withholds: initial not settled | 105 |
| v1 derived, v2 withholds: composite | 41 |
| v1 derived, v2 withholds: two numbers stated | 7 |
| v1 derived, v2 withholds: not a spelled word | 3 |
| v1 derived, v2 withholds: irregular (`dei`) | 1 |
| Different articles | 6 |

The six that differ are the `pn` words (`lo pneumatico`, `gli pneumatici`,
`lo pneumococco`, ...) and `gli dèi`. Nothing that v1 withheld is now derived.

Of the 17,723 withheld in both: 8,491 state a gender and no number, 4,766 state
neither, 3,469 state `invariable`, 524 state two genders, 242 state a number
and no gender, 188 are multi-word, 29 state two numbers, 8 are not words, and
6 state a gender other than masculine or feminine.

## Verdict

- **`src/italian/articles.ts` did not survive as it stood.** v1 had no `pn`; put
  `y` in the `lo` group with no reference; gave `il` before `h`, `j` and `w`
  (`il hotel`); elided before semivowel `i` (`l'iena` where R2 has *una
  iattura*); let hyphens, apostrophes and acronyms through (`l'API`, `il mo'`);
  gave every count noun a singular partitive; and gave `i dèi`. v2 fixes each
  of these, and every edge class has a test.
- **`src/lookup/articles.ts` survives, with one fix.** It holds the per-reading
  line and never invents gender. It did silently pick the first of two stated
  genders or numbers. That is now withheld.

## Remaining work

- The source carries IPA (`sounds[].ipa`) on many records. It could settle what
  spelling cannot: semivowel `i`, `h`, `w`, `y`, and `ch` in loans like *chef*.
  That is a source fact, so it fits the read-only rule.
- A record stating both genders (1,856 headwords) could get both genders'
  articles instead of none. A record stating `invariable` (3,469) could get
  both numbers'. Each is a product choice, not a grammar gap.
