// The gender and number stamp Wikizionario writes on a noun's first `#` line
// (#308, #317). That line states no meaning:
//
//   # {{Pn|w}} ''f sing'' {{Linkp|case}}
//
// The extraction keeps it as a sense anyway, so the stamp ends up as the last
// letters of a gloss (`casa ( approfondimento) f sing`) and never reaches the
// record's `tags`. This file reads that one shape; which records it may lift
// into grammar claims is the importer's call (src/import/grammarPolicy.ts).

/** The rule's name and version, as the import and the one-off update report it. */
export const GLOSS_GRAMMAR_STAMP_RULE = "it-gloss-stamp/v1" as const;

const STAMP_GENDER = { m: "masculine", f: "feminine" } as const;
const STAMP_NUMBER = { sing: "singular", pl: "plural" } as const;

export type StampGender = (typeof STAMP_GENDER)[keyof typeof STAMP_GENDER];
export type StampNumber = (typeof STAMP_NUMBER)[keyof typeof STAMP_NUMBER];

/** The sentence `{{Nodef}}` prints (#255); a stamp can follow it on the line. */
const NO_DEFINITION = "definizione mancante; se vuoi, aggiungila tu";

/** A stamp read off one gloss. */
export interface GlossGrammarStamp {
  readonly gender: StampGender;
  /** Absent when the stamp is a gender letter alone (`presina f`). */
  readonly number?: StampNumber;
  /** The stamp as the source wrote it: `f sing`, `m`. */
  readonly sourceText: string;
  /** The gloss with the stamp and the space before it taken off; "" when the stamp was all of it. */
  readonly rest: string;
}

/**
 * SQLite GLOBs that together match every gloss `readGlossGrammarStamp` reads a
 * stamp from, and more. The one-off update selects with these and lets the
 * rule decide, so the rule is written once.
 */
export const STAMPED_GLOSS_GLOBS = ["[mf]", "* [mf]", "[mf] sing", "* [mf] sing", "[mf] pl", "* [mf] pl"] as const;

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * The stamp in `gloss`, or undefined when the whole gloss is not a stamp line.
 *
 * Matched on the whole gloss: an optional lead from a closed list — the
 * headword and its `( approfondimento)` link, the headword alone, or the
 * no-definition sentence — then `m` or `f`, then optionally `sing` or `pl`,
 * then nothing. Prose before the letter means it is not a stamp: `1 m` is a
 * metre, `simbolo chimico F` a symbol, `the letter m, M` a letter.
 */
export function readGlossGrammarStamp(word: string, gloss: string): GlossGrammarStamp | undefined {
  const head = escaped(word);
  const lead = `(?:${head} \\( approfondimento\\) |${head} |${escaped(NO_DEFINITION)} )?`;
  const match = new RegExp(`^${lead}(?<gender>[mf])(?: (?<number>sing|pl))?$`, "u").exec(gloss);
  if (match?.groups === undefined) return undefined;
  const { gender, number } = match.groups as { gender: keyof typeof STAMP_GENDER; number?: keyof typeof STAMP_NUMBER };
  const start = gloss.length - (number === undefined ? 1 : 2 + number.length);
  return {
    gender: STAMP_GENDER[gender],
    ...(number === undefined ? {} : { number: STAMP_NUMBER[number] }),
    sourceText: gloss.slice(start),
    rest: gloss.slice(0, start).trimEnd(),
  };
}
