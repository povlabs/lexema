// The archive reads the pronominal-verb tools share (#837, #838): every
// Italian verb record by word, and which of them a pronominal verb's table can
// be built from, picked as the page picks it (`pronominalBaseOf`,
// web/lib/dictionary/wordPage.ts).

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { personOfItalianVerbForm, placeItalianVerbForm, type VerbFormTags } from "../src/italian/moods.js";
import type { BaseCell, PronominalVerb } from "../src/italian/pronominalConjugation.js";

export interface RawForm {
  form: string;
  tags?: string[];
  raw_tags?: string[];
}

export interface RawRecord {
  word: string;
  lang_code?: string;
  pos?: string;
  forms?: RawForm[];
  senses?: { glosses?: string[]; form_of?: { word: string }[] }[];
}

export const cellOf = (form: RawForm): BaseCell => ({ spelling: form.form, tags: form.tags ?? [], rawTags: form.raw_tags ?? [] });

/** The cell a form fills, as the page's grid keys it, or undefined when it fills none (web/lib/dictionary/conjugation.ts `placeOf`). */
export function slotKey(tags: VerbFormTags): string | undefined {
  const slot = placeItalianVerbForm(tags);
  if (slot.kind === "auxiliary") return "ausiliare";
  if (slot.kind === "non-finite") return slot.role === "participio passato" ? "participio" : slot.role;
  if (slot.kind !== "tense" && slot.kind !== "imperative") return undefined;
  const row = personOfItalianVerbForm(tags);
  if (row === undefined) return undefined;
  return `${slot.kind === "imperative" ? "imperativo" : slot.box} · ${row.person} ${row.number}`;
}

export const fillsCell = (record: RawRecord): boolean => (record.forms ?? []).some((form) => slotKey(cellOf(form)) !== undefined);

/** Every Italian verb record of the archive, by word, in archive order. */
export async function readVerbs(archive: string): Promise<Map<string, RawRecord[]>> {
  const verbs = new Map<string, RawRecord[]>();
  const lines = createInterface({ input: createReadStream(archive).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.includes('"pos": "verb"')) continue;
    const record = JSON.parse(line) as RawRecord;
    if (record.lang_code !== "it" || record.pos !== "verb") continue;
    verbs.set(record.word, [...(verbs.get(record.word) ?? []), record]);
  }
  return verbs;
}

/** Whether some `form_of` edge of a record names a verb record. */
export const namesVerb = (verbs: ReadonlyMap<string, RawRecord[]>, record: RawRecord): boolean =>
  (record.senses ?? []).some((sense) => (sense.form_of ?? []).some((edge) => (verbs.get(edge.word) ?? []).length > 0));

/** The base verb records a pronominal verb's table may be built from, and the one the page takes. */
export function baseOf(verbs: ReadonlyMap<string, RawRecord[]>, verb: PronominalVerb): { candidates: RawRecord[]; linked: RawRecord | undefined; base: RawRecord | undefined } {
  const candidates = verb.bases.flatMap((base) => (verbs.get(base) ?? []).filter((record) => !namesVerb(verbs, record) && fillsCell(record)));
  const linked = candidates.find((record) => (record.forms ?? []).some((form) => form.form === `${verb.word} (coniugazione)`));
  return { candidates, linked, base: linked ?? candidates[0] };
}
