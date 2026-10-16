// The words a typed form is a shape of, by rule `it-word-shape/v1` (#809).
//
// Italian writes some forms of a word by changing its spelling in a regular
// way, and the source lists none of them. The rule reads one query key and
// names the spellings of the words it may be a form of:
//
//   clitic         raccontarvi   raccontare     a verb with pronouns joined after it
//                  dammi         da'            (and dimmi, fammi, stammi, vattene)
//                  vergognarti   vergognarsi    an infinitive's pronominal verb
//                  scusami       scusa          an imperative, `scusatemi`, `facciamolo`
//                  dicendomi     dicendo        a gerund
//   elided         quell'        quello         a final vowel dropped before a vowel
//   truncated      aver          avere          a final -e or -o dropped after l, r, n (troncamento)
//                  han           hanno          and after the m of a first person plural, siam
//   demonstrative  quei, quegli  quello         the closed forms of quello and bello
//                  bei, begli    bello
//   superlative    bravissimo    bravo          an absolute superlative in -issimo
//   participle     piaciuta      piaciuto       a past participle agreeing with its noun
//
// Four more read the regular forms of a word whose record lists none, and
// answer only when none of the six above does:
//
//   inflected        tate, crucchi  tata, crucco   a noun's or adjective's regular plural or feminine
//   conjugated       fischia        fischiare      a regular form of a verb with no table
//   plural-spelling  valige         valigie        the other spelling of a -cie or -gie plural
//   english-plural   marines        marine         an English loanword's plural in -s
//
// Each shape says which records can be its word (`shapeAdmits`). None is a
// proper name, an abbreviation, a symbol or a word part, whose keys are lower
// case like any word's (`Como` is no `com'`). None is a plural noun,
// adjective, pronoun or article: Italian elides and truncates a singular, and
// a superlative or a demonstrative names its lemma (`belle` is no `bell'`,
// `capitane` no `capitan`). A clitic form is a verb's, a superlative and a
// demonstrative form an adjective's, an agreeing participle a verb table's
// past participle. An elided form is never a noun's: Italian elides the
// article, the pronoun, the adjective, the numeral, the adverb and the verb.
// An inflected or conjugated form is a record's that lists no forms: a record
// with a table lists its own, and the rule never adds to one. A plural
// spelling is a plural's, and an English plural a noun's, whatever its table.
//
// A truncated spelling is read in tiers, the first the dictionary has
// winning: `-e` (`aver`, `color`), then `-o` (`son`, `ciel`), with `-no`
// after `-an` (`han`, `stan`). Only `ora` and its compounds (`ancor`) and
// `suora` truncate an `-a`, and they are a closed list.
//
// The rule runs only on a query nothing else answers, so it never changes a
// word the dictionary has. Nothing derived is stored: the rule reads the
// query at lookup time.

/** The rule's name and version. */
export const WORD_SHAPE_RULE = "it-word-shape/v1" as const;

/** How a typed form is shaped from its word. */
export type Shape =
  | "clitic"
  | "elided"
  | "truncated"
  | "demonstrative"
  | "superlative"
  | "participle"
  | "inflected"
  | "conjugated"
  | "plural-spelling"
  | "english-plural";

/** The shapes that read a regular form the record does not list: they answer only when no other shape does. */
const REGULAR_FORMS: ReadonlySet<Shape> = new Set(["inflected", "conjugated", "plural-spelling", "english-plural"]);

/**
 * One spelling of a word a query may be a form of: the key to probe, the
 * shape that names it, and its tier. Within one shape only the lowest tier the
 * dictionary has counts; each shape counts on its own.
 */
export interface ShapedSpelling {
  readonly rule: typeof WORD_SHAPE_RULE;
  readonly shape: Shape;
  /** The spelling's index key: `raccontare`, `da'`, `quello`. */
  readonly key: string;
  readonly tier: number;
}

