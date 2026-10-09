// Meaning senses that carry a `form_of` edge to a word their own gloss merely
// mentions (#755). The extractor tags every sense of a form record as a form,
// so `mele`'s senses 1 to 3, "guance, soprattutto nei bambini:", "natiche o
// mammelle tondeggianti, ..." and "percosse", carry edges to `bambini`,
// `tondeggianti` and `percosse`, and a lookup read `mele` as a form of each.
// `scandinava`'s only sense, "relativa alla Scandinavia", names
// `Scandinavia`.
//
// Huey ruled on 2026-10-09 (#755,
// https://github.com/povlabs/lexema/issues/755#issuecomment-6076090404; ADR
// 0030's amendment of that day) that such an edge is removed beside the
// record, and that where the record also has a real form sense, the edge
// points at the record's own base word instead (`mele` -> `mela`). This file
// is that rule, `it-form-of-meaning-edge/v1`. It reads one archive line, the
// record's own, a record of the base word for a redirected edge, and the dump
// revisions of the pages it cites, so the same release always gives the same
// corrections.
//
// A sense is a **meaning sense** when all of these hold:
//
// - **It declares an edge.** Its `form_of` names at least one word.
// - **Its gloss has no form opening.** `glossBase` (formOfGlossEdge.ts) does
//   not read its first gloss as a form's, so rules `it-form-of-gloss-edge` v1
//   and v2 never read it.
// - **No word of its gloss names a form.** `formTerm` finds none: no word that
//   begins as a form's name does ("plurale", "femminile", "participio",
//   "superlativo", "variante", "verbo", ...; `FORM_STEMS`), no abbreviation
//   or pointer word ("pl", "pers", "part", "f", "forma", "vedi", ...;
//   `FORM_WORDS`), and no misspelling of a form's name within two edits
//   ("pliurale", "fmminile", "accrescitvo"; `FORM_NAMES`). So "terza persona
//   singolare, modo indicativo, tempo presente del verbo salire", "Plural form
//   of mattutino" and "femminile pluraledi disabitato", form glosses the
//   v1/v2 test misses, are not meanings. The test errs toward a form: a
//   meaning gloss that uses such a word ("essere umano prepubere di sesso
//   femminile") keeps its edge, and the report lists it.
//
// The rule reads Italian records only. It corrects a meaning sense, unless another
// correction already sets its edge, it declares several edges, its one edge
// already names the record's base word, or the record's page has no revision
// in the dump:
//
// - **Redirected** when the record has a **real form sense** naming exactly
//   one base word B: a sense whose gloss has a form opening naming B after
//   "di", whose edge, as corrected by v2 or a hand entry or else as the source
//   states it, is B alone, and B is not the record's own word. B's own forms
//   table must list the word, and B's page must be in the dump: the evidence
//   ADR 0030 asks of any edge to B. The edge points at B, cites the record's
//   page showing the form sense's gloss and B's page listing the word, and
//   keeps the source's edge verbatim (`CorrectedEdge.replaces`).
// - **Removed** otherwise: no real form sense, form senses naming several
//   bases, or one base not confirmed. The correction keeps the source's edge
//   verbatim (`RemovedEdge.removes`) and cites the record's page showing the
//   sense's gloss. A lookup reads the sense as having no edge.
//
// Everything else stays as the source states it, and the report gives the
// reason (`LeftAlone`).

import type { CorrectedEdge, CorrectedRecord, EdgeCorrection, EdgeRemoval, RemovedEdge } from "./curatedCorrections.js";
import { glossBase, listing, type ListingLemma, type PageRevisions, type ScannedLemma } from "./formOfGlossEdge.js";

/** Every version of the rule, oldest first. A change to what it corrects is a new version and a new ruling. */
export const FORM_OF_MEANING_EDGE_RULES = ["it-form-of-meaning-edge/v1"] as const;

export type FormOfMeaningEdgeRule = (typeof FORM_OF_MEANING_EDGE_RULES)[number];

