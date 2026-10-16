// The fixed table that gives a Wikidata word its part of speech (ADR 0033,
// #812): each Wikidata lexical category an Italian lexeme states, mapped onto
// the closed set of section titles a Wiktionary record has
// (`POS_BY_TITLE`, src/italian/partOfSpeech.ts). A lexeme whose category is
// not here is not kept, so a proverb, a saying or a bare numeral never becomes
// a Wikidata word. Each category's Italian label is Wikidata's own, read on
// 2026-10-11 off https://www.wikidata.org/w/api.php?action=wbgetentities.

import { statedPartOfSpeech, type PosTitle, type StatedPartOfSpeech } from "../italian/partOfSpeech.js";

/** Every lexical category Lexema keeps, and the section title it reads as. */
export const POS_TITLE_BY_CATEGORY = {
  Q1084: "Sostantivo", // sostantivo
  Q66364639: "Sostantivo", // nome invariabile
  Q147276: "Nome proprio", // nome proprio
  Q34698: "Aggettivo", // aggettivo
  Q3618903: "Aggettivo", // aggettivo indefinito
  Q2824480: "Aggettivo dimostrativo", // aggettivo dimostrativo
  Q5051: "Aggettivo possessivo", // aggettivo possessivo
  Q55951821: "Aggettivo numerale", // aggettivo numerale
  Q24905: "Verbo", // verbo
  Q380057: "Avverbio", // avverbio
  Q83034: "Interiezione", // interiezione
  Q36484: "Congiunzione", // congiunzione
  Q4833830: "Preposizione", // preposizione
  Q36224: "Pronome", // pronome
  Q956030: "Pronome", // pronome indefinito
  Q468801: "Pronome", // pronome personale
  Q1989081: "Pronome", // reflexive personal pronoun
  Q54310231: "Pronome", // pronome interrogativo
  Q34793275: "Pronome", // pronome dimostrativo
  Q1050744: "Pronome", // pronome relativo
  Q2865743: "Articolo", // articolo determinativo
  Q3813849: "Articolo", // articolo indeterminativo
  Q576670: "Articolo", // articolo partitivo
  Q134830: "Prefisso", // prefisso
  Q102047: "Suffisso", // suffisso
  Q66614509: "Suffisso", // suffisso nominale
  Q3976700: "Suffisso", // suffisso aggettivale
  Q106610283: "Suffisso", // suffisso avverbiale
  Q9788: "Lettera", // lettera
  Q187931: "Espressione", // frase
  Q29888377: "Locuzione nominale", // locuzione nominale
  Q10976085: "Locuzione verbale", // locuzione verbale
  Q12734432: "Locuzione aggettivale", // locuzione aggettivale
  Q5978305: "Locuzione congiuntiva", // locuzione congiuntiva
  Q10319520: "Locuzione interiettiva", // locuzione interiettive
  Q5978303: "Locuzione avverbiale", // locuzione avverbiale
} as const satisfies Record<`Q${number}`, PosTitle>;

/** A lexical category the table maps. */
export type LexicalCategory = keyof typeof POS_TITLE_BY_CATEGORY;

export const isLexicalCategory = (category: string): category is LexicalCategory => Object.hasOwn(POS_TITLE_BY_CATEGORY, category);

/** The part of speech, title and code together, that a lexeme of `category` reads as. */
export const partOfSpeechOf = (category: LexicalCategory): StatedPartOfSpeech => statedPartOfSpeech(POS_TITLE_BY_CATEGORY[category]);