/**
 * What the rule reads of a record a spelling reaches: its part of speech, as
 * `source_record.pos` names it, whether the source states the spelling a
 * plural there, whether it is a cell the record's table places as the past
 * participle, and whether the record lists any form in `forms[]`.
 */
export interface ShapedRecord {
  pos: string;
  plural: boolean;
  pastParticiple: boolean;
  listsForms: boolean;
}

/** The parts of speech no shape's word has: names, abbreviations, symbols, letters and word parts, none of them a word a form is made from. */
const NEVER: ReadonlySet<string> = new Set(["name", "abbrev", "symbol", "character", "prefix", "suffix", "affix"]);

const isNominal = (pos: string): boolean => pos === "noun" || pos === "adj";

/** The tiers of `inflected`: the gender kept, a feminine singular, a feminine plural. */
const INFLECTED_FEMININE = 1;
const INFLECTED_FEMININE_PLURAL = 2;

/**
 * Whether a record a spelling of `shape` and `tier` reaches can be the word
 * the query is a form of. An inflected feminine plural is an adjective's
 * alone: a plural in `-e` is read first as the plural of a word in `-a`, and
 * read as a noun's feminine too it would make `homo` of `home`.
 */
export function shapeAdmits(shape: Shape, { pos, plural, pastParticiple, listsForms }: ShapedRecord, tier = 0): boolean {
  if (NEVER.has(pos)) return false;
  if (shape === "plural-spelling") return plural && isNominal(pos);
  if (plural && pos !== "verb") return false;
  switch (shape) {
    case "clitic":
      return pos === "verb";
    case "demonstrative":
    case "superlative":
      return pos === "adj";
    case "elided":
      return pos !== "noun";
    case "truncated":
      return true;
    case "participle":
      return pos === "verb" && pastParticiple;
    case "inflected":
      return (tier === INFLECTED_FEMININE_PLURAL ? pos === "adj" : isNominal(pos)) && !listsForms;
    case "conjugated":
      return pos === "verb" && !listsForms;
    case "english-plural":
      return pos === "noun";
  }
}

/** A spelling that answers, with the rows the dictionary has for it that its shape admits. */
export interface AnsweringSpelling<T> {
  spelling: ShapedSpelling;
  rows: [T, ...T[]];
}

/**
 * The spellings of `spellings` that answer, in their order: of each shape,
 * every spelling of the lowest tier with a row the shape admits, and only
 * those rows. A shape of `REGULAR_FORMS` answers only when no other shape
 * does. `rowsOf` gives a key's rows, `recordOf` what the rule reads of a
 * row's record.
 */
export function answeringSpellings<T>(
  spellings: readonly ShapedSpelling[],
  rowsOf: (key: string) => readonly T[],
  recordOf: (row: T) => ShapedRecord,
): AnsweringSpelling<T>[] {
  const each = spellings.flatMap((one): AnsweringSpelling<T>[] => {
    const [first, ...rest] = rowsOf(one.key).filter((row) => shapeAdmits(one.shape, recordOf(row), one.tier));
    return first === undefined ? [] : [{ spelling: one, rows: [first, ...rest] }];
  });
  const listed = each.filter(({ spelling: one }) => !REGULAR_FORMS.has(one.shape));
  const admitted = listed.length > 0 ? listed : each;
  const lowest = new Map<Shape, number>();
  for (const { spelling: one } of admitted) lowest.set(one.shape, Math.min(lowest.get(one.shape) ?? one.tier, one.tier));
  return admitted.filter(({ spelling: one }) => one.tier === lowest.get(one.shape));
}

/** The pronouns a clitic cluster pairs before `lo`, `la`, `li`, `le` and `ne`. */
const PAIRED = ["me", "te", "ce", "ve", "se", "glie"] as const;
/** The pronouns that close a cluster, or stand alone. */
const CLOSING = ["lo", "la", "li", "le", "ne"] as const;
/** The pronouns that only stand alone. */
const ALONE = ["mi", "ti", "ci", "vi", "si", "gli"] as const;

