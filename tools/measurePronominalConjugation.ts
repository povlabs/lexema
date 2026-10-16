// How rule `it-pronominal-conjugation/v1` (#837) reaches the pronominal verbs
// of a release, and how it compares with the tables the source gives.
//
//   pnpm exec tsx tools/measurePronominalConjugation.ts <it-extract.jsonl.gz> > result.json
//
// It reads every Italian verb record of the archive, and for each record whose
// word `pronominalVerb` reads (`-rsi`, `-rsene`) it says which of three it is:
//
// - `source`: its own forms fill a cell, so its page shows them as it did;
// - `rule`: none do, and a base verb record has a table, so the rule builds one;
// - `none`: none do, and no base verb record has a table (`pentirsi`).
//
// A base verb record is picked as the page picks it (`pronominalBaseOf`,
// web/lib/dictionary/wordPage.ts): a verb record, about the base word, whose
// forms fill a cell, the one listing `<word> (coniugazione)` first, else the
// first in the order `pronominalVerb` tries the words. A record that is
// another verb's form (a `form_of` edge naming a verb record) is counted
// apart, as the page gives it no table.
//
// Then, for each `source` record whose base verb has a table, it runs the rule
// on the base's forms and compares the two tables cell by cell: each cell is
// the set of spellings the source files under one slot (non-finite role,
// auxiliary, tense and row, imperative row). Every cell that differs is
// listed, with both sides. It changes nothing.

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { personOfItalianVerbForm, placeItalianVerbForm, type VerbFormTags } from "../src/italian/moods.js";
import { pronominalSpellings, pronominalVerb, PRONOMINAL_CONJUGATION_RULE, type BaseCell } from "../src/italian/pronominalConjugation.js";

interface RawForm {
  form: string;
  tags?: string[];
  raw_tags?: string[];
}

interface RawRecord {
  word: string;
  lang_code?: string;
  pos?: string;
  forms?: RawForm[];
  senses?: { form_of?: { word: string }[] }[];
}

const [archive] = process.argv.slice(2);
if (!archive) throw new Error("usage: tools/measurePronominalConjugation.ts <it-extract.jsonl.gz>");

const cellOf = (form: RawForm): BaseCell => ({ spelling: form.form, tags: form.tags ?? [], rawTags: form.raw_tags ?? [] });

/** The cell a form fills, as the page's grid keys it, or undefined when it fills none (web/lib/dictionary/conjugation.ts `placeOf`). */
function slotKey(tags: VerbFormTags): string | undefined {
  const slot = placeItalianVerbForm(tags);
  if (slot.kind === "auxiliary") return "ausiliare";
  if (slot.kind === "non-finite") return slot.role === "participio passato" ? "participio" : slot.role;
  if (slot.kind !== "tense" && slot.kind !== "imperative") return undefined;
  const row = personOfItalianVerbForm(tags);
  if (row === undefined) return undefined;
  return `${slot.kind === "imperative" ? "imperativo" : slot.box} · ${row.person} ${row.number}`;
}

const fillsCell = (record: RawRecord): boolean => (record.forms ?? []).some((form) => slotKey(cellOf(form)) !== undefined);

/** Every cell of a table, its spellings in source order: the comma-joined spellings of one form are each a spelling. */
function tableOf(cells: readonly { spelling: string; key: string | undefined }[]): Map<string, string[]> {
  const table = new Map<string, string[]>();
  for (const { spelling, key } of cells) {
    if (key === undefined) continue;
    const spellings = table.get(key) ?? [];
    for (const one of spelling.split(", ")) if (!spellings.includes(one)) spellings.push(one);
    table.set(key, spellings);
  }
  return table;
}

/**
 * Why a cell differs, the first that holds, in this order:
 *
 * - `base-has-no-cell`: the base verb's table has nothing there (`amarsi`'s
 *   `ausiliare`: amare's record lists none).
 * - `source-has-no-cell`: the pronominal record's table has nothing there.
 * - `source-builds-on-avere`: the source's pronominal table builds its
 *   compound tenses on avere (`mi ho abbagliato`), or names avere its
 *   auxiliary; the rule builds every one on essere.
 * - `source-adds-participle`: the source cell is the rule's plus a bare
 *   participle with the pronoun on (`mi sono arreso, arresosi`;
 *   `participio arresosi, arresosisi`), which the extraction carries over from
 *   the template's participle line.
 * - `source-pronoun-on-first-only`: the source writes the pronoun before a
 *   cell's first spelling only (`mi siedo, seggo`), the rule before each
 *   (`mi siedo, mi seggo`).
 * - `source-imperative-without-pronoun`: the source's pronominal table lists
 *   an imperative with no pronoun (`commuovi`, `siedi`), where the rule
 *   attaches one (`commuoviti`, `siediti`).
 * - `base-lists-other-spellings`: any other cell, where the base verb's own
 *   table and the source's pronominal table spell the verb differently
 *   (`affaccerò`, `affaccierò`) or list other spellings (`abbattei` alone, and
 *   `abbattetti, abbattei`).
 */
type Reason =
  | "base-has-no-cell"
  | "source-has-no-cell"
  | "source-builds-on-avere"
  | "source-adds-participle"
  | "source-pronoun-on-first-only"
  | "source-imperative-without-pronoun"
  | "base-lists-other-spellings";

