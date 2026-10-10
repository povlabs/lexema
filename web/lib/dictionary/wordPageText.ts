// The word page's own interface words, in Italian (Huey's ruling of
// 2026-10-09 on #789, design-system-manifest.md § "Settled law"). The page's
// section labels, controls and accessible names read from here, so one file
// holds them and a test can tell an English one apart. The report box's words
// are in report.ts beside the choices they name.
//
// The rest of the site's words, Italian too since #791, are in siteText.ts;
// the developer site keeps its English.

/** The small grey label over each block of a result. */
export const SECTION_LABEL = {
  definitions: "Definizioni",
  examples: "Esempi",
  forms: "Forme",
  expressions: "Espressioni",
  synonyms: "Sinonimi",
  antonyms: "Contrari",
  derived: "Parole derivate",
  etymology: "Etimologia",
} as const;

/** *Forme di andare*: a form's base word's table, and a grid's accessible name. */
export const formsOf = (word: string): string => `Forme di ${word}`;

/** The two words before the base word in `formsOf`, for a label that styles the word apart. */
export const FORMS_OF_LEAD = "Forme di";

/** A conjugation's mood tabs, as a screen reader names them. */
export const moodsOf = (word: string): string => `Modi di ${word}`;

/** The one expand control: closed, then open. */
export const MORE = { closed: "+ altro", open: "meno" } as const;

/** A line naming a base word no definition writes: `Forma di bello.` */
export const FORM_OF_LEAD = "Forma di";

/** The jump links under the headword, as a screen reader names the list. */
export const READINGS_NAV = "Sezioni";

/** The IPA under the headword, as a screen reader names it. */
export const PRONUNCIATION_LABEL = "Pronuncia";

/** The one *Source* link, and its accessible name. */
export const SOURCE_LABEL = "Fonte";
export const sourceLinkName = (word: string): string =>
  `Pagina di Wikizionario per ${word}, la fonte di questa pagina (si apre in una nuova scheda)`;

/** An expressions list's filter, past thirty rows. */
export const FIND_EXPRESSION = "Cerca un’espressione";

/** The line offering a written variant of what was searched: `Forse cercavi città?`. */
export const DID_YOU_MEAN = "Forse cercavi";

/** A search that found nothing (board 24). */
export const NOT_FOUND = {
  heading: "Nessuna voce per",
  prefixLead: "Lexema non ha nessuna parola scritta così. Parole che iniziano con",
  suggestions: "Suggerimenti",
  accentOthers: (query: string): string => `Altre parole che iniziano con “${query}”`,
  typoOthers: "Altre grafie simili",
  phraseOthers: "Altre espressioni",
  nothingClose:
    "Lexema non ha nessuna parola scritta così. Controlla l’ortografia, oppure cerca la forma base della parola: l’infinito di un verbo, il singolare di un nome.",
} as const;