/** The reflexive pronouns, alone and paired: a cluster that opens with one may belong to a pronominal verb. */
const REFLEXIVE_ALONE: ReadonlySet<string> = new Set(["mi", "ti", "ci", "vi", "si"]);
const REFLEXIVE_PAIRED: ReadonlySet<string> = new Set(["me", "te", "ce", "ve", "se"]);

/** A clitic cluster as the query ends with it: its text, and its pronouns. */
interface Cluster {
  text: string;
  first: string;
  second: string | undefined;
}

const CLUSTERS: readonly Cluster[] = [
  ...PAIRED.flatMap((first) => CLOSING.map((second) => ({ text: `${first}${second}`, first, second }))),
  ...[...ALONE, ...CLOSING].map((first) => ({ text: first, first, second: undefined })),
];

/**
 * The imperatives of one syllable, which double a clitic's consonant: `da'`
 * gives `dammi`, `di'` `dimmi`, `fa'` `fallo`, `sta'` `stammi`, `va'`
 * `vattene`. `gli` is never doubled: `dagli`.
 */
const ONE_SYLLABLE_IMPERATIVES: ReadonlySet<string> = new Set(["da", "di", "fa", "sta", "va"]);

/**
 * The verb forms a clitic joins, as their spelling ends: a gerund
 * (`dicendo`), the first person plural (`facciamo`), the second person
 * plural (`scusate`, `mettete`, `seguite`) and the second person singular
 * imperative (`scusa`, `metti`). An infinitive is read apart, without its
 * final vowel.
 */
const JOINS_CLITICS = /(?:ndo|iamo|[aei]te|[ai])$/u;

/** The stem of an infinitive in `-rre`: `trarre` and its compounds, `porre`, `condurre`. */
const IN_RRE = /(?:trar|or|ur)$/u;

/** A masculine plural past participle, `fuggiti`, which takes no clitic: no second person singular imperative ends so. */
const PARTICIPLE_PLURAL = /[aiu]ti$/u;

/** The demonstrative forms the source lists under no record, and their word. */
const DEMONSTRATIVES: ReadonlyMap<string, string> = new Map([
  ["quei", "quello"],
  ["quegli", "quello"],
  ["bei", "bello"],
  ["begli", "bello"],
]);

/** The pronouns of one letter that elide: `m'` is `mi`. `l'`, the article, is a headword. */
const ELIDED_LETTERS: ReadonlyMap<string, string> = new Map([
  ["m", "mi"],
  ["t", "ti"],
  ["s", "si"],
  ["c", "ci"],
  ["v", "vi"],
  ["n", "ne"],
]);

/** The only words that truncate an `-a`: `ora` and its compounds, and `suora`. */
const TRUNCATED_A: ReadonlySet<string> = new Set(["or", "allor", "ancor", "finor", "ognor", "talor", "suor"]);

/** Letters only, the shape of a word: no space, digit or apostrophe. */
const WORD = /^\p{L}+$/u;
const ENDS_IN_CONSONANT = /[bcdfghjklmnpqrstvwxz]$/u;

/** Every spelling `key` may be a form of, in the rule's order. Empty when the key has none of the rule's shapes. */
export function shapedSpellings(key: string): ShapedSpelling[] {
  return [
    ...clitic(key),
    ...elided(key),
    ...truncated(key),
    ...demonstrative(key),
    ...superlative(key),
    ...participle(key),
    ...inflected(key),
    ...conjugated(key),
    ...pluralSpelling(key),
    ...englishPlural(key),
  ];
}

const spelling = (shape: Shape, key: string, tier = 0): ShapedSpelling => ({ rule: WORD_SHAPE_RULE, shape, key, tier });

