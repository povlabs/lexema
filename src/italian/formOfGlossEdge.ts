// Form records whose sense says what it is a form of in its gloss, but declares
// no `form_of` edge (#715, #722). `aerei`'s noun record glosses itself
// "plurale di aereo" and `costruttori`'s "plurale di costruttore", and neither
// sense carries an edge, so each page read the record as a word of its own.
//
// Huey ruled on 2026-10-07 (#708, questions 7 and 8,
// https://github.com/povlabs/lexema/issues/708#issuecomment-6047197445) that a
// ruled rule may add the missing edge beside the record (ADR 0030), only where
// both hold: the gloss names X after "di", and X's own forms table lists the
// record's word. This file is that rule, `it-form-of-gloss-edge/v1`. It judges
// a sense from two archive lines only, the record's own and a record of X, so
// the same release always gives the same edges.
//
// A sense gets an edge to X when all of these hold:
//
// - **It is a form's gloss.** The sense's first gloss opens with the words that
//   say which form it is, and nothing else, then "di X": "plurale di aereo",
//   "femminile plurale di corsivo", "terza persona singolare del congiuntivo
//   presente di filare". `FORM_WORDS` lists those words. A gloss that names X
//   after "di" for another reason ("studioso di chimica", "diritto di
//   appoggiare il proprio edificio") is not a form's gloss, so ADR 0030's "form
//   record" does not reach it, even where X's table lists the word.
// - **It declares no edge.** A sense whose edge names another word is not this
//   rule's: only a hand entry fixes a wrong edge (question 9), and this rule
//   lists each such sense in its report.
// - **X's own forms table lists the word.** Some Italian record whose `word`
//   is X lists the record's word, exactly, in its `forms`. That record's line
//   is the evidence the correction cites.
//
// Everything else stays as the source states it, and the report gives the
// reason (`LeftAlone`).

import type { ArchiveEvidence, CorrectedRecord, EdgeCorrection } from "./curatedCorrections.js";

/** Every version of the rule, oldest first. A change to what it confirms is a new version and a new ruling. */
export const FORM_OF_GLOSS_EDGE_RULES = ["it-form-of-gloss-edge/v1"] as const;

export type FormOfGlossEdgeRule = (typeof FORM_OF_GLOSS_EDGE_RULES)[number];

/** The version the curated list is made with. */
export const FORM_OF_GLOSS_EDGE_RULE = "it-form-of-gloss-edge/v1" satisfies FormOfGlossEdgeRule;

/**
 * The words a form's gloss opens with, lower case: which person, number,
 * gender, mood and tense it is. "dell'" stands for the article glued to the
 * next word, "dell'imperativo".
 */
export const FORM_WORDS: ReadonlySet<string> = new Set([
  "plurale",
  "singolare",
  "maschile",
  "femminile",
  "prima",
  "seconda",
  "terza",
  "persona",
  "indicativo",
  "congiuntivo",
  "condizionale",
  "imperativo",
  "participio",
  "gerundio",
  "presente",
  "passato",
  "remoto",
  "imperfetto",
  "futuro",
  "semplice",
  "del",
  "dell'",
  "della",
]);

/** The words of `FORM_WORDS` that name a form on their own; an opening needs one. */
const FORM_NOUNS: ReadonlySet<string> = new Set(["plurale", "singolare", "maschile", "femminile", "persona", "participio", "gerundio"]);

/** The opening, "di", and the word X, which a letter, mark or digit may not follow. */
const NAMES_AFTER_DI = /^(.*?)(?:^|\s)di\s+([\p{L}\p{M}]+)(?![\p{L}\p{M}\p{Nd}])/u;

