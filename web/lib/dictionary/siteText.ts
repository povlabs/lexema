// The dictionary site's own interface words, in Italian (Huey's ruling of
// 2026-10-10 on #791, design-system-manifest.md § "Settled law"): the search
// box, the landing page, the states a search can end in, the footer, the page
// no route matches and the tab's titles. The word page's words are in
// wordPageText.ts, the report box's in report.ts, and the legal pages' text in
// their own components. The developer site keeps its English and is not here.

/**
 * The search box: its accessible name and placeholder, the `×`, and the key
 * hint. The placeholder is "Cerca una parola", not "Cerca una parola
 * italiana": the longer one is cut off in a 390 px field.
 */
export const SEARCH = {
  label: "Cerca una parola",
  clear: "Cancella la ricerca",
  /** The Enter key, as an Italian keyboard names it. */
  enterKey: "INVIO",
} as const;

/** What the suggestion list says, to the eye and to a screen reader. */
export const SUGGESTIONS = {
  failed: "Impossibile caricare i suggerimenti.",
  none: "Nessun suggerimento.",
  count: (count: number): string =>
    `${count} ${count === 1 ? "suggerimento" : "suggerimenti"}. Usa le frecce su e giù per sceglierne uno.`,
  /** Said in the list's place: the search still runs on Enter. */
  stillSearches: "Invio cerca comunque.",
} as const;

/** The landing page's row of words to try. */
export const TRY = { label: "Prova", name: "Prova una parola" } as const;

/** A search's states with no result, each said plainly. */
export const SEARCH_STATE = {
  /** The visually hidden heading, ahead of the query: `Ricerca di casa`. */
  heading: "Ricerca di",
  empty: "Scrivi una parola da cercare.",
  tooLong: (length: number, limit: number): string => `Sono ${length} caratteri. Il limite è ${limit}.`,
  limited: "Troppe ricerche nell’ultimo minuto, quindi questa non è stata eseguita. Riprova tra un minuto.",
  /** Around the query: `La ricerca non è riuscita, quindi questa pagina non può dire se «casa» è nel dizionario.` */
  failedLead: "La ricerca non è riuscita, quindi questa pagina non può dire se",
  failedTail: "è nel dizionario. Riprova tra un momento.",
} as const;

/** The footer's links, and the name a screen reader gives their list. */
export const FOOTER = {
  name: "Sito",
  licence: "Licenza",
  privacy: "Privacy",
  contact: "Contatti",
  developers: "API",
} as const;

/** An address no page answers. */
export const PAGE_NOT_FOUND = "Pagina non trovata";

/** The legal pages' titles, on the page and in the tab. */
export const LEGAL_TITLE = { licence: "Licenza", privacy: "Privacy" } as const;
