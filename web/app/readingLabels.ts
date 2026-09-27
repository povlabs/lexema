// Which readings a label the source writes names: the bracket that opens an
// etymology — `(sostantivo plurale) vedi sala` — or a part-of-speech label on
// a synonym that opens a group — `sostantivo` on `esistenza`.
//
// A label names readings by their `pos_title`, compared without case or extra
// space. A whole label that is a `pos_title` with a comma in it
// (`(sostantivo, forma flessa)`) names that reading before any comma is read as
// joining two parts. A compound label (`aggettivo, sostantivo`, `aggettivo e sostantivo`)
// names every reading of either part. A qualifier narrows a part to the
// readings whose record states it: `sostantivo plurale` is the Sostantivo
// reading tagged plural, `verbo transitivo` the Verbo reading tagged
// transitive. Anything after a colon is a note on the sense and is ignored
// (`sostantivo: matematica`). A label that names no reading on the page — a
// topic such as `(sport)`, or a part of speech the page does not have — names
// none, and the caller leaves its text where it was. So does an ambiguous one:
// a part that fits more than one reading (`svolta` has two Voce verbale
// readings, so `(voce verbale)` could be either) is not given to both.

import type { GrammarClaim, Reading } from "@lexema/lookup/types.ts";

/** The parts of speech a label can name, in the singular the source mostly uses. */
const HEADS = [
  "sostantivo",
  "aggettivo",
  "verbo",
  "voce verbale",
  "avverbio",
  "pronome",
  "preposizione",
  "congiunzione",
  "interiezione",
  "articolo",
  "nome proprio",
  "locuzione",
] as const;

/** Spellings the source uses for the same heads. */
const HEAD_SPELLINGS: Readonly<Record<string, string>> = {
  sostantivi: "sostantivo",
  aggettivi: "aggettivo",
  "voci verbali": "voce verbale",
  "forma verbale": "voce verbale",
};

/** A qualifier after a head, and the record claim it narrows by. */
const QUALIFIERS: Readonly<Record<string, { dimension: string; value: string }>> = {
  singolare: { dimension: "number", value: "singular" },
  plurale: { dimension: "number", value: "plural" },
  transitivo: { dimension: "transitivity", value: "transitive" },
  intransitivo: { dimension: "transitivity", value: "intransitive" },
};

const normal = (text: string): string => text.toLocaleLowerCase("it-IT").replace(/\s+/g, " ").trim();

interface LabelPart {
  head: string;
  qualifier?: { dimension: string; value: string };
}

/** One part of a label, read as a head and an optional qualifier; undefined when it names no part of speech. */
function partOf(text: string): LabelPart | undefined {
  const words = normal(text);
  const spelled = HEAD_SPELLINGS[words] ?? words;
  const head = HEADS.find((candidate) => spelled === candidate || spelled.startsWith(`${candidate} `));
  if (head === undefined) return undefined;
  const rest = spelled.slice(head.length).trim();
  if (rest === "") return { head };
  const qualifier = QUALIFIERS[rest];
  return qualifier === undefined ? undefined : { head, qualifier };
}

/** The parts of speech a label names; empty when it is a topic or unreadable. */
export function labelParts(label: string): LabelPart[] {
  const beforeNote = label.split(":")[0];
  const parts = beforeNote.split(/,| e /).map(partOf);
  return parts.every((part) => part !== undefined) ? parts.filter((part) => part !== undefined) : [];
}

/**
 * Whether a reading's `pos_title` is a head or begins with it: `Sostantivo`
 * and `Sostantivo, forma flessa` for `sostantivo`, `Aggettivo numerale` for
 * `aggettivo`.
 */
function headedBy(reading: Reading, head: string): boolean {
  const title = normal(reading.posTitle);
  return title === head || title.startsWith(`${head},`) || title.startsWith(`${head} `);
}

function states(claims: readonly GrammarClaim[], dimension: string, value: string): boolean {
  return claims.some((claim) => claim.status === "stated" && claim.dimension === dimension && claim.value === value);
}

/**
 * The one reading a label part names, or undefined when it names none or
 * several. It looks among the readings whose `pos_title` is the head or begins
 * with it (`Sostantivo`, `Sostantivo, forma flessa`), so a bare `(sostantivo)`
 * on a page with both fits two and names neither (`sette`). A qualifier keeps
 * only the readings that state it (`sostantivo plurale` → the plural one).
 */
function readingOf({ head, qualifier }: LabelPart, readings: readonly Reading[]): Reading | undefined {
  const headed = readings.filter((reading) => headedBy(reading, head));
  const fits = headed.filter(
    (reading) => qualifier === undefined || states(reading.grammar.record, qualifier.dimension, qualifier.value),
  );
  return fits.length === 1 ? fits[0] : undefined;
}

/**
 * The readings a label names: one per part, or none at all when any part is
 * ambiguous. A part that names nothing on the page (`aggettivo, sostantivo`
 * on a word with no adjective reading) is skipped.
 */
export function readingsNamed(label: string, readings: readonly Reading[]): Reading[] {
  // A complete source label can itself be the record's pos_title (including
  // commas), so resolve that before interpreting commas as compound labels.
  const complete = normal(label.split(":")[0]);
  const exact = readings.filter((reading) => normal(reading.posTitle) === complete);
  if (complete.includes(",") && exact.length > 0) return exact.length === 1 ? exact : [];

  const named = new Set<Reading>();
  for (const part of labelParts(label)) {
    const candidates = readings.filter((reading) => headedBy(reading, part.head));
    const reading = readingOf(part, readings);
    if (reading === undefined && candidates.length > 1) return [];
    if (reading !== undefined) named.add(reading);
  }
  return readings.filter((reading) => named.has(reading));
}

/** An etymology's opening bracket label and the text after it; no label when it opens with none. */
export function splitLabel(text: string): { label: string | undefined; rest: string } {
  const match = /^\(([^()]*)\)\s*/.exec(text);
  return match === null ? { label: undefined, rest: text } : { label: match[1], rest: text.slice(match[0].length) };
}