/** The version the curated list is made with. */
export const FORM_OF_MEANING_EDGE_RULE = "it-form-of-meaning-edge/v1" satisfies FormOfMeaningEdgeRule;

/** A gloss word that begins with one of these names a form: "plurale", "pluraledi", "femminmile", "participio", "superlativo". */
export const FORM_STEMS: readonly string[] = [
  "plur",
  "singol",
  "singular",
  "femm",
  "femin",
  "femen",
  "masch",
  "mascul",
  "particip",
  "paricip",
  "particio",
  "gerund",
  "infinit",
  "indicativ",
  "congiuntiv",
  "condizional",
  "imperativ",
  "omperativ",
  "superlativ",
  "comparativ",
  "diminutiv",
  "accrescitiv",
  "vezzeggiativ",
  "peggiorativ",
  "dispregiativ",
  "alterat",
  "variant",
  "grafi",
  "abbreviazion",
  "apocop",
  "troncament",
  "elis",
  "contrazion",
  "aferesi",
  "sincop",
  "verb",
  "flessa",
  "flesso",
  "inflect",
];

/** A gloss word that is one of these, whole, names a form or points at its base: "f plur di", "3ª pers sing", "part. passato", "vedi esso", "Plural form of". */
export const FORM_WORDS: ReadonlySet<string> = new Set(["sing", "pl", "pers", "part", "p", "pres", "pass", "f", "m", "forma", "form", "vedi", "see", "sigla"]);

/** A gloss word of five letters or more within two edits of one of these is its misspelling: "pliurale", "fmminile", "accrescitvo". */
export const FORM_NAMES: readonly string[] = [
  "plurale",
  "singolare",
  "femminile",
  "maschile",
  "participio",
  "gerundio",
  "infinito",
  "indicativo",
  "congiuntivo",
  "condizionale",
  "imperativo",
  "superlativo",
  "comparativo",
  "diminutivo",
  "accrescitivo",
  "vezzeggiativo",
  "peggiorativo",
  "dispregiativo",
  "variante",
  "abbreviazione",
];

/** The edits that turn `a` into `b`: insertions, deletions, substitutions and swaps of two neighbouring letters. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** The first word of `gloss`, lower case, that names a form, if any. */
export function formTerm(gloss: string): string | undefined {
  const words = gloss
    .toLowerCase()
    .split(/[^\p{L}\p{M}]+/u)
    .filter((word) => word !== "");
  return words.find(
    (word) =>
      FORM_WORDS.has(word) ||
      FORM_STEMS.some((stem) => word.startsWith(stem)) ||
      (word.length >= 5 && FORM_NAMES.some((name) => editDistance(word, name) <= 2)),
  );
}

/** Whether `gloss` states a meaning: no form opening, and no word that names a form. */
export const isMeaningGloss = (gloss: string): boolean => glossBase(gloss)?.formOpening !== true && formTerm(gloss) === undefined;

/** One sense of a record as the line states it: its place, its first gloss, and the words its `form_of` edges name. */
export interface RecordSense {
  senseIndex: number;
  gloss: string;
  formOf: readonly string[];
}

/** What the rule reads of one archive record: the senses with a first gloss, each as the line states it. */
export interface ScannedRecord {
  lineNo: number;
  lineSha256: string;
  word: string;
  pos: string;
  langCode: string;
  senses: readonly RecordSense[];
}

/** Why the rule leaves a sense that declares an edge, and whose gloss has no form opening, as the source states it. */
export type LeftAlone =
  /** Another correction (a hand entry, or rule `it-form-of-gloss-edge`) already sets this sense's edge. */
  | "already-corrected"
  /** A word of the gloss names a form (`formTerm`): a form's gloss the v1/v2 test misses, or a meaning that uses such a word. */
  | "form-gloss"
  /** The sense declares several edges. */
  | "several-edges"
  /** Its one edge already names the base word the record's real form senses name. */
  | "names-base"
  /** The record's page has no revision in the release's dump, so there is no page to cite. */
  | "page-not-in-dump";

