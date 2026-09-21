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
    senses: [formOf("femminile di studente", "studente")],
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
  ...["bellissimo", "bellissima", "bellissimi", "bellissime", "belli", "belle", "bellino"].map(
    (word) =>
      record({
        word, pos: "adj", pos_title: "Aggettivo",
        tags: ["masculine", "singular"],
        forms: [
          { form: "bello", tags: ["positive"] },
          { form: "bella", tags: ["feminine", "singular"] },
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
];
