// The determiner adjectives Italian puts no article before (#836).
//
// A demonstrative or a quantifier stands in the article's place before its
// noun: `quel libro`, `nessun libro`, `ogni giorno`, never `il quel libro`.
// So a table of such an adjective's forms takes no article line, where every
// other adjective's does (`il bello · un bello`). Huey ruled on 2026-10-17
// (https://github.com/povlabs/lexema/issues/836#issuecomment-6237109728) that
// the words are a closed list, not the source's `Aggettivo dimostrativo`
// label: `siffatto` carries that label and takes an article (`un siffatto
// uomo`), and the possessives take one too (`il mio libro`). `qualunque` and
// `qualsiasi` are not on it either, since `un qualunque giorno` is Italian.

/** The determiner adjectives, by headword, whose forms take no article. */
export const ARTICLELESS_DETERMINERS: ReadonlySet<string> = new Set([
  // demonstratives
  "quello",
  "questo",
  "codesto",
  "cotesto",
  // quantifiers
  "nessuno",
  "alcuno",
  "ciascuno",
  "veruno",
  "ogni",
  "qualche",
]);

/** Whether an adjective headed `word` stands where an article would, so its forms take none. */
export const isArticlelessDeterminer = (word: string): boolean => ARTICLELESS_DETERMINERS.has(word);