/** Why the rule removes a meaning sense's edge rather than point it at the record's base word. */
export type RemovedBecause =
  /** The record has no real form sense. */
  | "no-form-sense"
  /** The record's real form senses name more than one base word: the ruling does not say which (#755). */
  | "several-bases"
  /** One base word, but no Italian record of it lists the word, or its page is not in the dump. */
  | "base-not-confirmed";

/** An edge correction or removal the rule made. */
export type RuleMadeMeaningCorrection = (EdgeCorrection | EdgeRemoval) & { rule: FormOfMeaningEdgeRule };

/** The rule's answer for one sense it reads. */
export type MeaningVerdict =
  | { kind: "redirected"; record: ScannedRecord; sense: RecordSense; formSense: RecordSense; lemma: ListingLemma; correction: EdgeCorrection & { rule: FormOfMeaningEdgeRule } }
  | { kind: "removed"; record: ScannedRecord; sense: RecordSense; because: RemovedBecause; bases: readonly string[]; correction: EdgeRemoval & { rule: FormOfMeaningEdgeRule } }
  | { kind: "left-alone"; record: ScannedRecord; sense: RecordSense; reason: LeftAlone; term?: string };

/** The record's real form senses, each with the base word it names: a form opening naming B, an edge that is B alone, and B not the record's own word. */
function realFormSenses(record: ScannedRecord, setTargets: ReadonlyMap<number, string>): { sense: RecordSense; base: string }[] {
  return record.senses.flatMap((sense) => {
    const named = glossBase(sense.gloss);
    if (named?.formOpening !== true || named.base === record.word) return [];
    const edge = setTargets.get(sense.senseIndex) ?? (sense.formOf.length === 1 ? sense.formOf[0] : undefined);
    return edge === named.base ? [{ sense, base: named.base }] : [];
  });
}

/**
 * Judge every sense of `record` the rule reads: each that declares an edge
 * and whose gloss has no form opening. `setTargets` holds the word another
 * correction (a hand entry, or rule `it-form-of-gloss-edge`) sets on each of
 * the record's senses, by sense; `lemmas` are the archive's records of the
 * base word the record's real form senses name; `pages` are the revisions of
 * the release's dump.
 */
export function judgeRecord(
  record: ScannedRecord,
  releaseId: string,
  setTargets: ReadonlyMap<number, string>,
  lemmas: readonly ScannedLemma[],
  pages: PageRevisions,
  rule: FormOfMeaningEdgeRule = FORM_OF_MEANING_EDGE_RULE,
): MeaningVerdict[] {
  // Another language's record is not read at all: ADR 0023 reads those apart, and hides most of them.
  if (record.langCode !== "it") return [];
  const candidates = record.senses.filter((sense) => sense.formOf.length > 0 && glossBase(sense.gloss)?.formOpening !== true);
  const formSenses = realFormSenses(record, setTargets);
  const bases = [...new Set(formSenses.map((one) => one.base))];
  // The first real form sense, when every one names the same base word.
  const only = bases.length === 1 ? formSenses[0] : undefined;
  const corrected: CorrectedRecord = { releaseId, lineNo: record.lineNo, lineSha256: record.lineSha256, word: record.word, pos: record.pos };
  const formRevision = pages.get(record.word);
  return candidates.map((sense): MeaningVerdict => {
    const leftAlone = (reason: LeftAlone, term?: string): MeaningVerdict => ({ kind: "left-alone", record, sense, reason, ...(term === undefined ? {} : { term }) });
    if (setTargets.has(sense.senseIndex)) return leftAlone("already-corrected");
    const term = formTerm(sense.gloss);
    if (term !== undefined) return leftAlone("form-gloss", term);
    if (sense.formOf.length > 1) return leftAlone("several-edges");
    const [stated] = sense.formOf;
    if (only !== undefined && stated === only.base) return leftAlone("names-base");
    if (formRevision === undefined) return leftAlone("page-not-in-dump");
    const statedEdge = { pointer: `/senses/${sense.senseIndex}/form_of/0/word`, text: stated };
    const lemma = only === undefined ? undefined : listing(only.base, record.word, lemmas);
    const baseRevision = only === undefined ? undefined : pages.get(only.base);
    if (only !== undefined && lemma !== undefined && baseRevision !== undefined) {
      const { sense: formSense, base } = only;
      const edge: CorrectedEdge = { sense: sense.senseIndex, gloss: { pointer: `/senses/${formSense.senseIndex}/glosses/0`, text: formSense.gloss }, replaces: statedEdge, target: base };
      return {
        kind: "redirected",
        record,
        sense,
        formSense,
        lemma,
        correction: {
          record: corrected,
          edge,
          evidence: {
            form: { wiki: "it.wiktionary.org", title: record.word, revisionId: formRevision, shows: formSense.gloss },
            base: { wiki: "it.wiktionary.org", title: base, revisionId: baseRevision, shows: record.word },
          },
          rule,
        },
      };
    }
    const edge: RemovedEdge = { sense: sense.senseIndex, gloss: { pointer: `/senses/${sense.senseIndex}/glosses/0`, text: sense.gloss }, removes: statedEdge };
    return {
      kind: "removed",
      record,
      sense,
      because: bases.length === 0 ? "no-form-sense" : bases.length > 1 ? "several-bases" : "base-not-confirmed",
      bases,
      correction: { record: corrected, edge, evidence: { form: { wiki: "it.wiktionary.org", title: record.word, revisionId: formRevision, shows: sense.gloss } }, rule },
    };
  });
}

