// The archive the rendered-page test searches.
//
// It is built to answer the twelve queries in
// reports/2026-09-18-dataset-spot-check.md with the same shapes the real file
// answers them with: the same number of direct records per query, the same
// number of records embedding the query in their own tables, and the same
// silences — `casa` with no gender or number, a verb table with no mood, an
// edge naming a word that three records spell.
//
// It is not a copy of those lines. Glosses are shortened, and a conjugation
// table that runs to 95 entries upstream runs to 17 here; where an index is
// load-bearing the report names it and the fixture keeps it, as `/forms/16` on
// `andare` does. Every count the test asserts is a count the report states.

interface Form {
  form: string;
  tags?: string[];
  raw_tags?: string[];
  source?: string;
}

interface Sense {
  glosses?: string[];
  tags?: string[];
  raw_tags?: string[];
  form_of?: { word: string }[];
}

interface Record_ {
  word: string;
  pos: string;
  pos_title: string;
  tags?: string[];
  raw_tags?: string[];
  forms?: Form[];
  senses?: Sense[];
}

const record = (value: Record_): string => JSON.stringify({ ...value, lang_code: "it" });

/** A `form_of` sense, which is how the source declares "this is a form of that". */
const formOf = (gloss: string, word: string): Sense => ({
  glosses: [gloss],
  tags: ["form-of"],
  form_of: [{ word }],
});

/** The six persons of one tense, as the source tags them. */
const tenseForms = (forms: string[], tense: string): Form[] =>
  forms.map((form, i) => ({
    form,
    tags: [
      ["first-person", "second-person", "third-person"][i % 3],
      i < 3 ? "singular" : "plural",
      tense,
    ],
  }));

