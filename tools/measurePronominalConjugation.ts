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
// Each `none` record then gets its outcome under `it-regular-conjugation/v1`
// (#838), under `noneOutcomes`: the class it settles and the evidence, or why it
// declines. A declined record whose verb has a hand-kept table (#844,
// src/italian/handKeptTables.ts) gets that table, as its page does. A record
// whose word has another record with its own table is counted apart, as the
// page draws that table. It reads the `{{It-conj}}` calls pinned in
// src/italian/conjugationTemplateCalls.ts, as the page does.
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

import { CONJUGATION_TEMPLATE_CALLS } from "../src/italian/conjugationTemplateCalls.js";
import { pronominalSpellings, pronominalVerb, PRONOMINAL_CONJUGATION_RULE } from "../src/italian/pronominalConjugation.js";
import { handKeptCells, handKeptTableOf } from "../src/italian/handKeptTables.js";
import { evidenceUrl } from "../src/italian/curatedCorrections.js";
import { REGULAR_CONJUGATION_RULE, regularCells, regularClassOf, type ParadigmCell } from "../src/italian/regularConjugation.js";
import { baseOf, cellOf, fillsCell, namesVerb as namesVerbIn, readVerbs, slotKey, type RawRecord } from "./pronominalArchive.js";

const [archive] = process.argv.slice(2);
if (!archive) throw new Error("usage: tools/measurePronominalConjugation.ts <it-extract.jsonl.gz>");

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

const verbs = await readVerbs(archive);
const namesVerb = (record: RawRecord): boolean => namesVerbIn(verbs, record);

/** A record's glosses as a page reads them: Wikizionario's missing-definition notice is no gloss (#255). */
const MISSING = "definizione mancante; se vuoi, aggiungila tu";
const glossesOf = (record: RawRecord): string[] =>
  (record.senses ?? []).flatMap((sense) => (sense.glosses ?? []).filter((gloss) => gloss.trim() !== MISSING));

/** What `it-regular-conjugation/v1` gives a `none` record, as its page shows it. */
type NoneOutcome =
  | { outcome: "rule-built"; class: string; stem: string; base: string; evidence: string; cells: number; sample: Record<string, string> }
  | { outcome: "hand-kept"; kept: string; base: string; evidence: string[]; cells: number; sample: Record<string, string> }
  | { outcome: "not-a-pronominal-verb"; glosses: string[] }
  | { outcome: "listed-for-huey"; reason: string; evidence?: string }
  | { outcome: "own-table-on-another-record" };
const noneOutcomes: ({ word: string } & NoneOutcome)[] = [];

const SAMPLE = ["presente · first singular", "presente · second singular", "passato prossimo · first plural", "imperativo · second singular", "ausiliare", "gerundio"];

/** The outcome of a `none` record: the page's table, if any, and what it was built from. */
function noneOutcomeOf(record: RawRecord, records: readonly RawRecord[]): NoneOutcome {
  if (records.some(fillsCell)) return { outcome: "own-table-on-another-record" };
  const verb = pronominalVerb(record.word);
  if (verb === undefined) throw new Error(`not pronominal: ${record.word}`);
  const glosses = glossesOf(record);
  const answer = regularClassOf(verb, glosses, CONJUGATION_TEMPLATE_CALLS);
  if (answer.kind === "declined") {
    if (answer.reason === "form-of-another-word") return { outcome: "not-a-pronominal-verb", glosses };
    const kept = handKeptTableOf(record.word);
    if (kept !== undefined) {
      const cells = handKeptCells(kept);
      const { count, sample } = builtOf(verb, cells);
      const what = kept.conjugation.kind === "class" ? `class ${kept.conjugation.conjugationClass} on ${kept.conjugation.stem}` : "cells";
      return { outcome: "hand-kept", kept: what, base: kept.base, evidence: kept.evidence.map((one) => `${evidenceUrl(one)}: ${one.shows}`), cells: count, sample };
    }
    const page = answer.page === undefined ? {} : { evidence: `${answer.page.title}@${answer.page.revisionId}: ${answer.page.call}` };
    return { outcome: "listed-for-huey", reason: answer.reason, ...page };
  }
  const evidence =
    answer.evidence.kind === "template"
      ? `${answer.evidence.page.title}@${answer.evidence.page.revisionId}: ${answer.evidence.page.call}`
      : `ending ${answer.evidence.ending} of ${answer.evidence.base}`;
  const { count, sample } = builtOf(verb, regularCells(answer));
  return { outcome: "rule-built", class: answer.conjugationClass, stem: answer.stem, base: answer.base, evidence, cells: count, sample };
}

/** How many cells the pronominal rule builds on `cells`, and the sample slots of them. */
function builtOf(verb: NonNullable<ReturnType<typeof pronominalVerb>>, cells: readonly ParadigmCell[]): { count: number; sample: Record<string, string> } {
  const built = pronominalSpellings(verb, cells);
  const sample: Record<string, string> = {};
  cells.forEach((cell, i) => {
    const key = slotKey(cell);
    const spelling = built[i];
    if (key === undefined || spelling === undefined || !SAMPLE.includes(key)) return;
    sample[key] = sample[key] === undefined ? spelling : `${sample[key]}, ${spelling}`;
  });
  return { count: built.filter((one) => one !== undefined).length, sample };
}

/** The key a `none` outcome is counted under. */
const outcomeKey = (one: NoneOutcome): string =>
  one.outcome === "listed-for-huey"
    ? `${one.outcome} · ${one.reason}`
    : one.outcome === "rule-built"
      ? `${one.outcome} · ${one.evidence.startsWith("ending") ? "ending" : "template"}`
      : one.outcome;

const counts = { records: 0, words: 0, source: 0, rule: 0, none: 0, formOfAVerb: 0, ruleBaseLinked: 0, ruleBaseOfSeveral: 0 };
const compared: { word: string; base: string; cells: number; same: number; differ: { cell: string; reason: Reason; source: string[]; rule: string[] }[] }[] = [];
const sourceWithoutBase: string[] = [];
const noneWords: string[] = [];
const ruleWords: string[] = [];

for (const [word, records] of [...verbs].sort(([a], [b]) => a.localeCompare(b))) {
  const verb = pronominalVerb(word);
  if (verb === undefined) continue;
  counts.words++;
  const { candidates, linked, base } = baseOf(verbs, verb);
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
      noneOutcomes.push({ word, ...noneOutcomeOf(record, records) });
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
      regularRule: REGULAR_CONJUGATION_RULE,
      noneOutcomeCounts: Object.fromEntries(
        [...noneOutcomes.reduce((n, one) => n.set(outcomeKey(one), (n.get(outcomeKey(one)) ?? 0) + 1), new Map<string, number>())].sort(([a], [b]) =>
          a.localeCompare(b),
        ),
      ),
      noneOutcomes,
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