/**
 * One record the rule corrects, pinned: the senses it reads, the record of
 * the base word whose table lists the word when it redirects, and the dump
 * revisions of the pages it cites.
 */
export interface PinnedRecord {
  record: ScannedRecord;
  lemma?: ListingLemma;
  revisions: { form: number; base?: number };
}

/** The records the rule corrects on one release, pinned with what each reads and the pages each cites. */
export interface FormOfMeaningEdgeEvidence {
  releaseId: string;
  records: readonly PinnedRecord[];
}

/**
 * The corrections the rule makes from its pinned evidence, in archive and
 * sense order: each pinned record judged again from what it pins, so a sense
 * the rule would no longer correct gets none. `setEdges` are the corrections
 * that set an edge (hand entries and rule `it-form-of-gloss-edge`): a sense
 * one of them sets is never also corrected here, and their targets are the
 * record's real form senses' edges.
 */
export function formOfMeaningEdgeCorrections(
  evidence: FormOfMeaningEdgeEvidence,
  setEdges: readonly EdgeCorrection[],
  rule: FormOfMeaningEdgeRule = FORM_OF_MEANING_EDGE_RULE,
): RuleMadeMeaningCorrection[] {
  const targets = new Map<number, Map<number, string>>();
  for (const correction of setEdges) {
    if (correction.record.releaseId !== evidence.releaseId) continue;
    const ofLine = targets.get(correction.record.lineNo) ?? new Map<number, string>();
    ofLine.set(correction.edge.sense, correction.edge.target);
    targets.set(correction.record.lineNo, ofLine);
  }
  return [...evidence.records]
    .sort((a, b) => a.record.lineNo - b.record.lineNo)
    .flatMap(({ record, lemma, revisions }) => {
      const pages = new Map([[record.word, revisions.form]]);
      const lemmas: ScannedLemma[] = [];
      if (lemma !== undefined && revisions.base !== undefined) {
        const { formIndex, ...scanned } = lemma;
        const forms: (string | undefined)[] = [];
        forms[formIndex] = record.word;
        lemmas.push({ ...scanned, forms });
        pages.set(lemma.word, revisions.base);
      }
      return judgeRecord(record, evidence.releaseId, targets.get(record.lineNo) ?? new Map(), lemmas, pages, rule).flatMap((verdict) =>
        verdict.kind === "left-alone" ? [] : [verdict.correction],
      );
    });
}