/**
 * A verb with clitic pronouns joined after it: an infinitive, which drops its
 * final `-e` (`raccontar-vi`) or `-re` (`por-lo` of `porre`), or a form
 * `JOINS_CLITICS` names (`scusa-mi`, `scusate-mi`, `facciamo-lo`,
 * `dicendo-mi`). An infinitive whose cluster opens with a reflexive pronoun
 * may also be its pronominal verb: `vergognar-ti` is `vergognarsi`,
 * `andar-tene` `andarsene`.
 */
function clitic(key: string): ShapedSpelling[] {
  if (!WORD.test(key)) return [];
  const keys = CLUSTERS.flatMap((cluster) => cliticKeys(key, cluster).map(({ key: one }) => one));
  return [...new Set(keys)].map((one) => spelling("clitic", one));
}

/** A spelling a clitic cluster joins, and whether it is the pronominal verb the cluster's reflexive names (`vergognarsi` of `vergognarti`). */
interface CliticKey {
  key: string;
  pronominal: boolean;
}

/** The spellings `key` may be, read as `cluster` joined after a verb form; none when it does not end with `cluster`. */
function cliticKeys(key: string, cluster: Cluster): CliticKey[] {
  if (!key.endsWith(cluster.text)) return [];
  const stem = key.slice(0, -cluster.text.length);
  if (stem.length < 2) return [];
  const plain = (one: string): CliticKey => ({ key: one, pronominal: false });
  if (/[aeiou]r$/u.test(stem)) {
    const reflexive = pronominal(cluster);
    return [
      plain(`${stem}e`),
      ...(IN_RRE.test(stem) ? [plain(`${stem}re`)] : []),
      ...(reflexive === undefined ? [] : [{ key: `${stem}${reflexive}`, pronominal: true }]),
    ];
  }
  const undoubled = stem.slice(0, -1);
  if (cluster.first !== "gli" && stem.at(-1) === cluster.text[0] && ONE_SYLLABLE_IMPERATIVES.has(undoubled)) return [plain(`${undoubled}'`)];
  if (ONE_SYLLABLE_IMPERATIVES.has(stem)) return cluster.first === "gli" ? [plain(`${stem}'`)] : [];
  return JOINS_CLITICS.test(stem) && !PARTICIPLE_PLURAL.test(stem) ? [plain(stem)] : [];
}

/** The cluster a pronominal infinitive ends with, when `cluster` opens with a reflexive: `ti` → `si`, `tene` → `sene`. */
function pronominal(cluster: Cluster): string | undefined {
  if (cluster.second === undefined) return REFLEXIVE_ALONE.has(cluster.first) ? "si" : undefined;
  return REFLEXIVE_PAIRED.has(cluster.first) ? `se${cluster.second}` : undefined;
}

/**
 * A word whose final vowel is dropped before a vowel: `quell'`, `dov'`, `m'`.
 * Never a vowel before the apostrophe: `citta'` writes an accent, not an
 * elision.
 */
function elided(key: string): ShapedSpelling[] {
  if (!key.endsWith("'")) return [];
  const stem = key.slice(0, -1);
  if (!WORD.test(stem) || !ENDS_IN_CONSONANT.test(stem)) return [];
  const pronoun = ELIDED_LETTERS.get(stem);
  if (pronoun !== undefined) return [spelling("elided", pronoun)];
  if (stem.length < 2) return [];
  return ["o", "a", "e"].map((vowel) => spelling("elided", `${stem}${vowel}`));
}

/**
 * A word cut short after `l`, `r` or `n`: `aver`, `cuor`, `son`, `han`,
 * `ancor`; after `m` only a first person plural, `siam`, `andiam`. Never
 * after a double consonant, which a cut word loses with its vowel (`bello` is
 * cut to `bel`, so `bell` is none), and never a word with no vowel left.
 */