const AVERE = /^(?:\p{L}+ )?(?:ho|hai|ha|abbiamo|avete|hanno|avevo|avevi|aveva|avevamo|avevate|avevano|ebbi|avesti|ebbe|avemmo|aveste|ebbero|avrò|avrai|avrà|avremo|avrete|avranno|abbia|abbiate|abbiano|avessi|avesse|avessimo|avessero|avrei|avresti|avrebbe|avremmo|avreste|avrebbero) /u;

function reasonOf(cell: string, source: readonly string[], rule: readonly string[]): Reason {
  if (rule.length === 0) return "base-has-no-cell";
  if (source.length === 0) return "source-has-no-cell";
  if (source.some((one) => AVERE.test(one)) || (cell === "ausiliare" && source.includes("avere"))) return "source-builds-on-avere";
  const extra = source.filter((one) => !rule.includes(one));
  if (rule.every((one) => source.includes(one)) && extra.every((one) => /^\p{L}+si$/u.test(one))) return "source-adds-participle";
  const [first, ...later] = source;
  const pronoun = first.includes(" ") ? first.slice(0, first.lastIndexOf(" ") + 1) : "";
  const pronouned = [first, ...later.map((one) => (one.includes(" ") ? one : `${pronoun}${one}`))];
  if (later.length > 0 && pronouned.length === rule.length && pronouned.every((one) => rule.includes(one))) return "source-pronoun-on-first-only";
  if (cell.startsWith("imperativo") && source.some((one) => !one.includes(" ") && !/(?:ti|ci|vi|si|ne)$/u.test(one))) return "source-imperative-without-pronoun";
  return "base-lists-other-spellings";
}

const verbs = new Map<string, RawRecord[]>();
const lines = createInterface({ input: createReadStream(archive).pipe(createGunzip()), crlfDelay: Infinity });
for await (const line of lines) {
  if (!line.includes('"pos": "verb"')) continue;
  const record = JSON.parse(line) as RawRecord;
  if (record.lang_code !== "it" || record.pos !== "verb") continue;
  verbs.set(record.word, [...(verbs.get(record.word) ?? []), record]);
}

const namesVerb = (record: RawRecord): boolean =>
  (record.senses ?? []).some((sense) => (sense.form_of ?? []).some((edge) => (verbs.get(edge.word) ?? []).length > 0));

const counts = { records: 0, words: 0, source: 0, rule: 0, none: 0, formOfAVerb: 0, ruleBaseLinked: 0, ruleBaseOfSeveral: 0 };
const compared: { word: string; base: string; cells: number; same: number; differ: { cell: string; reason: Reason; source: string[]; rule: string[] }[] }[] = [];
const sourceWithoutBase: string[] = [];
const noneWords: string[] = [];
const ruleWords: string[] = [];

for (const [word, records] of [...verbs].sort(([a], [b]) => a.localeCompare(b))) {
  const verb = pronominalVerb(word);
  if (verb === undefined) continue;
  counts.words++;
  const candidates = verb.bases.flatMap((base) => (verbs.get(base) ?? []).filter((record) => !namesVerb(record) && fillsCell(record)));
  const linked = candidates.find((record) => (record.forms ?? []).some((form) => form.form === `${word} (coniugazione)`));
  const base = linked ?? candidates[0];
  for (const record of records) {
    counts.records++;
    if (fillsCell(record)) {
      counts.source++;
      if (base === undefined) {
        sourceWithoutBase.push(word);
        continue;
      }
      const baseForms = base.forms ?? [];
      const built = pronominalSpellings(verb, baseForms.map(cellOf));
      const rule = tableOf(baseForms.flatMap((form, i) => (built[i] === undefined ? [] : [{ spelling: built[i] as string, key: slotKey(cellOf(form)) }])));
      const source = tableOf((record.forms ?? []).map((form) => ({ spelling: form.form, key: slotKey(cellOf(form)) })));
      const keys = [...new Set([...source.keys(), ...rule.keys()])];
      const differ = keys.flatMap((cell) => {
        const a = source.get(cell) ?? [];
        const b = rule.get(cell) ?? [];
        const same = a.length === b.length && a.every((one) => b.includes(one));
        return same ? [] : [{ cell, reason: reasonOf(cell, a, b), source: a, rule: b }];
      });
      compared.push({ word, base: base.word, cells: keys.length, same: keys.length - differ.length, differ });
    } else if (namesVerb(record)) {
      counts.formOfAVerb++;
    } else if (base === undefined) {
      counts.none++;
      noneWords.push(word);
    } else {
      counts.rule++;
      if (!ruleWords.includes(word)) ruleWords.push(word);
      if (linked !== undefined) counts.ruleBaseLinked++;
      if (candidates.length > 1) counts.ruleBaseOfSeveral++;
    }
  }
}

console.log(
  JSON.stringify(
    {
      rule: PRONOMINAL_CONJUGATION_RULE,
      counts,
      sourceWithoutBase,
      noneWords,
      ruleWords,
      compared: {
        records: compared.length,
        cells: compared.reduce((n, one) => n + one.cells, 0),
        same: compared.reduce((n, one) => n + one.same, 0),
        identicalTables: compared.filter((one) => one.differ.length === 0).map((one) => one.word),
        byReason: Object.fromEntries(
          [...compared.flatMap((one) => one.differ.map((cell) => cell.reason)).reduce((n, reason) => n.set(reason, (n.get(reason) ?? 0) + 1), new Map<Reason, number>())].sort(
            ([, a], [, b]) => b - a,
          ),
        ),
        tables: compared.filter((one) => one.differ.length > 0),
      },
    },
    null,
    2,
  ),
);
