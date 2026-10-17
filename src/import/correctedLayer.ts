// Writes the curated corrections (#420, #722, #723, #773, #857, #836) beside the records a seed streams.
//
// Each entry of the committed list (src/italian/curatedCorrections.ts) keyed
// to a record names it by release, archive line and line digest. When the seed
// writes that line with that digest, each fact the entry sets becomes one
// `corrected_claim` row and each cell one `corrected_form` row, naming the
// entry and the revision it cites, and each edge one `corrected_edge` row,
// naming the entry and the two page revisions it cites, and each hidden
// recovered definition one `hidden_recovered_definition` row, naming the entry
// and the page revision it cites, where the record's recovered definition at
// that line is the one it quotes (`hideMismatch`), and each hidden sense one
// `hidden_sense` row, naming the entry and the page revision it cites, and
// each added or removed form of an adjective one `corrected_adjective_form`
// row, naming the entry and the first revision it cites. A
// line whose digest
// differs is another record, and gets none: the list was checked against those
// bytes and no others. A hidden record gets no edge (ADR 0023), as it gets no
// `form_of_edge` row. The record's own rows, its line in `source_record_json`
// least of all, are written by `writeRecord` and are not touched here.

import { normalizeItalianExact } from "../italian/normalize.js";
import {
  adjectiveFormRows,
  adjectiveFormsCorrections,
  adjectiveFormsMisquote,
  cellCorrections,
  correctedFacts,
  correctionId,
  evidenceUrl,
  hideMismatch,
  isEdgeRemoval,
  recordCorrections,
  recoveredHides,
  senseEdgeCorrections,
  senseHideMisquote,
  senseHides,
  type AdjectiveFormsCorrection,
  type CellCorrection,
  type CuratedCorrection,
  type HideMismatch,
  type RecordCorrection,
  type RecoveredDefinitionHide,
  type RecoveredLine,
  type SenseEdgeCorrection,
  type SenseHide,
} from "../italian/curatedCorrections.js";
import type { ImportStatement } from "./importRelease.js";

/** One `corrected_claim` row's values after its record id and release, in `COLUMNS` order. */
export function correctedClaimValues(correction: RecordCorrection): [dimension: string, value: string, correctionId: string, evidenceUrl: string][] {
  return correctedFacts(correction).map((fact) => [fact.dimension, fact.value, correctionId(correction), evidenceUrl(correction.evidence[0])]);
}

/** One `corrected_form` row's values after its record id and release, in `COLUMNS` order, one per cell: each keyed as `lookup_form` keys a spelling, so a search finds it (#743). */
export function correctedFormValues(correction: CellCorrection): [formIndex: number, surface: string, surfaceKey: string, correctionId: string, evidenceUrl: string][] {
  return correction.cells.map((cell) => [cell.index, cell.surface, normalizeItalianExact(cell.surface), correctionId(correction), evidenceUrl(correction.evidence[0])]);
}

/**
 * The cells of `correction` whose text on `line` is not the one it replaces.
 * The digest already pins the line, so a cell named here is a list entry that
 * misquotes its own record.
 */
export function misquotedCells(correction: CellCorrection, line: string): number[] {
  const forms = (JSON.parse(line) as { forms?: { form?: unknown }[] }).forms ?? [];
  return correction.cells.filter((cell) => forms[cell.index]?.form !== cell.replaces).map((cell) => cell.index);
}

/**
 * One `corrected_edge` row's values after its record id and release, in
 * `COLUMNS` order. A removal (#755) names no word, so its target, key and
 * target's page are NULL.
 */
export function correctedEdgeValues(
  correction: SenseEdgeCorrection,
): [senseIndex: number, jsonPointer: string, targetWord: string | null, targetWordKey: string | null, correctionId: string, evidenceUrl: string, baseEvidenceUrl: string | null] {
  const { edge, evidence } = correction;
  const id = correctionId(correction);
  if (isEdgeRemoval(correction)) return [edge.sense, edge.gloss.pointer, null, null, id, evidenceUrl(evidence.form), null];
  const { target } = correction.edge;
  return [edge.sense, edge.gloss.pointer, target, normalizeItalianExact(target), id, evidenceUrl(evidence.form), evidenceUrl(correction.evidence.base)];
}

