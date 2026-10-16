// The pronominal verb a `si` + verb pair is said with, by rule
// `it-pronominal-pair/v1` (#810).
//
// Italian says a pronominal verb's finite forms with the reflexive pronoun
// before the verb: `trasferirsi` is said `si trasferisce`, `si trasferiscono`.
// The source lists such forms under the plain verb's table (`trasferiscono`
// is a cell of trasferire's), and the pronominal verb's own record lists
// none. This rule reads a query of `si` and one word, and the table cells of
// verbs that spell that word, and names the pronominal infinitive each verb
// gives:
//
//   si trasferiscono  trasferiscono  trasferire  trasferirsi
//   si pone           pone           porre       porsi
//
// Only `si` opens a pair, and only a third person cell is read with it: `si`
// is the third person's reflexive pronoun (`si trasferisce`, `si
// trasferiscono`), and the impersonal `si` takes the third person too. A
// pair answers only where the dictionary has the pronominal infinitive as a
// verb's headword: the rule names a spelling, and the dictionary says whether
// that word exists.
//
// The rule runs only on a query nothing else answers, so it never changes a
// word the dictionary has. Nothing derived is stored: the rule reads the
// query at lookup time.

/** The rule's name and version. */
export const PRONOMINAL_PAIR_RULE = "it-pronominal-pair/v1" as const;

/** The pronoun that opens a pair. */
const REFLEXIVE = "si";

/** Letters only, the shape of one word. */
const WORD = /^\p{L}+$/u;

/** A query the rule reads as a pair: `si` and one word, the verb form, as an index key. */
export interface PairQuery {
  readonly rule: typeof PRONOMINAL_PAIR_RULE;
  /** The verb form as the query spells it: `trasferiscono`. */
  readonly form: string;
}

/** The pair `key` spells, or undefined when it is not `si` and one word. */
export function pairQueryOf(key: string): PairQuery | undefined {
  const words = key.split(" ");
  if (words.length !== 2) return undefined;
  const [pronoun, form] = words;
  if (pronoun !== REFLEXIVE || !WORD.test(form)) return undefined;
  return { rule: PRONOMINAL_PAIR_RULE, form };
}

/** What the rule reads of a cell that spells the pair's verb form: its record's word and part of speech, and whether the cell is a third person's. */
export interface PairedCell {
  word: string;
  pos: string;
  thirdPerson: boolean;
}

/**
 * The pronominal infinitive of an infinitive: its final `-e` turned to `si`
 * (`trasferire` → `trasferirsi`), or an infinitive in `-rre` its `-re`
 * (`porre` → `porsi`, `condurre` → `condursi`). A word that is already a
 * pronominal infinitive gives itself. Undefined for a word that is no
 * infinitive.
 */
export function pronominalInfinitiveOf(word: string): string | undefined {
  if (!WORD.test(word)) return undefined;
  if (/rsi$/u.test(word)) return word;
  if (/rre$/u.test(word)) return `${word.slice(0, -2)}si`;
  if (/[aeiou]re$/u.test(word)) return `${word.slice(0, -1)}si`;
  return undefined;
}

/**
 * A pair read as a pronominal verb: the verb form typed, the verb whose
 * table spells it, and the pronominal infinitive, the key the dictionary is
 * asked for.
 */
export interface PronominalPair {
  readonly rule: typeof PRONOMINAL_PAIR_RULE;
  /** The verb form as the query spells it: `trasferiscono`. */
  readonly form: string;
  /** The verb whose table spells it: `trasferire`. */
  readonly verb: string;
  /** The pronominal infinitive's index key: `trasferirsi`. */
  readonly key: string;
}

/**
 * The pronominal infinitives `query` may be, one for each verb whose third
 * person cell spells its verb form, each once, in the cells' order.
 */
export function pronominalPairs(query: PairQuery, cells: readonly PairedCell[]): PronominalPair[] {
  const pairs = new Map<string, PronominalPair>();
  for (const cell of cells) {
    if (cell.pos !== "verb" || !cell.thirdPerson) continue;
    const key = pronominalInfinitiveOf(cell.word);
    if (key !== undefined && !pairs.has(key)) pairs.set(key, { rule: PRONOMINAL_PAIR_RULE, form: query.form, verb: cell.word, key });
  }
  return [...pairs.values()];
}

/** What the rule reads of a row the pronominal infinitive's key reaches: its part of speech, and whether the key is that row's headword. */
export interface PronominalHead {
  pos: string;
  headword: boolean;
}

/** Whether a row the pronominal infinitive reaches is that verb: a verb's headword, never a table cell. */
export const isPronominalVerb = ({ pos, headword }: PronominalHead): boolean => pos === "verb" && headword;
