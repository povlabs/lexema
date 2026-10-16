// Reads an en.wiktionary conjugation table, as `action=expandtemplates`
// expands a page's `{{it-conj}}` call, into its cells (#844).
//
// The table writes each spelling as links, `[[:mi#Italian|mi]]
// [[:impadronisco#Italian|impadronìsco]]`: the link target is the plain
// spelling, the text adds the stress mark. A cell's spellings are the targets
// of each comma-separated part, joined by one space: `mi impadronisco`. Two
// parts that differ only by their stress mark (`impadronirèbbe`,
// `impadronirébbe`) are one spelling.

/** The table's slots this reader returns, by the `title` the table gives each header. */
export type EnWiktionarySlot =
  | "verbo ausiliare"
  | "gerundio"
  | "participio presente"
  | "participio passato"
  | "presente"
  | "imperfetto"
  | "passato remoto"
  | "futuro semplice"
  | "condizionale presente"
  | "congiuntivo presente"
  | "congiuntivo imperfetto"
  | "imperativo"
  | "imperativo negativo";

const NON_FINITE: readonly EnWiktionarySlot[] = ["verbo ausiliare", "gerundio", "participio presente", "participio passato"];
const FINITE: readonly EnWiktionarySlot[] = [
  "presente",
  "imperfetto",
  "passato remoto",
  "futuro semplice",
  "condizionale presente",
  "congiuntivo presente",
  "congiuntivo imperfetto",
  "imperativo",
  "imperativo negativo",
];

/** Each slot's cells: one for a non-finite slot, six (io … loro) for a finite one, each the cell's spellings. */
export type EnWiktionaryTable = ReadonlyMap<EnWiktionarySlot, readonly (readonly string[])[]>;

const LINK = /\[\[:([^#\]|]+)#Italian\|[^\]]*\]\]/gu;

/** A cell's spellings: each comma-separated part's link targets, joined by a space; none for an empty cell. */
function spellingsOf(cell: string): string[] {
  const text = cell.replace(/\[\[Category:[^\]]*\]\]/gu, "").replace(/<[^>]*>/gu, "");
  const spellings = text
    .split(/,\s*(?=\[\[)/u)
    .map((part) => [...part.matchAll(LINK)].map((link) => link[1]).join(" "))
    .filter((one) => one !== "");
  return [...new Set(spellings)];
}

/** The table in `expanded`, the wikitext `{{it-conj}}` expands to. */
export function readEnWiktionaryTable(expanded: string): EnWiktionaryTable {
  const table = new Map<EnWiktionarySlot, string[][]>();
  const lines = expanded.split("\n");
  let slot: EnWiktionarySlot | undefined;
  let cells: string[][] = [];
  const close = () => {
    if (slot !== undefined) table.set(slot, cells);
    slot = undefined;
    cells = [];
  };
  for (const line of lines) {
    if (line.startsWith("!")) {
      const title = /<span title="([^"]+)">/u.exec(line)?.[1];
      // A header line names the next slot; a person header (`! … | io`) carries no title and closes nothing.
      if (title === undefined) continue;
      close();
      if ((NON_FINITE as readonly string[]).includes(title) || (FINITE as readonly string[]).includes(title)) slot = title as EnWiktionarySlot;
      continue;
    }
    if (slot === undefined || !line.startsWith("|") || line.startsWith("|-") || line.startsWith("|}")) continue;
    cells.push(spellingsOf(line.replace(/^\|\s*(?:colspan="\d+"\s*\|)?/u, "")));
  }
  close();
  return table;
}
