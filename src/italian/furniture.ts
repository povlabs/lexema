// The page-control gloss the word page refuses to number as a definition.
//
// On the page layout #28 is about, the `#` line holds only the headword, a
// gender/number stamp and the `approfondimento`/`citazioni` links, and the
// extraction keeps that line as the sense's gloss: `casa ( approfondimento) f
// sing`, `casa ( citazioni)`. The word page (web/lib/dictionary/definitions.ts)
// and the quality measurement (src/import/measureQuality.ts) read the one rule
// here, so the size the measurement reports is the size of the class the page
// hides.

/** Whether `text`, a gloss of `word`'s record, is that headword line. */
export function isFurnitureGloss(text: string, word: string): boolean {
  return text === `${word} ( citazioni)` || text.startsWith(`${word} ( approfondimento)`);
}
