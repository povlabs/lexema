// The explanations Lexema has written by hand, as `lexema_explanation` rows.
//
// ADR 0008 orders the work: "Bulk generation waits for a small labelled batch
// over the twelve spot-check words to settle layout and wording." This is that
// batch. No model wrote a word of it, so no row here carries a model, a prompt
// version or a generation time — the schema's `origin` discriminator is what
// keeps that honest, and `'lexema-hand-written'` is the value it is stored
// under. Calling the author 'hand-written' in the `model` column instead would
// be a false provenance value in the one place the label rests on.
//
// Three entries, not twelve, ruled by Huey on 2026-09-21: one per card shape —
// `casa` the noun, `andare` the verb, `bello` the adjective — so each shape can
// be judged once before anything is generated. All three are spot-check words
// (reports/2026-09-18-dataset-spot-check.md). The remaining nine belong to #50
// and are written by the model once these three are approved.
//
// Every entry is written against what the release actually states: ADR 0008
// forbids Lexema's own text from supplying a grammar fact the source or
// `src/italian/` does not state, so each entry below names the source claim it
// rests on and says nothing past it. `casa`'s source glosses say nothing
// usable, so its entry says what the word means and cites the source for
// nothing.
//
// The English is the explanation only. ADR 0008's amendment keeps the example
// sentence Italian, as everything from the source stays Italian, and ADR 0009
// keeps all three strings in fields no source text shares.

import type { DatabaseSync } from "node:sqlite";

/** One hand-written explanation, located by the record it is about. */
export interface HandWrittenExplanation {
  /** The record's own headword and part of speech, as the source spells them. */
  word: string;
  pos: string;
  /** Lexema's explanation, in plain Italian a learner can read. */
  italian: string;
  /** The same explanation in English. Nothing else on the card is translated. */
  english: string;
  /** One basic Italian sentence using the word. Italian only. */
  exampleItalian: string;
}

export const HAND_WRITTEN_EXPLANATIONS: readonly HandWrittenExplanation[] = [
  {
    // The source says nothing usable: its two glosses are
    // `casa ( approfondimento) f sing` and `casa ( citazioni)`, and it states no
    // gender, number or forms at all (spot check, row `casa`). So this says what
    // the word means and rests on no source claim.
    word: "casa",
    pos: "noun",
    italian: "Il posto dove una persona vive.",
    english: "The place where a person lives.",
    exampleItalian: "La mia casa è piccola.",
  },
  {
    // Line 2345 `/senses/0/glosses/0`: "muoversi da un luogo verso un altro
    // luogo" (spot check, "Meaning evidence"). Said in Lexema's own words rather
    // than copied: the source's sentence stays in its own field.
    word: "andare",
    pos: "verb",
    italian: "Lasciare un posto per arrivare in un altro.",
    english: "To leave one place in order to reach another.",
    exampleItalian: "Voglio andare a casa.",
  },
  {
    // Line 33645, the adjective record (spot check, row `bello`). What the word
    // means is Lexema's; that it is an adjective is the source's.
    word: "bello",
    pos: "adj",
    italian: "Che piace a chi lo guarda o lo ascolta.",
    english: "Pleasing to whoever looks at it or hears it.",
    exampleItalian: "Questo quadro è bello.",
  },
];

/**
 * Write every hand-written explanation whose record is in this release, and
 * report how many landed.
 *
 * An entry whose record the release does not hold writes nothing, exactly as a
 * known dispute does: a prefix seed stops at a line number, so a word past that
 * line is simply absent from a short release. That is a smaller release, not a
 * missing explanation.
 *
 * An entry addresses a record by `(word, pos)`, as `knownDisputes.ts` does, and
 * each of the three pairs above is one record in this release. Should a pair
 * ever name several, every one of them is written — the same text is the only
 * thing this file knows, and picking one of the records would be a claim about
 * which of them the words are about.
 */
export function writeHandWrittenExplanations(db: DatabaseSync, releaseId: string): number {
  const find = db.prepare(
    `SELECT record_id FROM source_record
      WHERE release_id = ? AND word = ? AND pos = ?
      ORDER BY line_no`,
  );
  const insert = db.prepare(
    `INSERT OR IGNORE INTO lexema_explanation
       (record_id, release_id, origin, explanation_it, explanation_en, example_it)
     VALUES (?, ?, 'lexema-hand-written', ?, ?, ?)`,
  );

  let written = 0;
  for (const entry of HAND_WRITTEN_EXPLANATIONS) {
    const records = find.all(releaseId, entry.word, entry.pos) as { record_id: number }[];
    for (const { record_id } of records) {
      insert.run(record_id, releaseId, entry.italian, entry.english, entry.exampleItalian);
      written += 1;
    }
  }
  return written;
}
