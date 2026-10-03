// The Italian part-of-speech titles a page section can state, and the part of
// speech each one is.
//
// Each code is the one Wiktextract gives records with that `pos_title` in
// release it-0c432803, read off every Italian archive line on 2026-10-03: no
// title maps to two codes. A page-only entry (ADR 0028) takes the same pair, so
// it reads like an archive record of the same section.

/** Every title `POS_TITLE_BY_TEMPLATE` gives, and its part of speech. */
export const POS_BY_TITLE = {
  Sostantivo: "noun",
  "Sostantivo, forma flessa": "noun",
  Aggettivo: "adj",
  "Aggettivo, forma flessa": "adj",
  "Aggettivo numerale": "adj",
  "Aggettivo numerale, forma flessa": "adj",
  "Aggettivo possessivo": "adj",
  "Aggettivo dimostrativo": "adj",
  Verbo: "verb",
  "Voce verbale": "verb",
  "Nome proprio": "name",
  "Nome proprio, forma flessa": "name",
  Avverbio: "adv",
  "Acronimo / Abbreviazione": "abbrev",
  "Abbreviazione in uso nelle chat": "abbrev",
  Interiezione: "intj",
  Congiunzione: "conj",
  Preposizione: "prep",
  Pronome: "pron",
  "Pronome, forma flessa": "pron",
  "Pronome possessivo": "pron",
  Articolo: "article",
  Prefisso: "prefix",
  Prefissoide: "prefix",
  Suffisso: "suffix",
  Confisso: "affix",
  Lettera: "character",
  "Codice / Simbolo": "symbol",
  Cifra: "num",
  Particella: "particle",
  Espressione: "phrase",
  "Locuzione nominale": "phrase",
  "Locuzione nominale, forma flessa": "phrase",
  "Locuzione verbale": "phrase",
  "Locuzione aggettivale": "phrase",
  "Locuzione congiuntiva": "phrase",
  "Locuzione interiettiva": "phrase",
  "Locuzione avverbiale": "adv_phrase",
  "Locuzione prepositiva": "prep_phrase",
} as const;

/** A part-of-speech title a section can state: `Sostantivo`, `Voce verbale`. */
export type PosTitle = keyof typeof POS_BY_TITLE;

/** A title and its part of speech, as one value: a mismatched pair cannot be written. */
export type StatedPartOfSpeech = { [T in PosTitle]: { posTitle: T; pos: (typeof POS_BY_TITLE)[T] } }[PosTitle];

export function statedPartOfSpeech(posTitle: PosTitle): StatedPartOfSpeech {
  return { posTitle, pos: POS_BY_TITLE[posTitle] } as StatedPartOfSpeech;
}
