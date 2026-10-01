// The page-control gloss the word page refuses to number as a definition, and
// which senses the page numbers because of it.
//
// On the page layout #28 is about, the `#` line holds only the headword, a
// gender/number stamp and the `approfondimento`/`citazioni` links, and the
// extraction keeps that line as the sense's gloss: `casa ( approfondimento) f
// sing`, `casa ( citazioni)`. The word page (web/lib/dictionary/definitions.ts)
// and the quality measurement (src/italian/recordQuality.ts) both call
// `splitSenses` here, so the size the measurement reports is the size of the
// class the page hides.
//
// On a few pages the line goes on to give a definition: `palo ( approfondimento)
// pezza onorevole…` (#325). That is no headword line but a definition the link
// leads, and rule `gloss-headword-lead/v1` (sourceTextNormalization.ts) stores
// its prose alone.

/**
 * A gloss that opens with the headword and its `approfondimento` or
 * `citazioni` link.
 *
 * - `bare` — the headword line: `casa ( citazioni)`, or `casa (
 *   approfondimento)` followed by nothing but gender and number stamps and
 *   punctuation (`f sing`, `:`).
 * - `lead` — the link leads a definition: `palo ( approfondimento) pezza
 *   onorevole…`, whose `prose` is the text after the link.
 */
export type HeadwordLine =
  | { readonly kind: "bare" }
  | { readonly kind: "lead"; readonly prose: string };

/** A gender or number stamp as Wikizionario writes it after the link. */
const STAMP = /^(?:m|f|sing|pl)$/u;

/** `text`, a gloss of `word`'s record, read as a headword line; undefined when it does not open with one. */
export function readHeadwordLine(text: string, word: string): HeadwordLine | undefined {
  if (text === `${word} ( citazioni)`) return { kind: "bare" };
  const link = `${word} ( approfondimento)`;
  if (!text.startsWith(link)) return undefined;
  const rest = text.slice(link.length);
  const stampsOnly = rest.split(/[\s,;:.()]+/u).every((token) => token === "" || STAMP.test(token));
  return stampsOnly ? { kind: "bare" } : { kind: "lead", prose: rest.trimStart() };
}

/** Whether `text`, a gloss of `word`'s record, is the headword line and nothing more. */
export function isFurnitureGloss(text: string, word: string): boolean {
  return readHeadwordLine(text, word)?.kind === "bare";
}

/**
 * A sense as the page reads it: its gloss texts with the "definizione
 * mancante" placeholder already taken out (#255), and whether a list of
 * recovered items hangs under it (#28). Nothing else about the sense enters
 * the rule — a `form_of` pointer included.
 */
export interface SenseShape {
  readonly glosses: readonly string[];
  readonly opensRecoveredList: boolean;
}

/**
 * Whether the page calls a sense furniture: it has a gloss, every gloss is the
 * headword line, and no recovered list hangs under it.
 */
export function isFurnitureSense(sense: SenseShape, word: string): boolean {
  return (
    sense.glosses.length > 0 &&
    !sense.opensRecoveredList &&
    sense.glosses.every((text) => isFurnitureGloss(text, word))
  );
}

/** How the page splits a reading's senses. */
export interface SenseSplit<S> {
  /** The senses numbered as definitions, in order. */
  numbered: S[];
  /** The senses not numbered: glossless ones, and furniture when hidden. Their examples stay reachable. */
  setAside: S[];
  /** Every furniture sense, numbered or not. */
  furniture: S[];
  /** Whether the furniture is hidden: the reading has something else to show. */
  furnitureHidden: boolean;
}

/**
 * The page's one rule for which senses it numbers. A sense with no gloss and
 * no recovered list is never numbered. Furniture is left out only when the
 * reading has anything else — a recovered definition, or any sense that is not
 * furniture, a glossless one included; a reading with nothing else shows it
 * verbatim rather than nothing.
 */
export function splitSenses<S>(
  senses: readonly S[],
  word: string,
  recovered: number,
  shapeOf: (sense: S, index: number) => SenseShape,
): SenseSplit<S> {
  const read = senses.map((sense, index) => {
    const shape = shapeOf(sense, index);
    return {
      sense,
      furniture: isFurnitureSense(shape, word),
      glossless: shape.glosses.length === 0 && !shape.opensRecoveredList,
    };
  });
  const furnitureHidden = recovered > 0 || read.some(({ furniture }) => !furniture);
  const numbered = (entry: (typeof read)[number]) => !entry.glossless && !(furnitureHidden && entry.furniture);
  return {
    numbered: read.filter(numbered).map(({ sense }) => sense),
    setAside: read.filter((entry) => !numbered(entry)).map(({ sense }) => sense),
    furniture: read.filter(({ furniture }) => furniture).map(({ sense }) => sense),
    furnitureHidden,
  };
}
