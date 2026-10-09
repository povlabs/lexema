// Writes the recovered layer (#28) beside the records a seed streams.
//
// For each admitted record whose word has a raw page, the page's section for the
// record is read and every definition the record does not carry is written to
// `recovered_definition`, with its labels and examples, naming the page
// revision it came from and the lead-in whose list it sits in, if any. The
// record's own rows are written by `writeRecord` first and are not touched here.

import type { RecoveredLine } from "../italian/curatedCorrections.js";
import { recordText, recoverDefinitions } from "../italian/recovery.js";
import type { RawPageSource } from "../source/rawPage.js";
import type { ImportStatement } from "./importRelease.js";
import type { RawPageRows } from "./rawPageRows.js";

export interface RecoveredLayerStatements {
  insertDefinition: ImportStatement;
  insertLabel: ImportStatement;
  insertExample: ImportStatement;
}

export interface RecoveredLayerRows {
  recovered_definition: number;
  recovered_label: number;
  recovered_example: number;
}

/** What one seed recovered: the count reported after every run. */
export interface RecoverySummary {
  /** Raw pages the seed could read. Zero when it was given none. */
  rawPages: number;
  /** Records whose word had a raw page. */
  recordsWithAPage: number;
  /** Records that carried only furniture, and now have definitions. */
  fullLoss: number;
  /** Records that kept a sense and missed a definition below one. */
  partialLoss: number;
  definitions: number;
  examples: number;
  /** Lines the structure marks as definitions whose templates the renderer does not know. */
  unrendered: number;
}

export class RecoveredLayer {
  private nextRecoveredId = 1;
  readonly summary: RecoverySummary;

  constructor(
    private readonly pages: RawPageSource,
    private readonly pageRows: RawPageRows,
    private readonly statements: RecoveredLayerStatements,
    private readonly rows: RecoveredLayerRows,
  ) {
    this.summary = {
      rawPages: pages.size,
      recordsWithAPage: 0,
      fullLoss: 0,
      partialLoss: 0,
      definitions: 0,
      examples: 0,
      unrendered: 0,
    };
  }

  /** Write the record's recovered definitions, and return each one's page revision, line, wikitext and text, in page order. */
  add(
    releaseId: string,
    recordId: number,
    record: Parameters<typeof recordText>[0],
  ): RecoveredLine[] {
    const page = this.pages.page(record.word);
    if (page === undefined) return [];
    this.summary.recordsWithAPage += 1;
    const recovery = recoverDefinitions(recordText(record), page);
    if (recovery.outcome !== "matched") return [];
    this.summary.unrendered += recovery.unrendered.length;
    if (recovery.loss === "full") this.summary.fullLoss += 1;
    if (recovery.loss === "partial") this.summary.partialLoss += 1;
    if (recovery.recovered.length === 0) return [];

    const pageId = this.pageRows.idOf(releaseId, page);
    // Ids follow page order, so a lead-in recovered for this record has the
    // id its place in `recovered` gives it, lower than any item in its list.
    const firstId = this.nextRecoveredId;
    recovery.recovered.forEach((definition, definitionIndex) => {
      const recoveredId = this.nextRecoveredId++;
      const leadIn = definition.listedUnder;
      this.statements.insertDefinition.run(
        recoveredId,
        recordId,
        releaseId,
        pageId,
        definitionIndex,
        definition.route,
        definition.route === "sub-term" ? definition.term : null,
        definition.ref.line,
        definition.wikitext,
        definition.text,
        definition.heldAsExample,
        leadIn?.in === "sense" ? leadIn.senseIndex : null,
        leadIn?.in === "recovered" ? firstId + leadIn.index : null,
      );
      this.rows.recovered_definition += 1;
      this.summary.definitions += 1;
      definition.labels.forEach((label, labelIndex) => {
        this.statements.insertLabel.run(recoveredId, labelIndex, label);
        this.rows.recovered_label += 1;
      });
      definition.examples.forEach((example, exampleIndex) => {
        this.statements.insertExample.run(recoveredId, exampleIndex, example.ref.line, example.wikitext, example.text);
        this.rows.recovered_example += 1;
        this.summary.examples += 1;
      });
    });
    return recovery.recovered.map((definition) => ({ revisionId: page.revisionId, line: definition.ref.line, wikitext: definition.wikitext, text: definition.text }));
  }
}
