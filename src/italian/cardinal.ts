// Rule `it-cardinal/v1` (ADR 0034, #804): a spelled Italian cardinal from 0
// to 999.999, read into its value, so a lookup can answer a number word the
// source does not list (`duemilauno`, 2001) with one fixed Lexema
// definition. Huey's rulings of 2026-10-18
// (https://github.com/povlabs/lexema/issues/804#issuecomment-6255375569,
// https://github.com/povlabs/lexema/issues/804#issuecomment-6255635117).
// What the lookup does with it is src/lookup/cardinal.ts.
//
// The spelling the rule reads is the written one-word cardinal:
// - a ten drops its final vowel before `uno` and `otto` (`ventuno`,
//   `trentotto`), and only there (`ventidue`, never `ventiuno`);
// - a hundred drops its final `o` before `ottanta` (`centottanta`,
//   `novecentottanta`), and may keep or drop it before `uno` and `otto`
//   (`centouno` and `centuno`, `centootto` and `centotto`);
// - one thousand is `mille`, more are `-mila` (`duemila`), and a
//   multiplier ending in `uno` may drop its `o` there (`ventunmila` and
//   `ventunomila`);
// - a final `tre` in a compound may carry its accent (`ventitré`) or not
//   (`ventitre`, as an accentless query opens its headword, #846); `tre`
//   alone, and a `tre` before more letters (`tremila`), carries none.
// Anything else, a space, a hyphen or `e` between the parts, a digit, or a
// number from a million up (`unmilione`), is no cardinal of the rule.

/** The rule's name, as the ADR and a reading's ref give it. */
export const CARDINAL_RULE = "it-cardinal/v1";

/** The largest value the rule reads: 999.999. */
export const CARDINAL_LIMIT = 999_999;

declare const cardinalValue: unique symbol;

/** A whole number from 0 to `CARDINAL_LIMIT`, as only `parseItalianCardinal` makes one. */
export type CardinalValue = number & { readonly [cardinalValue]: true };

/** A spelled Italian cardinal the rule read, and its value. */
export interface ItalianCardinal {
  rule: typeof CARDINAL_RULE;
  value: CardinalValue;
}

const UNITS = ["", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove"] as const;
const TEENS = ["dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"] as const;
const TENS = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"] as const;

/** The one spelling of 1 to 99. */
function belowHundred(n: number): string {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  const ten = TENS[Math.floor(n / 10)];
  const unit = n % 10;
  if (unit === 0) return ten;
  // `ventuno`, `trentotto`: the ten's last vowel drops before a vowel.
  return unit === 1 || unit === 8 ? ten.slice(0, -1) + UNITS[unit] : ten + UNITS[unit];
}

/** Every spelling of 1 to 999, with no final accent. */
function belowThousand(n: number): string[] {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) return [belowHundred(rest)];
  const cento = hundreds === 1 ? "cento" : `${UNITS[hundreds]}cento`;
  const cent = cento.slice(0, -1);
  if (rest === 0) return [cento];
  if (rest >= 80 && rest < 90) return [cent + belowHundred(rest)];
  if (rest === 1 || rest === 8) return [cento + belowHundred(rest), cent + belowHundred(rest)];
  return [cento + belowHundred(rest)];
}

/** Each spelling of 1 to 999 a final part may take, with its value. */
const BELOW_THOUSAND: ReadonlyMap<string, number> = new Map(
  Array.from({ length: 999 }, (_, i) => i + 1).flatMap((n) => belowThousand(n).map((spelling) => [spelling, n] as const)),
);

/** Each spelling of 2 to 999 that multiplies `mila`, with its value: `ventun` beside `ventuno`. */
const MULTIPLIERS: ReadonlyMap<string, number> = new Map(
  [...BELOW_THOUSAND].flatMap(([spelling, n]) => {
    if (n < 2) return [];
    return spelling.endsWith("uno") ? [[spelling, n] as const, [spelling.slice(0, -1), n] as const] : [[spelling, n] as const];
  }),
);

const cardinal = (value: number): ItalianCardinal => ({ rule: CARDINAL_RULE, value: value as CardinalValue });

/** The value of what follows a thousands part: nothing, or 1 to 999. */
function restOf(spelling: string): number | undefined {
  return spelling === "" ? 0 : BELOW_THOUSAND.get(spelling);
}

/**
 * The cardinal a lookup key spells, or none: `duemilauno` → 2001,
 * `centoventitré` → 123, `millenovecentottanta` → 1980, `zero` → 0;
 * `centocento`, `unmilione`, `ventiuno`, `tré` and `due mila` → none.
 * The key is the normalized query (`normalizeItalianExact`): lower case, NFC.
 */
export function parseItalianCardinal(key: string): ItalianCardinal | undefined {
  if (key === "zero") return cardinal(0);
  // A compound's final `tre` may carry its accent; `tre` alone carries none.
  if (key === "tré") return undefined;
  const spelling = key.endsWith("tré") ? `${key.slice(0, -1)}e` : key;
  const below = BELOW_THOUSAND.get(spelling);
  if (below !== undefined) return cardinal(below);
  if (spelling.startsWith("mille")) {
    const rest = restOf(spelling.slice("mille".length));
    return rest === undefined ? undefined : cardinal(1000 + rest);
  }
  // No spelling below a thousand holds `mila`, so the first one ends the multiplier.
  const at = spelling.indexOf("mila");
  if (at <= 0) return undefined;
  const thousands = MULTIPLIERS.get(spelling.slice(0, at));
  const rest = restOf(spelling.slice(at + "mila".length));
  return thousands === undefined || rest === undefined ? undefined : cardinal(thousands * 1000 + rest);
}

/**
 * The fixed Lexema definition of a cardinal the rule read, the reading's one
 * definition: "numero cardinale corrispondente a 2001". The value is written
 * in digits with no separator, as the ruling writes it.
 */
export const cardinalDefinition = (read: ItalianCardinal): string => `numero cardinale corrispondente a ${read.value}`;

/** The part of speech a rule-built cardinal reads as, as the source files its own numerals (`cinquantanove`). */
export const CARDINAL_POS = { pos: "adj", posTitle: "Aggettivo numerale" } as const;
