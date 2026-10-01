# Related-list entries that open with a non-letter, 2026-10-01

Measurement for [#224](https://github.com/hueypov/lexema/issues/224). It counts
the `synonyms`, `antonyms` and `derived` entries whose text starts with something
other than a letter, and asks whether those entries are always the tail of a note
split off the entry before them. No rendering change comes with it.

The word page reads these three lists in
[`src/lookup/sourceRecord.ts`](../src/lookup/sourceRecord.ts) (`relatedWords`) and
draws them through [`web/lib/dictionary/relatedList.ts`](../web/lib/dictionary/relatedList.ts).
That file's `noteRuns` (#120) turns an entry into note text only when its round
brackets do not balance. Every other entry is drawn as a word that links to a search.

## Setup

- Release `it-0c432803`: `it-extract.jsonl.gz`, SHA-256
  `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`, 799,600
  lines, 560,357 of them Italian records (`lang_code` `it`).
- An entry is counted when `relatedWords` keeps it: an object whose `word` is a
  string that is not blank after trimming.
- "Starts with a non-letter" means the first character of `word`, as stored, is
  not a Unicode letter (Python `str.isalpha()`). No kept entry starts with
  whitespace, so every lead below is a visible character.
- "Caught" means the entry falls inside a run that `noteRuns` already shows as a
  note. The script ports that function line for line and runs it over each
  record's list in source order, as `relatedItems` does.
- Counts are source entries. The page shows a spelling once per list, so it draws
  fewer chips than this; chips were not counted.

## Totals

| List | Entries kept | Start with a non-letter |
| --- | ---: | ---: |
| `synonyms` | 600,662 | 3,486 |
| `antonyms` | 200,702 | 747 |
| `derived` | 52,598 | 188 |
| **All** | **853,962** | **4,421** |

Of the 4,421, the bracket rule from #120 already shows **349** as notes, almost
all `(`-led. The other **4,072** are drawn as words today.

By shape:

| Shape | Entries |
| --- | ---: |
| No letter or digit at all (`;`, `.`, `:`, `"`, `☿`) | 3,553 |
| A mark, then text (`: es. quartiere popolare`, `[[flessibile`, `'ndrina`) | 844 |
| Starts with a digit (`113`, `2:`) | 24 |

## By leading character

"Headwords" counts distinct titles.

| Lead | Entries | `synonyms` | `antonyms` | `derived` | No letter or digit | Caught | Headwords |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `;` | 2,077 | 2,001 | 68 | 8 | 1,926 | 0 | 1,178 |
| `.` | 954 | 558 | 346 | 50 | 925 | 1 | 657 |
| `(` | 395 | 335 | 45 | 15 | 2 | 321 | 245 |
| `"` | 198 | 130 | 60 | 8 | 186 | 4 | 68 |
| `:` | 193 | 101 | 51 | 41 | 162 | 1 | 85 |
| `[` | 177 | 109 | 66 | 2 | 19 | 0 | 102 |
| `'` | 89 | 46 | 38 | 5 | 75 | 0 | 42 |
| `]` | 46 | 32 | 13 | 1 | 46 | 0 | 32 |
| `*` | 36 | 21 | 10 | 5 | 33 | 0 | 23 |
| `)` | 35 | 32 | 3 | 0 | 16 | 19 | 16 |
| `/` | 35 | 8 | 5 | 22 | 34 | 0 | 22 |
| `-` | 30 | 10 | 3 | 17 | 2 | 0 | 19 |
| `}` | 28 | 18 | 10 | 0 | 28 | 0 | 13 |
| `”` | 26 | 13 | 11 | 2 | 26 | 1 | 14 |
| `“` | 25 | 12 | 11 | 2 | 25 | 0 | 13 |
| `\|` | 25 | 18 | 5 | 2 | 20 | 0 | 15 |
| `2` | 12 | 11 | 1 | 0 | 0 | 1 | 11 |
| `1` | 5 | 5 | 0 | 0 | 0 | 0 | 3 |
| `3` | 4 | 4 | 0 | 0 | 0 | 0 | 4 |
| `4` | 3 | 3 | 0 | 0 | 0 | 1 | 3 |
| `=` | 2 | 1 | 1 | 0 | 2 | 0 | 2 |
| `\` | 2 | 2 | 0 | 0 | 2 | 0 | 2 |
| `«` `»` `‘` `’` | 2 each | 0 | 0 | 2 each | 2 each | 0 | 1 (`virgoletta`) |
| `€` | 1 | 1 | 0 | 0 | 1 | 0 | 1 |
| `☉` `☽` `☾` `☿` `♀` `♁` `♂` `♃` `♄` `♅` `♆` `♇` `⛢` `⯓` `🜨` | 1 each | 1 each | 0 | 0 | 1 each | 0 | 1 each |

## Examples

For each lead, up to ten distinct texts, most frequent first, each with its count,
one place it sits as `headword /list/index`, and the entry before it in that list
(— when it is the first entry).

**`;`**: `;` ×1,922 (`rosso /synonyms/24`, after `congestionato`); `; si` ×9
(`lotta /synonyms/26`, after `combatte`); `; ti` ×6 (`tratti /synonyms/98`, after
`reputi`); `; in piena` ×5 (`gonfie /synonyms/8`, after `imbevute`);
`; (colloquiale)` ×4 (`piscia /synonyms/3`, after `orina`); `; luogo preciso` ×4
(`punto /synonyms/51`, after `base`); `; mi` ×4 (`rischio /synonyms/13`, after
`oso`); `; messa in moto` ×3 (`mossa /synonyms/8`, after `dislocato`);
`; passioni amorose` ×3 (`cotte /synonyms/30`, after `sbornie`);
`; realtà oggettiva` ×3 (`cosa /synonyms/30`, after `corpo`).

**`.`**: `.` ×925 (`parlare /derived/3`, after `perorare`);
`.  descritti dettagliatamente` ×2 (`circostanziati /synonyms/3`, after `descritti`);
`.  essere scettico` ×2 (`puntare /antonyms/19`, after `sospettare`);
`. eccessivamente rilassato` ×2 (`fiacco /synonyms/12`, after `svogliato`);
`. gravi preoccupazioni` ×2 (`incubi /synonyms/3`, after `visioni mostruose`);
`. lasciate andare` ×2 (`imprigionate /antonyms/2`, after `liberate`);
`. lasciato andare` ×2 (`imprigionato /antonyms/2`, after `liberato`);
`. nome etnico` ×2 (`etnonimo /synonyms/0`, —); `. nota stonata` ×2
(`stecca /synonyms/14`, after `confezione`); `. oltrepassare i limiti` ×2
(`trascorrere /synonyms/9`, after `occupare`).

**`(`**: `(aggettivo` ×10 (`ambiti /synonyms/0`, —); `(per` ×8
(`pecoraio /synonyms/2`, after `mandriano`); `(verbo` ×8 (`scalare /synonyms/8`,
after `proporzionale`); `(di sostanza` ×7 (`gusto /antonyms/1`, after `malgusto`);
`(di persone` ×5 (`membratura /synonyms/0`, —); `(aggettivo qualificativo` ×4
(`tale /synonyms/3`, after `suddetto`); `(di sillaba` ×4 (`baritono /synonyms/0`,
—); `(di un foglio` ×4 (`verso /antonyms/1`, after `prosa`); `(in senso figurato`
×4 (`imbastardire /synonyms/0`, —); `(lampo di luce):` ×4 (`lustro /synonyms/22`,
after `reputazione`).

**`"`**: `"` ×183 (`bambino /synonyms/38`, after `Gesù Bambino`); `")` ×3
(`inusitato /antonyms/9`, after `consueto`); `" e` ×2 (`prolifero /derived/4`,
after `prole`); `"accompagnamento" alla morte` (`eutanasia /synonyms/0`, —);
`"e il resto` (`eccetera /synonyms/4`, after `"e le altre cose"`);
`"e le altre cose"` (`eccetera /synonyms/3`, after `bella`); `"ebraismo laico"`
(`Haskalà /synonyms/1`, after `illuminismo ebraico`); `"efelide" propriamente si
riferisce a macchie cutanee dovute all'accumulo di solo` (`lentiggine /synonyms/2`,
after `(NB: sebbene i due termini siano comunemente utilizzati come sinonimi`);
`"essere` (`speranza /synonyms/27`, after `"`); `"rav"` (`rabbino /synonyms/5`,
after `rabbeinu`).

**`:`**: `:` ×161 (`cellulare /synonyms/0`, —); `: accontentare completamente` ×2
(`vinte /derived/0`, —); `: augurare buona sorte` ×2 (`auguri /derived/0`, —);
`: finire  in` ×2 (`bolla /derived/0`, —); `: è l'ebreo religioso che anela
all'osservanza continua dei precetti` ×2 (`kosher /derived/0`, —);
`:  erudizione popolare` (`dottrina /synonyms/15`, after `teoria`);
`:  stipulare un` (`rogito /derived/0`, —); `: (` (`devoluzione /synonyms/1`,
after `devolvimento`); `: Heavy Metal` (`metal /derived/2`, after `: heavy metal`);
`: a volte il` (`far west /synonyms/1`, after `West`). The case #224 was filed on,
`: es. quartiere popolare` (`casa /synonyms/62`, after `quartiere`), is one of the
31 colon-then-text entries.

**`[`**: `[[` ×11 (`attendere /synonyms/16`, after `ascoltare`); `[` ×6
(`settoriale /antonyms/5`, after `d’insieme`); `[[alienare[[` ×3
(`conciliare /antonyms/1`, after `anticonciliare`); `[concentrata]]` ×3
(`ristretta /synonyms/10`, after `contratta`); `[sconosciuta]]` ×3
(`nota /antonyms/2`, after `ignota`); `[ [imbottito]]` ×2 (`ripieno /synonyms/6`,
after `zeppo`); `[[]]` ×2 (`ilarità /antonyms/0`, —); `[[accumulatiimmagazzinat`
×2 (`immagazzinati /synonyms/2`, after `raccolti`); `[[allargati` ×2
(`stringati /antonyms/2`, after `[[slegati`); `[[bott` ×2 (`busso /synonyms/0`, —).

**`'`**: `'` ×75 (`agile /synonyms/0`, —); `'sti cazzi` ×3 (`cazzo /derived/11`,
after `scazzare`); `'  insegnante` ×2 (`maestra /synonyms/9`, after `principale`);
`' distesa di sabbia` ×2 (`deserto /synonyms/13`, after `selvaggio`);
`' luogo abitato` ×2 (`deserto /antonyms/9`, after `produttivo`); `'ndranghetista`
×2 (`'ndrangheta /derived/0`, —); `'(nella religione cristiana)`
(`mistero /synonyms/9`, after `ambiguità`); `'na` (`sghignazzata /synonyms/1`,
after `divertimento`); `'ndrina` (`'ndrangheta /derived/1`, after `'ndranghetista`).

**`]`**: `]` ×42 (`recepire /synonyms/1`, after `accogliere`); `]]` ×4
(`jet /derived/3`, after `jet blackengine`).

**`*`**: `*` ×33 (`commozione /synonyms/7`, after `turbamento`); `*[[aiuto` ×2
(`ingombro /antonyms/6`, after `vuoto`); `* far tornare d’attualità`
(`rivitalizzare /synonyms/6`, after `tonificare`).

**`)`**: `) (` ×16 (`falcata /synonyms/0`, —); `) classe colturale` ×3
(`compresa /synonyms/13`, after `graziata`); `) terracotta non smaltata` ×3
(`biscotto /synonyms/8`, after `pan biscotto`); `)  togli l’assedio` ×2
(`assedi /antonyms/0`, —); `) diritto acquisito` ×2 (`titolo /synonyms/35`, after
`laurea`); `) fatti con sforzo` ×2 (`forzati /synonyms/10`, after `coatti`);
`) (1)` (`platano /synonyms/0`, —); `) (2)` (`platano /synonyms/2`, after
`platano comune`); `) (3)` (`platano /synonyms/4`, after `L.`); `) fasci vascolari`
(`nervatura /synonyms/4`, after `reticolato`).

**`/`**: `/` ×34 (`dottore /derived/3`, after `addottorare`); `/a`
(`annullamento /antonyms/5`, after `stesso`).

**`-`**: `-` ×2 (`endo- /derived/89`, after `endotermo`); `- trapassare || bucare`
×2 (`sfondo /antonyms/3`, after `ribalta`); `-asmo` ×2 (`-ismo /synonyms/1`, after
`-esimo`); `-fero` ×2 (`prolifero /derived/5`, after `" e`); `-istica` ×2
(`-ismo /synonyms/2`, after `-asmo`); `-tecnico` ×2 (`tecnico /derived/3`, after
`odontotecnico`); `- arms limitation` (`limitazione /derived/3`, after
`limitazione degli armamenti`); `- birth control` (`limitazione /derived/1`, after
`limitazione delle nascite`); `- film clip` (`inserto /derived/1`, after
`inserto filmato`); `- improprio` (`efelide /synonyms/1`, after `lentiggine`).

**`}`**: `}` ×25 (`lavoro /synonyms/20`, after `successo`); `}}` ×3
(`meglio /antonyms/3`, after `meno`).

**`”`**: `”` ×25 (`fancazzista /synonyms/6`, after `sfigato`); `”)`
(`frotta /synonyms/14`, after `frotte`).

**`“`**: `“` ×25 (`fancazzista /synonyms/4`, after `straccione`).

**`|`**: `|` ×17 (`piccioni /synonyms/1`, after `colombi`); `||` ×3
(`vezzoso /antonyms/6`, after `trasandato`); `| (molto) critico` ×2
(`esplosivo /synonyms/14`, after `intenso`); `|| impiastricciare` ×2
(`impasto /synonyms/16`, after `mescolo`); `|| aggirare` (`doppiò /synonyms/2`,
after `raddoppiò`).

**Digits**: `2:` ×7 (`Mercurio /synonyms/0`, —); `2.` ×4
(`finanziere /synonyms/0`, —); `2)` (`sul serio /synonyms/5`, after `(1`); `113` ×3
(`volante /synonyms/20`, after `squadra mobile`); `1,6-difosfofruttosio aldolasi`
(`aldolasi /synonyms/6`, after `fruttosio 1,6-bisfosfato aldolasi`); `15 agosto`
(`ferragosto /synonyms/0`, —); `3.` (`cinema /synonyms/0`, —); `33 giri`
(`disco /synonyms/14`, after `LP`); `33-45 giri` (`dischi /synonyms/8`, after
`long-playing`); `3:` (`Giove /synonyms/1`, after `Zeus`); `4)`
(`disegnatore /synonyms/6`, after `(3`); `4.` (`pecora /synonyms/1`, after `ovino`);
`45 giri` (`disco /synonyms/15`, after `33 giri`).

**The rest**: `=` (`anonimato /synonyms/7`, after `:`); `===` (`chiare /antonyms/18`,
after `modi di dire`); `\` ×2 (`accidente /synonyms/12`, after `ostacolo`); `«` `»`
`‘` `’` ×2 each (`virgoletta /derived/4`, `/5`, `/11`, `/12`); `€`
(`EUR /synonyms/0`, —); `☉` (`Sole /synonyms/0`, —); `☾` `☽` (`Luna /synonyms/0`,
`/1`); `☿` (`Mercurio /synonyms/1`, after `2:`); `♀` (`Venere /synonyms/1`, after
`2:`); `♂` (`Marte /synonyms/1`, after `2:`); `♃` (`Giove /synonyms/2`, after
`3:`); `♄` (`Saturno /synonyms/1`, after `2:`); `⛢` `♅` (`Urano /synonyms/1`,
`/2`); `♆` (`Nettuno /synonyms/1`, after `2:`); `⯓` `♇` (`Plutone /synonyms/1`,
`/2`); `🜨` `♁` (`Terra /synonyms/2`, `/3`).

## Are they always note tails split off the entry before?

**No.** Some are, but most are not, and some are real words.

**Note tails after a word.** The text reads as a gloss on the entry right before it:

- `casa /synonyms/62` `: es. quartiere popolare`, after `quartiere`.
- `poliandria /antonyms/1` `: avere un solo partner`, after `monogamia`; and
  `/3` `: quando un maschio sta con più femmine`, after `poliginia`.
- `decubito /derived/1` `: pendente verso il basso`, after `decombente`.
- `facente /derived/1` `: chi rimpiazza provvisoriamente il`, after
  `facente funzione`.
- `imprigionato /antonyms/2` `. lasciato andare`, after `liberato`.
- `efelide /synonyms/1` `- improprio`, after `lentiggine`.
- `biscotto /synonyms/8` `) terracotta non smaltata`, after `pan biscotto`. The
  bracket rule already shows this one as a note.

**Glosses with no head in the list.** The text is the first entry, so nothing
before it is a word it could belong to. 12 of the 31 colon-then-text entries are
like this, for example `auguri /derived/0` `: augurare buona sorte`,
`vinte /derived/0` `: accontentare completamente` and `kosher /derived/0`
`: è l'ebreo religioso che anela all'osservanza continua dei precetti`.

**A lone mark.** 3,553 entries hold no letter or digit. They are not a tail of
anything; they read as the list's own punctuation or leftover markup. The
biggest groups: `;` ×1,922, `.` ×925, `"` ×183, `:` ×161, `'` ×75, `]` ×42,
`/` ×34, `*` ×33. Of the 161 lone `:`, 85 carry `raw_tags` or `tags`, so the
words before the colon went into a tag and only the colon was left as the word:
`cellulare /synonyms/0` is `:` with `raw_tags` `telefono`, then `telefonino`.

**Markup around a real word.** `[[flessibile` (`snello /synonyms/8`),
`[concentrata]]` (`ristretta /synonyms/10`), `*[[aiuto` (`ingombro /antonyms/6`),
`"rav"` (`rabbino /synonyms/5`).

**Numbering.** `2:`, `3:`, `2.`, `3.`, `4.`, `2)`, `4)` read as sense numbers:
`Mercurio /synonyms/0` is `2:`, then `☿`.

**Real words and signs that start with a non-letter.** These are content, not
note pieces:

- elided forms: `'ndranghetista`, `'ndrina` (`'ndrangheta /derived/0`, `/1`),
  `'sti cazzi` (`cazzo /derived/11`), `'na` (`sghignazzata /synonyms/1`);
- suffixes: `-asmo`, `-istica` (`-ismo /synonyms/1`, `/2`), `-tecnico`
  (`tecnico /derived/3`), `-fero` (`prolifero /derived/5`);
- numbers: `113` (`volante /synonyms/20`), `15 agosto` (`ferragosto /synonyms/0`),
  `33 giri`, `45 giri` (`disco /synonyms/14`, `/15`),
  `1,6-difosfofruttosio aldolasi` (`aldolasi /synonyms/6`);
- signs: `€` (`EUR /synonyms/0`), `☉` (`Sole`), `☿` (`Mercurio`), `♁` (`Terra`)
  and the other planet signs, and the quote marks `«` `»` `‘` `’` `“` `”` listed
  under `virgoletta /derived`.

So a rule keyed on "starts with a non-letter" would also turn real words into
notes, and a rule keyed on a leading `:` would catch 193 entries, of which 161
are a lone colon rather than a note tail.

## Script

Save it as `measure.py` and run it from the repository root, with the archive
there: `python3 measure.py it-extract.jsonl.gz`. Standard library only, about 6
seconds. It printed every number above.

```python
"""Count related-list entries whose text opens with a non-letter (issue #224).

Usage: python3 measure.py it-extract.jsonl.gz
Standard library only; streams the archive line by line.
"""
import collections, gzip, json, sys, unicodedata

LISTS = ("synonyms", "antonyms", "derived")

def open_brackets(text):  # relatedList.ts openBrackets
    return text.count("(") - text.count(")")

def note_runs(pieces):  # relatedList.ts noteRuns, ported line for line
    runs, i = [], 0
    while i < len(pieces):
        opened = open_brackets(pieces[i])
        if opened == 0:
            i += 1
            continue
        end = i + 1
        if opened > 0:
            open_, j = opened, i + 1
            while j < len(pieces) and open_ > 0:
                open_ += open_brackets(pieces[j]); j += 1
            if open_ <= 0:
                end = j
        runs.append((i, end))
        i = end
    return runs

def shape(word):
    if any(c.isalpha() or c.isdigit() for c in word):
        return "digit-led" if word[0].isdigit() else "mark then text"
    return "no letter or digit"

records = lines = 0
entries = collections.Counter()
hits = []  # (lead, list, shape, caught, title, index, word, previous word)
for line in gzip.open(sys.argv[1], "rt", encoding="utf-8"):
    lines += 1
    record = json.loads(line)
    if record.get("lang_code") != "it":
        continue
    records += 1
    for key in LISTS:
        raw = record.get(key) if isinstance(record.get(key), list) else []
        # The entries relatedWords() keeps: an object whose word is a non-blank string.
        kept = [(i, e["word"], bool(e.get("tags") or e.get("raw_tags"))) for i, e in enumerate(raw)
                if isinstance(e, dict) and isinstance(e.get("word"), str) and e["word"].strip()]
        entries[key] += len(kept)
        in_note = set()
        for start, end in note_runs([w for _, w, _ in kept]):
            in_note.update(range(start, end))
        for n, (i, word, tagged) in enumerate(kept):
            if word[0].isalpha():
                continue
            previous = kept[n - 1][1] if n > 0 else None
            hits.append((word[0], key, shape(word), n in in_note, record["word"], i, word, previous, tagged))

print(f"lines {lines}, Italian records {records}, entries {dict(entries)}, non-letter-led {len(hits)}")
print("per list", dict(collections.Counter(h[1] for h in hits)))
print("shape", dict(collections.Counter(h[2] for h in hits)))
print("caught by the #120 bracket rule", sum(h[3] for h in hits))
colon = [h for h in hits if h[0] == ":"]
lone = [h for h in colon if h[6] == ":"]
texted = [h for h in colon if h[2] == "mark then text"]
print(f"':' lone {len(lone)} (tagged {sum(h[8] for h in lone)}), "
      f"with text {len(texted)} (first in list {sum(h[7] is None for h in texted)})")
by_lead = collections.defaultdict(list)
for h in hits:
    by_lead[h[0]].append(h)
for lead, group in sorted(by_lead.items(), key=lambda kv: (-len(kv[1]), kv[0])):
    per_list = collections.Counter(h[1] for h in group)
    caught = sum(h[3] for h in group)
    marks = sum(h[2] == "no letter or digit" for h in group)
    print(f"\n{lead!r} U+{ord(lead):04X} {unicodedata.name(lead, '?')}: {len(group)} "
          f"{dict(per_list)} no-letter-or-digit {marks} caught {caught} records {len({h[4] for h in group})}")
    texts = collections.Counter(h[6] for h in group)
    first = {}
    for h in group:
        first.setdefault(h[6], h)
    for text, n in sorted(texts.items(), key=lambda kv: (-kv[1], kv[0]))[:10]:
        h = first[text]
        print(f"  {n:>5} {text!r} e.g. {h[4]} /{h[1]}/{h[5]} after {h[7]!r}")
```
