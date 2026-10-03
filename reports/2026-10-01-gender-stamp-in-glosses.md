# Gender and number left in a gloss: eight nouns

Measurement for [issue #308](https://github.com/povlabs/lexema/issues/308), run 2026-10-01.
It changes no data and no code that reads data. It counts the noun and adjective records
whose gender or number sits only at the end of a gloss, and proposes a rule to move it.

Source file: `it-extract.jsonl.gz`, release `it-0c432803` (SHA-256
`0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`). The script is
[`tools/gloss_grammar_stamp.py`](../tools/gloss_grammar_stamp.py). Run it with
`python3 tools/gloss_grammar_stamp.py [path]`. It checks the file's hash, streams it once,
takes about twelve seconds, and prints every hit as JSON.

## Why it happens

Wikizionario writes a noun's gender and number as an italic *stamp* on the first `#` line
of the section, a line that states no meaning:

```text
# {{Pn|w}} ''f sing'' {{Linkp|case}}
```

That is line 8 of [`fixtures/upstream-pages/casa.wikitext`](../fixtures/upstream-pages/casa.wikitext).
`pianoforte`, `manuale` and `lap steel guitar` have the same line in their saved pages, and
`presina`'s sampled page has `# '''presina''' ''f''`. The extraction turns that line into a
sense, so the stamp ends up as the last letters of its gloss (`casa ( approfondimento) f sing`).
It never becomes a record `tag`. Gender is read only from record tags
([`src/import/importRelease.ts`](../src/import/importRelease.ts),
[`src/import/grammarPolicy.ts`](../src/import/grammarPolicy.ts)), so these records store
gender as `missing`, and the page and share card show none.

## Counts

| Count | Records |
| --- | ---: |
| noun records | 52,885 |
| noun records with no gender tag | 5,014 |
| adjective records | 30,488 |
| adjective records with no gender tag | 3,354 |
| records with any gloss ending in stamp-like letters (wide pass) | 15 |
| **records whose gender is only in a gloss stamp** | **8** (9 glosses) |
| adjective records among them | 0 |

The wide pass takes any gloss whose last words come from `m f n sing pl inv invar e o /`
and their dotted forms. It finds no `inv`, `pl`, `m e f` or `m/f` stamp in this release.

The eight, all nouns, none with a gender tag of their own:

| Line | Word | Gloss | Gender | Number | Gloss after the rule |
| ---: | --- | --- | --- | --- | --- |
| 1 | casa | `casa ( approfondimento) f sing` | feminine | singular | `casa ( approfondimento)` |
| 31,614 | asciugatoio | `asciugatoio m` | masculine | — | `asciugatoio` |
| 31,642 | presina | `presina f` | feminine | — | `presina` |
| 41,076 | pianoforte | `pianoforte ( approfondimento) m sing` | masculine | singular | `pianoforte ( approfondimento)` |
| 77,845 | manuale | `manuale ( approfondimento) m sing`, twice (senses 0 and 1) | masculine | singular | `manuale ( approfondimento)` |
| 133,080 | pescante | `definizione mancante; se vuoi, aggiungila tu m sing` | masculine | singular | the placeholder alone |
| 549,133 | Pettinatore | `m sing` | masculine | singular | empty |
| 605,574 | lap steel guitar | `lap steel guitar ( approfondimento) f sing` | feminine | singular | `lap steel guitar ( approfondimento)` |

This explains 8 of the 5,014 nouns with no gender tag. The rest of that gap has some other
cause; [#145](https://github.com/povlabs/lexema/issues/145) looks at it from the forms side.

## What the page shows today

The web page already hides a `<word> ( approfondimento)` gloss as page furniture when
the reading has real definitions
([`web/lib/dictionary/definitions.ts`](../web/lib/dictionary/definitions.ts)). So for
casa, pianoforte, manuale and lap steel guitar the stamp is not visible; only the gender is
lost. For the other four, the stamp is shown as text:

- asciugatoio and presina show `asciugatoio m` and `presina f` as their meaning.
- pescante shows `m sing`. The placeholder filter
  ([`src/italian/placeholder.ts`](../src/italian/placeholder.ts)) takes out the
  "definizione mancante" sentence and leaves the stamp. Checked by calling
  `withoutPlaceholder("definizione mancante; se vuoi, aggiungila tu m sing")`, which
  returns `"m sing"`.
- Pettinatore's only gloss is `m sing`.

## Proposed rule

**A noun or adjective gloss that is one whole page-control line is split into a gender,
an optional number, and the rest.** It matches only this shape, on the whole gloss:

```text
^(?:<word> \( approfondimento\) |<word> |definizione mancante; se vuoi, aggiungila tu )?(m|f)(?: (sing|pl))?$
```

`<word>` is the record's own headword, escaped. `m`/`f` become `masculine`/`feminine`;
`sing`/`pl` become `singular`/`plural`.

- **The lift.** The record gets a `stated` gender claim, and a number claim when the
  stamp has one. Each claim points at the gloss it came from (`/senses/0/glosses/0`) and
  keeps the stamp text (`f sing`) as its source text. That is the provenance
  [ADR 0009](../.decisions/0009-two-licences-and-a-source-link.md) asks for. The rule
  does not run when the record already has a gender tag. If a stamp ever disagreed with a
  tag, the rule would leave the record alone. In this release no stamp meets a tag.
- **The trim.** The stored gloss drops the stamp and the space before it. That is a
  [source text normalization](../.decisions/0019-source-text-may-be-normalized.md):
  fixed, exact, meaning kept, and `source_record_json` stays byte-for-byte. A gloss left
  empty (Pettinatore) becomes a sense with no gloss. The page already handles that.

### Records the rule gets wrong

None in this release. The wide pass found seven more glosses ending in stamp-like letters,
and the rule takes none of them, because each has prose before the letter:

| Line | Word | Gloss ends | What the letter really is |
| ---: | --- | --- | --- |
| 460,470 | chilogrammetro | `…per l'altezza di 1 m` | metre; the record has no gender tag, so a looser "trailing `m`" rule would tag it from a unit |
| 119,974 | ottobasso | `…altezza di 3,85 m` | metre |
| 24,283 | potenza | `…distanza focale f.` | a variable |
| 45,820 | fluoro | `…simbolo chimico F` | chemical symbol |
| 49,509 | effe | `the letter f, F` | the letter |
| 49,542 | emme | `the letter m, M` | the letter |
| 3,068 | qualcuno | `…soltanto la forma del sing.` | prose |

That is why the rule fixes the lead to a closed list and never accepts a bare trailing
letter.

### Where it is less clear

- ADR 0019 covers the trim; it is about rewriting text. The lift is different: it adds a
  `stated` grammar claim that comes from a gloss rather than a tag.
  [`grammarPolicy.ts`](../src/import/grammarPolicy.ts) says "never infer from prose". The
  stamp is the page's grammar mark, not prose. The extraction just flattened it into the
  gloss. So it reads as deterministic Italian grammar enrichment, which AGENTS.md allows,
  but it is the first claim whose pointer is a gloss. That needs Huey's yes.
- Eight records is small. A cheaper option is to do nothing and wait for an upstream
  extraction fix. The cost of waiting is that casa keeps showing no gender and no
  articles, and four words keep showing `m`, `f` or `m sing` as a meaning.