/** The words of an opening, lower case, with an elided article split from its word. */
const openingWords = (opening: string): string[] =>
  opening
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "")
    .flatMap((word) => {
      const elided = /^(dell')(.+)$/u.exec(word);
      return elided === null ? [word] : [elided[1], elided[2]];
    });

/** What a gloss says: the word it names after its first "di", and whether its opening says which form that is. */
export interface GlossBase {
  /** X: the word after the first "di". */
  base: string;
  /** Whether the opening holds only `FORM_WORDS`, one of which names a form. */
  formOpening: boolean;
}

/** The word `gloss` names after its first "di", if any. */
export function glossBase(gloss: string): GlossBase | undefined {
  const match = NAMES_AFTER_DI.exec(gloss);
  if (match === null) return undefined;
  const words = openingWords(match[1]);
  const formOpening = words.length > 0 && words.every((word) => FORM_WORDS.has(word)) && words.some((word) => FORM_NOUNS.has(word));
  return { base: match[2], formOpening };
}

/** What the rule reads of one sense of an archive record, each field as the line states it. */
export interface ScannedSense {
  lineNo: number;
  lineSha256: string;
  word: string;
  pos: string;
  langCode: string;
  /** The sense's place in `senses`. */
  senseIndex: number;
  /** `senses[senseIndex].glosses[0]`. */
  gloss: string;
  /** The words its `form_of` edges name, in order; empty when it declares none. */
  formOf: readonly string[];
}

/** What the rule reads of a record that may be X's: its forms, as listed. */
export interface ScannedLemma {
  lineNo: number;
  lineSha256: string;
  word: string;
  pos: string;
  langCode: string;
  /** Each `forms[i].form`, by its index; a form that is not a string is `undefined`. */
  forms: readonly (string | undefined)[];
}

/** Why the rule leaves a sense as the source states it. */
export type LeftAlone =
  /** Another language's record (ADR 0023 reads those apart). */
  | "not-italian"
  /** A hand entry already sets this sense's edge. */
  | "hand-entry"
  /** The gloss names the record's own word after "di". */
  | "names-itself"
  /** The gloss names X after "di" and X's table lists the word, but its opening does not say which form it is. */
  | "not-a-form-gloss"
  /** A form's gloss, with no Italian record of X. */
  | "no-record-of-base"
  /** A form's gloss, and no Italian record of X lists the word. */
  | "base-table-does-not-list"
  /** The sense declares an edge to another word, which X's table lists: only a ruling fixes it (question 9). */
  | "edge-names-another-word";

/** The rule's answer for one sense it reads. */
export type SenseVerdict =
  | { kind: "edge"; sense: ScannedSense; correction: RuleMadeEdgeCorrection }
  | { kind: "left-alone"; sense: ScannedSense; base: string; reason: LeftAlone };

/** An edge correction the rule made, citing the record of X whose table lists the word. */
export interface RuleMadeEdgeCorrection extends EdgeCorrection {
  rule: FormOfGlossEdgeRule;
}

/** The first Italian record of `base` among `lemmas`, in archive order, whose forms list `word`, and where. */
function listing(base: string, word: string, lemmas: readonly ScannedLemma[]): { lemma: ScannedLemma; formIndex: number } | undefined {
  for (const lemma of [...lemmas].sort((a, b) => a.lineNo - b.lineNo)) {
    if (lemma.word !== base || lemma.langCode !== "it") continue;
    const formIndex = lemma.forms.indexOf(word);
    if (formIndex !== -1) return { lemma, formIndex };
  }
  return undefined;
}

/**
 * Judge one sense of `releaseId`. `lemmas` are the archive's records whose
 * `word` is the base the gloss names; `handSenses` holds `<line>:<sense>` of
 * every sense a hand entry sets. Undefined for a sense the rule does not
 * read: one whose gloss names no word after "di", or names one whose table
 * does not list the word while its opening is no form's.
 */
export function judgeSense(
  sense: ScannedSense,
  releaseId: string,
  lemmas: readonly ScannedLemma[],
  handSenses: ReadonlySet<string>,
): SenseVerdict | undefined {
  const named = glossBase(sense.gloss);
  if (named === undefined) return undefined;
  const { base, formOpening } = named;
  const found = listing(base, sense.word, lemmas);
  if (!formOpening && found === undefined) return undefined;
  const leftAlone = (reason: LeftAlone): SenseVerdict => ({ kind: "left-alone", sense, base, reason });
  // A sense whose edge already names X is right, and not the rule's to read.
  if (sense.formOf.length > 0 && (sense.formOf.includes(base) || found === undefined || !formOpening)) return undefined;
  if (handSenses.has(`${sense.lineNo}:${sense.senseIndex}`)) return leftAlone("hand-entry");
  if (sense.formOf.length > 0) return leftAlone("edge-names-another-word");
  if (sense.langCode !== "it") return leftAlone("not-italian");
  if (base === sense.word) return leftAlone("names-itself");
  if (!formOpening) return leftAlone("not-a-form-gloss");
  if (found === undefined) {
    return leftAlone(lemmas.some((lemma) => lemma.word === base && lemma.langCode === "it") ? "base-table-does-not-list" : "no-record-of-base");
  }
  const record: CorrectedRecord = { releaseId, lineNo: sense.lineNo, lineSha256: sense.lineSha256, word: sense.word, pos: sense.pos };
  const evidence: ArchiveEvidence = {
    releaseId,
    lineNo: found.lemma.lineNo,
    lineSha256: found.lemma.lineSha256,
    word: found.lemma.word,
    pos: found.lemma.pos,
    pointer: `/forms/${found.formIndex}/form`,
    shows: sense.word,
  };
  return {
    kind: "edge",
    sense,
    correction: {
      record,
      edge: { sense: sense.senseIndex, gloss: { pointer: `/senses/${sense.senseIndex}/glosses/0`, text: sense.gloss }, target: base },
      evidence,
      rule: FORM_OF_GLOSS_EDGE_RULE,
    },
  };
}

/** One edge the rule confirmed, pinned: the sense it reads and the record of X it cites. */
export interface PinnedEdge {
  sense: ScannedSense;
  lemma: Omit<ScannedLemma, "forms"> & { formIndex: number };
}

/** The senses the rule confirms on one release, pinned with the line each cites. */
export interface FormOfGlossEdgeEvidence {
  releaseId: string;
  edges: readonly PinnedEdge[];
}

/**
 * The corrections the rule makes from its pinned evidence, in archive order:
 * each pinned sense judged again from the two lines it pins, so an entry the
 * rule would no longer confirm makes none. A sense a hand entry sets is never
 * also set by the rule.
 */
export function formOfGlossEdgeCorrections(evidence: FormOfGlossEdgeEvidence, hand: readonly EdgeCorrection[]): RuleMadeEdgeCorrection[] {
  const handSenses = new Set(
    hand.filter((correction) => correction.record.releaseId === evidence.releaseId).map((correction) => `${correction.record.lineNo}:${correction.edge.sense}`),
  );
  return [...evidence.edges]
    .sort((a, b) => a.sense.lineNo - b.sense.lineNo || a.sense.senseIndex - b.sense.senseIndex)
    .flatMap(({ sense, lemma }) => {
      const forms: (string | undefined)[] = [];
      forms[lemma.formIndex] = sense.word;
      const verdict = judgeSense(sense, evidence.releaseId, [{ ...lemma, forms }], handSenses);
      return verdict?.kind === "edge" ? [verdict.correction] : [];
    });
}