function truncated(key: string): ShapedSpelling[] {
  if (!WORD.test(key)) return [];
  if (key.endsWith("iam") && key.length > 3) return [spelling("truncated", `${key}o`)];
  if (!/[aeiouàèéìòù][lrn]$/u.test(key)) return [];
  if (TRUNCATED_A.has(key)) return [spelling("truncated", `${key}a`)];
  return [
    spelling("truncated", `${key}e`, 0),
    spelling("truncated", `${key}o`, 1),
    ...(key.endsWith("an") ? [spelling("truncated", `${key}no`, 1)] : []),
  ];
}

function demonstrative(key: string): ShapedSpelling[] {
  const word = DEMONSTRATIVES.get(key);
  return word === undefined ? [] : [spelling("demonstrative", word)];
}

/**
 * An absolute superlative: `bravissimo` of `bravo`, `felicissima` of
 * `felice`, `ricchissimi` of `ricco`, whose `h` only keeps the stem's sound.
 */
function superlative(key: string): ShapedSpelling[] {
  const match = /^(\p{L}{2,}?)issim[oaie]$/u.exec(key);
  if (match === null) return [];
  const stem = match[1];
  const keys = /[cg]h$/u.test(stem) ? [`${stem.slice(0, -1)}o`] : [`${stem}o`, `${stem}e`];
  return keys.map((one) => spelling("superlative", one));
}

/**
 * A past participle agreeing with its noun, which a verb's table lists only
 * as the masculine singular: `piaciuta`, `piaciuti`, `piaciute` of
 * `piaciuto`, `valsa` of `valso`.
 */
function participle(key: string): ShapedSpelling[] {
  if (!WORD.test(key) || !/^\p{L}{2,}[aie]$/u.test(key)) return [];
  return [spelling("participle", `${key.slice(0, -1)}o`)];
}

/** A stem that keeps the hard sound of its `c` or `g` with an `h`: `crucch-i`, `bianch-e`. */
const HARD_STEM = /[cg]h$/u;

/**
 * A noun's or adjective's regular plural or feminine. Tier 0 keeps the
 * gender: a plural in `-i` of a word in `-o`, `-e` or `-io` (`fuggitivi`,
 * `artificieri`), `-chi` of `-co` (`crucchi`), a plural in `-e` of a word in
 * `-a` (`tate`, `follie`), `-che` of `-ca`, `-ce` or `-ge` of `-cia` or
 * `-gia` (`valige`). Tier 1 is the feminine singular of a word in `-o`
 * (`poverina`), tier 2 its feminine plural (`fuggitive`): `tipe` is the
 * plural of `tipa` before it is the feminine of `tipo`.
 */
function inflected(key: string): ShapedSpelling[] {
  if (!WORD.test(key) || key.length < 3) return [];
  const stem = key.slice(0, -1);
  const hard = HARD_STEM.test(stem) ? stem.slice(0, -1) : undefined;
  switch (key.at(-1)) {
    case "i":
      if (hard !== undefined) return [spelling("inflected", `${hard}o`)];
      return [`${stem}o`, `${stem}e`, ...(stem.endsWith("i") ? [] : [`${stem}io`])].map((one) => spelling("inflected", one));
    case "e":
      if (hard !== undefined) return [spelling("inflected", `${hard}a`), spelling("inflected", `${hard}o`, INFLECTED_FEMININE_PLURAL)];
      return [
        spelling("inflected", `${stem}a`),
        ...(/[cg]$/u.test(stem) ? [spelling("inflected", `${stem}ia`)] : []),
        spelling("inflected", `${stem}o`, INFLECTED_FEMININE_PLURAL),
      ];
    case "a":
      return [spelling("inflected", `${stem}o`, INFLECTED_FEMININE)];
    default:
      return [];
  }
}