/** One `hidden_recovered_definition` row's values after its record id and release, in `COLUMNS` order. */
export const hiddenRecoveredValues = (correction: RecoveredDefinitionHide): [pageLine: number, correctionId: string, evidenceUrl: string] =>
  [correction.hides.line, correctionId(correction), evidenceUrl(correction.evidence.page)];

/** One `hidden_sense` row's values after its record id and release, in `COLUMNS` order. */
export const hiddenSenseValues = (correction: SenseHide): [senseIndex: number, jsonPointer: string, correctionId: string, evidenceUrl: string] =>
  [correction.hidesSense.index, correction.hidesSense.gloss.pointer, correctionId(correction), evidenceUrl(correction.evidence.page)];

/**
 * One `corrected_adjective_form` row's values after its record id and release,
 * in `COLUMNS` order, one per form: an added form's spelling, gender and
 * number, or a removed form's place in `forms[]` and its text there.
 */
export function correctedAdjectiveFormValues(
  correction: AdjectiveFormsCorrection,
): [rowIndex: number, formIndex: number | null, surface: string, gender: string | null, number: string | null, correctionId: string, evidenceUrl: string][] {
  const id = correctionId(correction);
  const url = evidenceUrl(correction.evidence[0]);
  return adjectiveFormRows(correction).map((row, i) =>
    row.added !== undefined ? [i, null, row.added.surface, row.added.gender, row.added.number, id, url] : [i, row.removed.index, row.removed.removes, null, null, id, url],
  );
}

/** Why an entry keyed to the seeded release was not written. */
export type UnappliedReason = "line-digest-differs" | "line-not-seeded" | "record-hidden" | HideMismatch;

/** What one seed did with the list: the count reported after every run. */
export interface CorrectionSummary {
  /** Entries keyed to the seeded release. */
  keyed: number;
  /** Entries written, each as one row per fact, cell or edge it sets. */
  applied: number;
  /** Entries keyed to the seeded release that were not written, and why. */
  unapplied: { id: string; reason: UnappliedReason }[];
}

/** A record's entries of the list: its facts, its cells, its edges by sense, its hidden recovered definitions, its hidden senses, and its adjective forms. */
interface EntriesOfLine {
  facts?: RecordCorrection;
  cells?: CellCorrection;
  edges: SenseEdgeCorrection[];
  hides: RecoveredDefinitionHide[];
  senseHides: SenseHide[];
  adjectiveForms?: AdjectiveFormsCorrection;
}

type KeyedEntry = RecordCorrection | CellCorrection | SenseEdgeCorrection | RecoveredDefinitionHide | SenseHide | AdjectiveFormsCorrection;

/** Every entry of a record's line: facts, then cells, then edges, then hides, then hidden senses, then adjective forms. */
const allOf = ({ facts, cells, edges, hides, senseHides, adjectiveForms }: EntriesOfLine): KeyedEntry[] => [
  ...(facts === undefined ? [] : [facts]),
  ...(cells === undefined ? [] : [cells]),
  ...edges,
  ...hides,
  ...senseHides,
  ...(adjectiveForms === undefined ? [] : [adjectiveForms]),
];

export class CorrectedLayer {
  private readonly byLine = new Map<string, EntriesOfLine>();
  private readonly applied = new Set<string>();
  private readonly unapplied = new Map<string, UnappliedReason>();
  private releaseId: string | undefined;

  constructor(
    corrections: readonly CuratedCorrection[],
    private readonly insert: {
      claim: ImportStatement;
      form: ImportStatement;
      edge: ImportStatement;
      hide: ImportStatement;
      senseHide: ImportStatement;
      adjectiveForm: ImportStatement;
    },
    private readonly rows: {
      corrected_claim: number;
      corrected_form: number;
      corrected_edge: number;
      hidden_recovered_definition: number;
      hidden_sense: number;
      corrected_adjective_form: number;
    },
  ) {
    const entriesOf = (correction: KeyedEntry): EntriesOfLine => {
      const key = `${correction.record.releaseId}:${correction.record.lineNo}`;
      const entries = this.byLine.get(key) ?? { edges: [], hides: [], senseHides: [] };
      this.byLine.set(key, entries);
      return entries;
    };
    for (const correction of recordCorrections(corrections)) entriesOf(correction).facts = correction;
    for (const correction of cellCorrections(corrections)) entriesOf(correction).cells = correction;
    for (const correction of senseEdgeCorrections(corrections)) entriesOf(correction).edges.push(correction);
    for (const correction of recoveredHides(corrections)) entriesOf(correction).hides.push(correction);
    for (const correction of senseHides(corrections)) entriesOf(correction).senseHides.push(correction);
    for (const correction of adjectiveFormsCorrections(corrections)) entriesOf(correction).adjectiveForms = correction;
  }

