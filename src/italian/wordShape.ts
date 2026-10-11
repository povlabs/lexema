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
// Each shape says which records can be its word (`shapeAdmits`). None is a
// proper name, an abbreviation, a symbol or a word part, whose keys are lower
// case like any word's (`Como` is no `com'`). None is a plural noun,
// adjective, pronoun or article: Italian elides and truncates a singular, and
// a superlative or a demonstrative names its lemma (`belle` is no `bell'`,
// `capitane` no `capitan`). A clitic form is a verb's, a superlative and a
// demonstrative form an adjective's, an agreeing participle a verb table's
// past participle. An elided form is never a noun's: Italian elides the
// article, the pronoun, the adjective, the numeral, the adverb and the verb.
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
export type Shape = "clitic" | "elided" | "truncated" | "demonstrative" | "superlative" | "participle";

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
 * plural there, and whether it is a cell the record's table places as the past
 * participle.
 */
export interface ShapedRecord {
  pos: string;
  plural: boolean;
  pastParticiple: boolean;
}

/** The parts of speech no shape's word has: names, abbreviations, symbols, letters and word parts, none of them a word a form is made from. */
const NEVER: ReadonlySet<string> = new Set(["name", "abbrev", "symbol", "character", "prefix", "suffix", "affix"]);

/** Whether a record a spelling of `shape` reaches can be the word the query is a form of. */
export function shapeAdmits(shape: Shape, { pos, plural, pastParticiple }: ShapedRecord): boolean {
  if (NEVER.has(pos) || (plural && pos !== "verb")) return false;
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
 * those rows. `rowsOf` gives a key's rows, `recordOf` what the rule reads of a
 * row's record.
 */
export function answeringSpellings<T>(
  spellings: readonly ShapedSpelling[],
  rowsOf: (key: string) => readonly T[],
  recordOf: (row: T) => ShapedRecord,
): AnsweringSpelling<T>[] {
  const admitted = spellings.flatMap((one): AnsweringSpelling<T>[] => {
    const [first, ...rest] = rowsOf(one.key).filter((row) => shapeAdmits(one.shape, recordOf(row)));
    return first === undefined ? [] : [{ spelling: one, rows: [first, ...rest] }];
  });
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
  return [...clitic(key), ...elided(key), ...truncated(key), ...demonstrative(key), ...superlative(key), ...participle(key)];
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
  const keys = CLUSTERS.flatMap((cluster) => {
    if (!key.endsWith(cluster.text)) return [];
    const stem = key.slice(0, -cluster.text.length);
    if (stem.length < 2) return [];
    if (/[aeiou]r$/u.test(stem)) {
      const reflexive = pronominal(cluster);
      return [`${stem}e`, ...(IN_RRE.test(stem) ? [`${stem}re`] : []), ...(reflexive === undefined ? [] : [`${stem}${reflexive}`])];
    }
    const undoubled = stem.slice(0, -1);
    if (cluster.first !== "gli" && stem.at(-1) === cluster.text[0] && ONE_SYLLABLE_IMPERATIVES.has(undoubled)) return [`${undoubled}'`];
    if (ONE_SYLLABLE_IMPERATIVES.has(stem)) return cluster.first === "gli" ? [`${stem}'`] : [];
    return JOINS_CLITICS.test(stem) && !PARTICIPLE_PLURAL.test(stem) ? [stem] : [];
  });
  return [...new Set(keys)].map((one) => spelling("clitic", one));
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