/** A regular verb's endings, by its infinitive's: present, imperfect, simple past, future, conditional, subjunctives, imperative, gerund and participles. */
const ENDINGS: ReadonlyMap<string, readonly string[]> = new Map([
  [
    "are",
    [
      "o", "i", "a", "iamo", "ate", "ano", "avo", "avi", "ava", "avamo", "avate", "avano", "ai", "asti", "ò", "ammo", "aste", "arono",
      "erò", "erai", "erà", "eremo", "erete", "eranno", "erei", "eresti", "erebbe", "eremmo", "ereste", "erebbero",
      "iate", "ino", "assi", "asse", "assimo", "assero", "ando", "ato", "ata", "ati", "ate", "ante", "anti",
    ],
  ],
  [
    "ere",
    [
      "o", "i", "e", "iamo", "ete", "ono", "evo", "evi", "eva", "evamo", "evate", "evano", "ei", "etti", "esti", "é", "ette", "emmo", "este", "erono", "ettero",
      "erò", "erai", "erà", "eremo", "erete", "eranno", "erei", "eresti", "erebbe", "eremmo", "ereste", "erebbero",
      "a", "iate", "ano", "essi", "esse", "essimo", "essero", "endo", "uto", "uta", "uti", "ute", "ente", "enti",
    ],
  ],
  [
    "ire",
    [
      "o", "i", "e", "iamo", "ite", "ono", "isco", "isci", "isce", "iscono", "ivo", "ivi", "iva", "ivamo", "ivate", "ivano", "ii", "isti", "ì", "immo", "iste", "irono",
      "irò", "irai", "irà", "iremo", "irete", "iranno", "irei", "iresti", "irebbe", "iremmo", "ireste", "irebbero",
      "a", "iate", "ano", "isca", "iscano", "issi", "isse", "issimo", "issero", "endo", "ito", "ita", "iti", "ente", "enti",
    ],
  ],
]);

/**
 * A regular form of a verb: each ending `ENDINGS` lists that the key ends
 * with names its stem's infinitive (`annett-e` of `annettere`). A verb in
 * `-iare` drops its `i` before an `i` or an `e` (`fischi` of `fischiare`),
 * and one in `-care` or `-gare` writes an `h` there (`cerchi` of `cercare`).
 * A stem keeps a vowel and two letters at least.
 */
function conjugated(key: string): ShapedSpelling[] {
  if (!WORD.test(key)) return [];
  const keys = [...ENDINGS].flatMap(([infinitive, endings]) =>
    endings.flatMap((ending) => {
      if (!key.endsWith(ending)) return [];
      const stem = key.slice(0, -ending.length);
      if (stem.length < 2 || !/[aeiouàèéìòù]/u.test(stem)) return [];
      if (infinitive !== "are" || !/^[ieèé]/u.test(ending)) return [`${stem}${infinitive}`];
      return [`${stem}are`, ...(stem.endsWith("i") ? [] : [`${stem}iare`]), ...(HARD_STEM.test(stem) ? [`${stem.slice(0, -1)}are`] : [])];
    }),
  );
  return [...new Set(keys)].map((one) => spelling("conjugated", one));
}

/** A plural in `-cie` or `-gie` written `-ce` or `-ge`, or back: `valige` of `valigie`, `provincie` of `province`. */
function pluralSpelling(key: string): ShapedSpelling[] {
  if (!WORD.test(key) || key.length < 4) return [];
  if (/[cg]ie$/u.test(key)) return [spelling("plural-spelling", `${key.slice(0, -2)}e`)];
  if (/[cg]e$/u.test(key)) return [spelling("plural-spelling", `${key.slice(0, -1)}ie`)];
  return [];
}

/** An English loanword's plural in `-s`: `marines` of `marine`, `studios` of `studio`. */
function englishPlural(key: string): ShapedSpelling[] {
  if (!key.endsWith("s")) return [];
  const stem = key.slice(0, -1);
  return WORD.test(stem) && stem.length >= 3 ? [spelling("english-plural", stem)] : [];
}

/**
 * The rule that writes what a typed form is of the word its shape names: the
 * line a shape's page shows under each block's heading (#802). Lexema's text,
 * built when the page renders and stored nowhere (ADR 0008, ADR 0012).
 */
export const WORD_SHAPE_LINE_RULE = "it-word-shape-line/v1" as const;