  /**
   * Write the corrections keyed to this record's line, when its digest is the
   * one they were checked against. `recovered` is what the recovered layer
   * wrote for the record, which a hide must quote.
   */
  add(
    record: { releaseId: string; recordId: number; lineNo: number; line: string; lineSha256: string },
    hidden: boolean,
    recovered: readonly RecoveredLine[],
  ): void {
    this.releaseId = record.releaseId;
    const entries = this.byLine.get(`${record.releaseId}:${record.lineNo}`);
    if (entries === undefined) return;
    const { facts, cells, edges, hides, senseHides: hiddenSenses, adjectiveForms } = entries;
    for (const correction of allOf(entries)) {
      if (correction.record.lineSha256 !== record.lineSha256) this.unapplied.set(correctionId(correction), "line-digest-differs");
    }
    if (facts !== undefined && facts.record.lineSha256 === record.lineSha256) {
      for (const values of correctedClaimValues(facts)) {
        this.insert.claim.run(record.recordId, record.releaseId, ...values);
        this.rows.corrected_claim += 1;
      }
      this.applied.add(correctionId(facts));
    }
    if (cells !== undefined && cells.record.lineSha256 === record.lineSha256) {
      const id = correctionId(cells);
      const misquoted = misquotedCells(cells, record.line);
      if (misquoted.length > 0) throw new Error(`curated correction ${id} misquotes the cells at forms ${misquoted.join(", ")} of its own line`);
      for (const values of correctedFormValues(cells)) {
        this.insert.form.run(record.recordId, record.releaseId, ...values);
        this.rows.corrected_form += 1;
      }
      this.applied.add(id);
    }
    for (const edge of edges) {
      if (edge.record.lineSha256 !== record.lineSha256) continue;
      if (hidden) {
        this.unapplied.set(correctionId(edge), "record-hidden");
        continue;
      }
      this.insert.edge.run(record.recordId, record.releaseId, ...correctedEdgeValues(edge));
      this.rows.corrected_edge += 1;
      this.applied.add(correctionId(edge));
    }
    for (const hide of hides) {
      if (hide.record.lineSha256 !== record.lineSha256) continue;
      const mismatch = hideMismatch(hide, recovered);
      if (mismatch !== undefined) {
        this.unapplied.set(correctionId(hide), mismatch);
        continue;
      }
      this.insert.hide.run(record.recordId, record.releaseId, ...hiddenRecoveredValues(hide));
      this.rows.hidden_recovered_definition += 1;
      this.applied.add(correctionId(hide));
    }
    for (const hide of hiddenSenses) {
      if (hide.record.lineSha256 !== record.lineSha256) continue;
      const id = correctionId(hide);
      const misquote = senseHideMisquote(hide, record.line);
      if (misquote !== undefined) throw new Error(`curated correction ${id} misquotes sense ${hide.hidesSense.index} of its own line: ${misquote}`);
      this.insert.senseHide.run(record.recordId, record.releaseId, ...hiddenSenseValues(hide));
      this.rows.hidden_sense += 1;
      this.applied.add(id);
    }
    if (adjectiveForms !== undefined && adjectiveForms.record.lineSha256 === record.lineSha256) {
      const id = correctionId(adjectiveForms);
      const misquote = adjectiveFormsMisquote(adjectiveForms, record.line);
      if (misquote !== undefined) throw new Error(`curated correction ${id} misquotes the forms of its own line: ${misquote}`);
      for (const values of correctedAdjectiveFormValues(adjectiveForms)) {
        this.insert.adjectiveForm.run(record.recordId, record.releaseId, ...values);
        this.rows.corrected_adjective_form += 1;
      }
      this.applied.add(id);
    }
  }

  get summary(): CorrectionSummary {
    const keyed = [...this.byLine.values()]
      .flatMap(allOf)
      .filter((correction) => correction.record.releaseId === this.releaseId)
      .map(correctionId);
    return {
      keyed: keyed.length,
      applied: this.applied.size,
      unapplied: keyed.filter((id) => !this.applied.has(id)).map((id) => ({ id, reason: this.unapplied.get(id) ?? "line-not-seeded" })),
    };
  }
}