export const FIXTURE_LINES: string[] = [
  // casa — 1 direct, 0 embedded. Two glosses that define nothing, no tags at
  // all, no forms: the entry the whole "visibly silent" argument rests on.
  record({
    word: "casa", pos: "noun", pos_title: "Sostantivo",
    senses: [
      { glosses: ["casa ( approfondimento) f sing"], raw_tags: ["pl.: case"] },
      { glosses: ["casa ( citazioni)"] },
    ],
  }),
  // case — 1 direct, 0 embedded. Tagged, and pointing at an entry that has no
  // forms of its own.
  record({
    word: "case", pos: "noun", pos_title: "Sostantivo, forma flessa",
    tags: ["feminine", "form-of", "plural"],
    senses: [formOf("plurale di casa", "casa")],
  }),

  // studente — 2 direct (a noun and a verb form), 3 embedded.
  record({
    word: "studente", pos: "noun", pos_title: "Sostantivo",
    tags: ["masculine", "singular"],
    forms: [
      { form: "studenti", tags: ["masculine", "plural"] },
      { form: "studenti", tags: ["plural"] },
      // The gendered pair, written as one string by the source itself:
      // reports/dataset-findings.md "Noun representation" reads it off the real
      // `studente` record. Its surface key is `studente/studentessa`, so it is a
      // hit for none of the twelve sampled queries and moves none of the counts.
      { form: "studente/studentessa", tags: ["feminine", "singular"] },
    ],
    senses: [{ glosses: ["chi è regolarmente iscritto in un corso di studi"], raw_tags: ["scuola"] }],
  }),
  // The disputed one: reports/2026-09-18-source-research.md finds `studiante`
  // in Wiktionary's own studiare table and in Treccani.
  record({
    word: "studente", pos: "verb", pos_title: "Voce verbale",
    tags: ["form-of"],
    senses: [formOf("participio presente singolare maschile di studiare", "studiare")],
  }),
  record({
    word: "studiare", pos: "verb", pos_title: "Verbo",
    tags: ["transitive"],
    senses: [{ glosses: ["applicarsi con la mente per apprendere"] }],
  }),
  // studenti — 1 direct, 4 embedded (twice under studente, once each under
  // studentessa and studentesse).
  record({
    word: "studenti", pos: "noun", pos_title: "Sostantivo, forma flessa",
    tags: ["form-of", "masculine", "plural"],
    forms: [{ form: "studente", tags: ["masculine", "singular"] }],
    senses: [formOf("plurale di studente", "studente")],
  }),
  record({
    word: "studentessa", pos: "noun", pos_title: "Sostantivo",
    tags: ["feminine", "singular"],
    forms: [
      { form: "studenti", tags: ["masculine", "plural"] },
      { form: "studente", tags: ["masculine", "singular"] },
    ],
    // The one sense in this archive that carries two labels, as the real
    // `studentessa` record does: a `raw_tags` of `scuola` beside the `form-of`
    // tag. The real page renders them `scuola form-of`, and the space between
    // them is a rendered fact the page test asserts.
    senses: [{ ...formOf("femminile di studente", "studente"), raw_tags: ["scuola"] }],
  }),
  record({
    word: "studentesse", pos: "noun", pos_title: "Sostantivo, forma flessa",
    tags: ["feminine", "plural"],
    forms: [
      { form: "studenti", tags: ["masculine", "plural"] },
      { form: "studente", tags: ["masculine", "singular"] },
    ],
    senses: [formOf("plurale di studentessa", "studente")],
  }),

  // sale — 3 direct (salt, plural of sala, form of salire), 2 embedded.
  record({
    word: "sale", pos: "noun", pos_title: "Sostantivo",
    tags: ["masculine", "singular"],
    senses: [{ glosses: ["sostanza denominata anche cloruro di sodio"] }],
  }),
  record({
    word: "sale", pos: "noun", pos_title: "Sostantivo, forma flessa",
    tags: ["feminine", "form-of", "plural"],
    senses: [formOf("plurale di sala", "sala")],
  }),
  record({
    word: "sale", pos: "verb", pos_title: "Voce verbale",
    tags: ["form-of"],
    senses: [formOf("terza persona singolare dell'indicativo presente di salire", "salire")],
  }),
  record({
    word: "sala", pos: "noun", pos_title: "Sostantivo",
    tags: ["feminine", "singular"],
    forms: [{ form: "sale", tags: ["feminine", "plural"] }],
    senses: [{ glosses: ["definizione mancante"] }],
  }),
  record({
    word: "salire", pos: "verb", pos_title: "Verbo",
    tags: ["intransitive"],
    forms: [
      // Not an inflected form: the entry names the auxiliary verb.
      { form: "avere o essere", tags: ["auxiliary"] },
      { form: "sale", tags: ["third-person", "singular", "present"] },
    ],
    senses: [{ glosses: ["andare verso l'alto"] }],
  }),

  // andare — 2 direct, 0 embedded. The verb's table carries an auxiliary at
  // /forms/0 and `andavano` at /forms/16, both as the report locates them.
  record({
    word: "andare", pos: "noun", pos_title: "Sostantivo",
    tags: ["masculine", "singular"],
    senses: [{ glosses: ["l'atto dell'andare"] }],
  }),
  record({
    word: "andare", pos: "verb", pos_title: "Verbo",
    tags: ["intransitive"],
    forms: [
      { form: "essere", tags: ["auxiliary"], raw_tags: ["verbo di prima coniugazione (irregolare)"] },
      ...tenseForms(["vado", "vai", "va", "andiamo", "andate", "vanno"], "present"),
      ...tenseForms(["andrò", "andrai", "andrà", "andremo", "andrete", "andranno"], "future"),
      { form: "andavo", tags: ["first-person", "singular", "imperfect"] },
      { form: "andavi", tags: ["second-person", "singular", "imperfect"] },
      { form: "andava", tags: ["third-person", "singular", "imperfect"] },
      // /forms/16, and tagged exactly as the report found it: no mood.
      { form: "andavano", tags: ["plural", "third-person", "imperfect"] },
    ],
    senses: [{ glosses: ["muoversi da un luogo verso un altro luogo"] }],
  }),
  record({
    word: "andavano", pos: "verb", pos_title: "Voce verbale",
    tags: ["form-of"],
    senses: [
      formOf("terza persona plurale dell'imperfetto indicativo di andare", "andare"),
    ],
  }),

  // parlare — 2 direct, 0 embedded. `parlerei` sits in the table tagged only
  // `present` with a raw `io`, which is the mood gap the research names. The
  // real table puts it at /forms/53; the tags are what the report is about.
  record({
    word: "parlare", pos: "noun", pos_title: "Sostantivo",
    tags: ["masculine", "singular"],
    senses: [{ glosses: ["il parlare"] }],
  }),
  record({
    word: "parlare", pos: "verb", pos_title: "Verbo",
    tags: ["transitive"],
    forms: [
      { form: "avere", tags: ["auxiliary"] },
      ...tenseForms(["parlo", "parli", "parla", "parliamo", "parlate", "parlano"], "present"),
      ...tenseForms(
        ["parlavo", "parlavi", "parlava", "parlavamo", "parlavate", "parlavano"],
        "imperfect",
      ),
      {
        form: "parlerei",
        tags: ["present"],
        raw_tags: ["io"],
        source: "Appendice:Coniugazioni/Italiano/parlare",
      },
    ],
    senses: [{ glosses: ["pronunciare parole esprimendo i propri pensieri"] }],
  }),
  record({
    word: "parlerei", pos: "verb", pos_title: "Voce verbale",
    tags: ["form-of"],
    senses: [formOf("prima persona singolare del condizionale presente di parlare", "parlare")],
  }),

  // bello — 3 direct, 7 embedded. bella — 2 direct, 7 embedded. Every edge
  // below names the word `bello`, which three records spell, so neither
  // direction of the relation resolves to one entry.
  record({
    word: "bello", pos: "adj", pos_title: "Aggettivo",
    tags: ["masculine", "singular"],
    // The three rows reports/dataset-findings.md "Adjective representation"
    // reads off the real record. With the record's own masculine singular they
    // are the four cells of a paradigm, which is what makes `bello` the clean
    // case of #52.
    forms: [
      { form: "belli", tags: ["masculine", "plural"] },
      { form: "bella", tags: ["feminine", "singular"] },
      { form: "belle", tags: ["feminine", "plural"] },
    ],
    senses: [{ glosses: ["che desta ammirazione"] }],
  }),
  record({
    word: "bello", pos: "noun", pos_title: "Sostantivo",
    tags: ["invariable", "masculine"],
    senses: [{ glosses: ["ciò che è bello"] }],
  }),
  record({
    word: "bello", pos: "noun", pos_title: "Sostantivo",
    tags: ["masculine", "singular"],
    senses: [{ glosses: ["il bello della situazione"] }],
  }),
  record({
    word: "bella", pos: "adj", pos_title: "Aggettivo, forma flessa",
    tags: ["feminine", "form-of", "singular"],
    senses: [formOf("femminile di bello", "bello")],
  }),
  record({
    word: "bella", pos: "noun", pos_title: "Sostantivo, forma flessa",
    tags: ["feminine", "form-of", "singular"],
    senses: [formOf("femminile di bello", "bello")],
  }),
  // `bellino` is a diminutive, so its own feminine is `bellina`, not `bella` —
  // which is also what holds the two `bella` counts where they were, now that
  // the `bello` record above lists `bella` itself.
  ...[
    { word: "bellissimo", feminine: "bella" },
    { word: "bellissima", feminine: "bella" },
    { word: "bellissimi", feminine: "bella" },
    { word: "bellissime", feminine: "bella" },
    { word: "belli", feminine: "bella" },
    { word: "belle", feminine: "bella" },
    { word: "bellino", feminine: "bellina" },
  ].map(({ word, feminine }) =>
    record({
      word, pos: "adj", pos_title: "Aggettivo",
      tags: ["masculine", "singular"],
      forms: [
        { form: "bello", tags: ["positive"] },
        { form: feminine, tags: ["feminine", "singular"] },
      ],
      senses: [formOf(`derivato di bello`, "bello")],
    }),
  ),

  // città — 1 direct, 0 embedded. Feminine and invariable, so number is stated
  // and still gives no article.
  record({
    word: "città", pos: "noun", pos_title: "Sostantivo",
    tags: ["feminine", "invariable"],
    senses: [{ glosses: ["centro abitato di grandi dimensioni"] }],
  }),
  // Two adjectives past the twelve queries, kept last so every line above them
  // keeps the number it had. #52 needs the two shapes a clean paradigm does not
  // have, and neither word is a hit for any sampled query.

  // fine — the incomplete adjective. Tagged both genders and singular, and its
  // one form carries a bare `plural`: nothing says whether `fini` is the
  // masculine plural or the feminine one, so two cells cannot be filled without
  // guessing. reports/dataset-findings.md, "Incomplete and compound adjective
  // data".
  record({
    word: "fine", pos: "adj", pos_title: "Aggettivo",
    tags: ["masculine", "feminine", "singular"],
    forms: [{ form: "fini", tags: ["plural"] }],
    senses: [{ glosses: ["sottile, delicato"] }],
  }),

  // grande — the compound one, tagged as the release tags the real record. Two
  // traps live in these four rows. The superlative carries *two* degree tags,
  // `absolute` and `superlative`, so anything reading one degree per form loses
  // the row. And it is tagged masculine singular as well, so anything that
  // ignores its degree files it in the plain masculine singular cell beside
  // `grande` itself and withholds the table over an ambiguity the source never
  // had. `grandissimo\n massimo` is one `forms[]` entry written over two lines,
  // exactly as reports/dataset-findings.md found it.
  record({
    word: "grande", pos: "adj", pos_title: "Aggettivo",
    tags: ["masculine", "feminine", "singular"],
    forms: [
      { form: "grandi", tags: ["positive", "masculine", "feminine", "plural"] },
      { form: "maggiore", tags: ["comparative"] },
      // The release states this one's degree only in the prose of a raw tag,
      // so no cell and no degree row can take it: it is the card's unplaced
      // form, and the box named for the rest is where it has to land (#66).
      { form: "maggiori", raw_tags: ["comparativo di maggioranza"] },
      {
        form: "grandissimo\n massimo",
        tags: ["absolute", "superlative", "masculine", "singular"],
      },
    ],
    senses: [{ glosses: ["di dimensioni notevoli"] }],
  }),

  // casetta — one record pointing at `casa` twice. The release record carries
  // two senses that each declare `form_of: casa` (`/senses/0/form_of/0/word`
  // and `/senses/1/form_of/0/word`), which is why "Forms pointing here" used to
  // list it twice (#60). Its own surface is a hit for none of the twelve
  // sampled queries, so it moves none of their counts.
  record({
    word: "casetta", pos: "noun", pos_title: "Sostantivo",
    tags: ["feminine", "singular"],
    senses: [
      formOf("diminutivo di casa", "casa"),
      formOf("piccola casa di campagna", "casa"),
    ],
  }),
];