/** A paired pronoun as it stands alone: `me` of `melo` is `mi`, `glie` of `glielo` is `gli`. */
const ALONE_OF_PAIRED: ReadonlyMap<string, string> = new Map([
  ["me", "mi"],
  ["te", "ti"],
  ["ce", "ci"],
  ["ve", "vi"],
  ["se", "si"],
  ["glie", "gli"],
]);

/** A participle's agreement, by its last letter: `piaciuta`, `piaciuti`, `piaciute`. */
const PARTICIPLE_AGREEMENT: ReadonlyMap<string, string> = new Map([
  ["a", "femminile singolare"],
  ["i", "maschile plurale"],
  ["e", "femminile plurale"],
]);

/** An inflected form's grammar, by its tier: the gender kept, a feminine singular, a feminine plural. */
const INFLECTED_GRAMMAR: ReadonlyMap<number, string> = new Map([
  [0, "plurale"],
  [INFLECTED_FEMININE, "femminile singolare"],
  [INFLECTED_FEMININE_PLURAL, "femminile plurale"],
]);

/**
 * What `key` is of the word `answering` spells, in Italian, ending with that
 * spelling so a page can link it:
 *
 *   clitic           raccontarvi   "pronome vi unito a raccontare"
 *                    dirmelo       "pronomi mi e lo uniti a dire"
 *                    vergognarti   "infinito di vergognarsi"
 *   elided           quell'        "forma elisa di quello"
 *   truncated        aver          "forma tronca di avere"
 *   demonstrative    quei          "maschile plurale di quello"
 *   superlative      bravissimo    "superlativo assoluto di bravo"
 *   participle       piaciute      "femminile plurale di piaciuto"
 *   inflected        tate          "plurale di tata", poverina "femminile singolare di poverino"
 *   conjugated       fischia       "voce del verbo fischiare"
 *   plural-spelling  valige        "variante grafica di valigie"
 *   english-plural   marines       "plurale di marine"
 *
 * `answering` is one of `shapedSpellings(key)`.
 */
export function wordShapeLine(key: string, answering: ShapedSpelling): string {
  const word = answering.key;
  switch (answering.shape) {
    case "clitic":
      return cliticLine(key, word);
    case "elided":
      return `forma elisa di ${word}`;
    case "truncated":
      return `forma tronca di ${word}`;
    case "demonstrative":
      return `maschile plurale di ${word}`;
    case "superlative":
      return `superlativo assoluto di ${word}`;
    case "participle":
      return `${PARTICIPLE_AGREEMENT.get(key.at(-1) ?? "") ?? "participio"} di ${word}`;
    case "inflected":
      return `${INFLECTED_GRAMMAR.get(answering.tier) ?? "plurale"} di ${word}`;
    case "conjugated":
      return `voce del verbo ${word}`;
    case "plural-spelling":
      return `variante grafica di ${word}`;
    case "english-plural":
      return `plurale di ${word}`;
  }
}

/**
 * A clitic form's line: the pronouns of the longest cluster that reads `key`
 * as `word`, joined to it, or, for the pronominal verb a reflexive names, that
 * verb's infinitive. `a` is `ad` before an `a`, as Italian writes it.
 */
function cliticLine(key: string, word: string): string {
  const longestFirst = [...CLUSTERS].sort((a, b) => b.text.length - a.text.length);
  for (const cluster of longestFirst) {
    const read = cliticKeys(key, cluster).find((candidate) => candidate.key === word);
    if (read === undefined) continue;
    if (read.pronominal) return `infinito di ${word}`;
    const to = word.startsWith("a") ? "ad" : "a";
    return cluster.second === undefined
      ? `pronome ${cluster.first} unito ${to} ${word}`
      : `pronomi ${ALONE_OF_PAIRED.get(cluster.first) ?? cluster.first} e ${cluster.second} uniti ${to} ${word}`;
  }
  return `forma di ${word}`;
}
