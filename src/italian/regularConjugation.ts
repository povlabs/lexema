// A regular verb's table, for a pronominal verb whose base verb has no record
// with one, by rule `it-regular-conjugation/v1` (#838).
//
// `it-pronominal-conjugation/v1` (pronominalConjugation.ts) builds a
// pronominal verb's table from its base verb's cells: `trasferirsi` from
// `trasferire`'s. About 150 pronominal verbs have no such base: `pentire` has
// no record at all, and `accertare`'s record has no forms. This rule gives
// them the base cells instead, when the source settles which regular
// conjugation the verb follows, and the pronominal rule builds on those cells
// exactly as on a record's. Huey ruled on 2026-10-16 that the class comes only
// from what the source shows, and that a verb it does not settle gets no
// table (https://github.com/povlabs/lexema/issues/838#issuecomment-6214333127).
//
// Two things settle it, in this order:
//
// - **An `{{It-conj}}` call.** Italian Wiktionary writes each verb's table as
//   one call on its `Appendice:Coniugazioni/Italiano/<verb>` page, and names
//   the class in the call: `{{It-conj|pent|irsi|essere}}` is `pent-` in the
//   third conjugation without `-isc-` (*mi pento*), and
//   `{{It-conj|sment|ire-b|avere}}` is the one with it (*smentisco*). The calls this rule
//   reads are pinned from the release's dump in conjugationTemplateCalls.ts,
//   with the page's revision. A call that overrides any form (`pp=prefisso`),
//   or names a class this rule does not build (`ere`, `fare`, `orre`), settles
//   nothing here.
// - **The ending**, where no call is pinned and the ending alone settles it, as
//   the template's own documentation states (Template:It-conj/man): `-are` is
//   the first conjugation; `-care` and `-gare` add an `h` before `e` and `i`;
//   `-ciare` and `-giare` drop their `i` there; `-gliare` drops it before `i`.
//
// Everything else is declined, and the page shows no table: an `-ire` verb
// with no call (`-isc-` or not), any other `-iare` (its `i` may be stressed,
// `obliare`, *oblìo*), the second conjugation (its passato remoto and
// participle are the verb's own), the verbs made on `andare`, `dare`, `stare`,
// `fare` and `trarre`, which do not follow the first conjugation, and a record
// whose every gloss says it is a form of another word (`traversi`, "seconda
// persona singolare dell'indicativo presente di traversare").
//
// The cells are the ones the template writes for the class (Modulo:It-conj),
// tagged as the source tags a record's forms, so `it-moods/v1` places each one
// where it places a record's. Every spelling is Lexema's, built when the page
// is built and never stored (ADR 0012); each carries the evidence that chose
// its class.

import { glossBase } from "./formOfGlossEdge.js";
import type { PronominalVerb } from "./pronominalConjugation.js";
import type { VerbFormTags } from "./moods.js";
import { templatesOn } from "./wiktionaryEvidence.js";

/** The rule's name and version. */
export const REGULAR_CONJUGATION_RULE = "it-regular-conjugation/v1" as const;

/**
 * The regular classes this rule builds, by the name `{{It-conj}}` gives them:
 * `are`, `care`/`gare` (`h` before `e`, `i`), `ciare`/`giare` (the stem without
 * its `i`), `iare` (an unstressed `i`, kept in the stem), `ire`, and `ire-b`
 * (`-isc-`).
 */
export type ConjugationClass = "are" | "care" | "gare" | "ciare" | "giare" | "iare" | "ire" | "ire-b";

/** One `{{It-conj}}` call, as an Appendice page of the release's dump writes it. */
export interface PinnedTemplateCall {
  /** `Appendice:Coniugazioni/Italiano/pentirsi`. */
  title: string;
  revisionId: number;
  timestamp: string;
  /** The call, verbatim: `{{It-conj|pent|irsi|essere}}`. */
  call: string;
}

/** The pinned calls, by page title. */
export type TemplateCalls = Readonly<Record<string, PinnedTemplateCall>>;

/** What chose a verb's class: a pinned call, or the base verb's ending. */
export type ClassEvidence =
  | { kind: "template"; page: PinnedTemplateCall }
  | { kind: "ending"; base: string; ending: "-are" | "-care" | "-gare" | "-ciare" | "-giare" | "-gliare" };

/** Why the rule builds no table for a verb. */
export type DeclineReason =
  /** Every gloss of the record says it is a form of another word: `traversi`. */
  | "form-of-another-word"
  /** A pinned call overrides a form, or names a class the rule does not build: `{{It-conj|prefigg|ere|avere|pp=prefisso…}}`. */
  | "template-not-read"
  /** A verb made on andare, dare, stare, fare or trarre: `assuefarsi`, `sdarsi`, and any `-trarsi`. */
  | "irregular-family"
  /** Another `-iare`, whose `i` may be stressed: `obliarsi`, `appollaiarsi`. */
  | "iare-stress"
  /** An `-ire` verb with no call: `-isc-` or not, the ending does not say. */
  | "ire-isc"
  /** The second conjugation, or `-orre`, `-urre`: `avvedersi`, `prefiggersi`. */
  | "second-conjugation";

/** A verb whose class the source settles: the class, the stem the template writes, its base verb, and what settled it. */
export interface SettledClass {
  kind: "settled";
  conjugationClass: ConjugationClass;
  stem: string;
  base: string;
  evidence: ClassEvidence;
}

export type ClassAnswer = SettledClass | { kind: "declined"; reason: DeclineReason; page?: PinnedTemplateCall };

/** The title of the Appendice page that conjugates `verb`. */
export const conjugationPageOf = (verb: string): string => `Appendice:Coniugazioni/Italiano/${verb}`;

/** The class each `{{It-conj}}` type names, its pronominal types (`irsi`) and numbers (`1`) included. */
const TEMPLATE_CLASS: Readonly<Record<string, ConjugationClass>> = {
  "1": "are",
  are: "are",
  arsi: "are",
  care: "care",
  carsi: "care",
  gare: "gare",
  garsi: "gare",
  ciare: "ciare",
  ciarsi: "ciare",
  giare: "giare",
  giarsi: "giare",
  iare: "iare",
  iarsi: "iare",
  "3": "ire",
  ire: "ire",
  irsi: "ire",
  "ire-b": "ire-b",
  "irsi-b": "ire-b",
};

/** What a class's infinitive adds to its stem, and the letters the stem must end in. */
const INFINITIVE: Readonly<Record<ConjugationClass, { ending: string; stemEnds: RegExp }>> = {
  are: { ending: "are", stemEnds: /\p{L}$/u },
  care: { ending: "are", stemEnds: /c$/u },
  gare: { ending: "are", stemEnds: /g$/u },
  ciare: { ending: "iare", stemEnds: /c$/u },
  giare: { ending: "iare", stemEnds: /g$/u },
  iare: { ending: "are", stemEnds: /i$/u },
  ire: { ending: "ire", stemEnds: /\p{L}$/u },
  "ire-b": { ending: "ire", stemEnds: /\p{L}$/u },
};

/** The class a pinned call names for one of `verb`'s bases, or why it names none this rule reads. */
function classOfCall(verb: PronominalVerb, page: PinnedTemplateCall): ClassAnswer {
  const [call] = templatesOn(page.call.replace(/\n/g, ""));
  const declined: ClassAnswer = { kind: "declined", reason: "template-not-read", page };
  if (call === undefined || call.name !== "It-conj" || Object.keys(call.named).length > 0 || call.positional.length > 3) return declined;
  const [stem, type] = call.positional;
  const conjugationClass = TEMPLATE_CLASS[type ?? ""];
  if (stem === undefined || conjugationClass === undefined || !INFINITIVE[conjugationClass].stemEnds.test(stem)) return declined;
  const base = `${stem}${INFINITIVE[conjugationClass].ending}`;
  if (!verb.bases.includes(base)) return declined;
  return { kind: "settled", conjugationClass, stem, base, evidence: { kind: "template", page } };
}

/** Whether a gloss says what it is a form of: "seconda persona singolare dell'indicativo presente di traversare". */
const isFormGloss = (gloss: string): boolean => glossBase(gloss.replace(/,/g, ""))?.formOpening === true;

/** The verbs that do not follow their conjugation, and the prefixes their compounds take that a regular verb's ending can share. */
function irregularFamily(base: string): boolean {
  if (base.endsWith("trare")) return true; // attrarre, distrarre: `-trarsi` may be either
  const made = (root: string, prefix: (p: string) => boolean): boolean => base.endsWith(root) && prefix(base.slice(0, -root.length));
  return (
    made("andare", (p) => ["", "ri", "tras"].includes(p)) ||
    made("stare", (p) => ["", "ri", "sopra", "sovra"].includes(p)) ||
    made("dare", (p) => ["", "ri", "s"].includes(p)) ||
    made("fare", (p) => p === "" || /[aeiouàèéìòùs]$/u.test(p) || p === "contraf" || p === "sopraf")
  );
}

/** The class a first-conjugation base's ending settles, or why it settles none. */
function classOfEnding(base: string): ClassAnswer {
  if (irregularFamily(base)) return { kind: "declined", reason: "irregular-family" };
  const stem = base.slice(0, -"are".length);
  const settled = (conjugationClass: ConjugationClass, stemOf: string, ending: Extract<ClassEvidence, { kind: "ending" }>["ending"]): ClassAnswer => ({
    kind: "settled",
    conjugationClass,
    stem: stemOf,
    base,
    evidence: { kind: "ending", base, ending },
  });
  if (base.endsWith("ciare") && base !== "sciare") return settled("ciare", base.slice(0, -"iare".length), "-ciare");
  if (/giare$/u.test(base) && !/gliare$/u.test(base)) return settled("giare", base.slice(0, -"iare".length), "-giare");
  if (/gliare$/u.test(base)) return settled("iare", stem, "-gliare");
  if (/iare$/u.test(base)) return { kind: "declined", reason: "iare-stress" };
  if (/care$/u.test(base)) return settled("care", stem, "-care");
  if (/gare$/u.test(base)) return settled("gare", stem, "-gare");
  return settled("are", stem, "-are");
}

/**
 * The regular class of `verb`, a pronominal verb whose base verb has no record
 * with a table, read off its record's glosses and the pinned calls: a call on
 * its own Appendice page, else on a base verb's, else its ending; or why none
 * settles it.
 */
export function regularClassOf(verb: PronominalVerb, glosses: readonly string[], calls: TemplateCalls): ClassAnswer {
  if (glosses.length > 0 && glosses.every(isFormGloss)) return { kind: "declined", reason: "form-of-another-word" };
  for (const title of [verb.word, ...verb.bases].map(conjugationPageOf)) {
    const page = calls[title];
    if (page !== undefined) return classOfCall(verb, page);
  }
  const [base] = verb.bases;
  if (base.endsWith("are")) return classOfEnding(base);
  if (base.endsWith("ire")) return { kind: "declined", reason: "ire-isc" };
  return { kind: "declined", reason: "second-conjugation" };
}

/** One cell this rule built for a base verb: its spelling, its tags as the source would write them, and the class evidence. */
export interface RegularCell extends VerbFormTags {
  spelling: string;
  /** Its place in the built table, which no other cell of it shares. */
  index: number;
  rule: typeof REGULAR_CONJUGATION_RULE;
  evidence: ClassEvidence;
}

type Six = readonly [string, string, string, string, string, string];

/** The endings a class adds to its stem, slot by slot, as Modulo:It-conj writes them. */
interface Endings {
  gerund: string;
  presentParticiple: string;
  pastParticiple: string;
  infinitive: string;
  present: Six;
  imperfect: Six;
  pastRemote: Six;
  future: Six;
  conditional: Six;
  subjunctive: Six;
  subjunctiveImperfect: Six;
  /** tu, lui, noi, voi, loro. */
  imperative: readonly [string, string, string, string, string];
}

const FIRST: Endings = {
  gerund: "ando",
  presentParticiple: "ante",
  pastParticiple: "ato",
  infinitive: "are",
  present: ["o", "i", "a", "iamo", "ate", "ano"],
  imperfect: ["avo", "avi", "ava", "avamo", "avate", "avano"],
  pastRemote: ["ai", "asti", "ò", "ammo", "aste", "arono"],
  future: ["erò", "erai", "erà", "eremo", "erete", "eranno"],
  conditional: ["erei", "eresti", "erebbe", "eremmo", "ereste", "erebbero"],
  subjunctive: ["i", "i", "i", "iamo", "iate", "ino"],
  subjunctiveImperfect: ["assi", "assi", "asse", "assimo", "aste", "assero"],
  imperative: ["a", "i", "iamo", "ate", "ino"],
};

const WITH_H: Endings = {
  ...FIRST,
  present: ["o", "hi", "a", "hiamo", "ate", "ano"],
  future: ["herò", "herai", "herà", "heremo", "herete", "heranno"],
  conditional: ["herei", "heresti", "herebbe", "heremmo", "hereste", "herebbero"],
  subjunctive: ["hi", "hi", "hi", "hiamo", "hiate", "hino"],
  imperative: ["a", "hi", "hiamo", "ate", "hino"],
};

/** `ciare`, `giare`: the stem without its `i`, which every ending but those in `e` and `i` brings back. */
const SOFT: Endings = {
  gerund: "iando",
  presentParticiple: "iante",
  pastParticiple: "iato",
  infinitive: "iare",
  present: ["io", "i", "ia", "iamo", "iate", "iano"],
  imperfect: ["iavo", "iavi", "iava", "iavamo", "iavate", "iavano"],
  pastRemote: ["iai", "iasti", "iò", "iammo", "iaste", "iarono"],
  future: FIRST.future,
  conditional: FIRST.conditional,
  subjunctive: ["i", "i", "i", "iamo", "iate", "ino"],
  subjunctiveImperfect: ["iassi", "iassi", "iasse", "iassimo", "iaste", "iassero"],
  imperative: ["ia", "i", "iamo", "iate", "ino"],
};

/** `iare`: the stem keeps its `i`, and an ending in `i` loses its own. */
const UNSTRESSED_I: Endings = {
  ...FIRST,
  present: ["o", "", "a", "amo", "ate", "ano"],
  subjunctive: ["", "", "", "amo", "ate", "no"],
  imperative: ["a", "", "amo", "ate", "no"],
};

const THIRD: Endings = {
  gerund: "endo",
  presentParticiple: "ente",
  pastParticiple: "ito",
  infinitive: "ire",
  present: ["o", "i", "e", "iamo", "ite", "ono"],
  imperfect: ["ivo", "ivi", "iva", "ivamo", "ivate", "ivano"],
  pastRemote: ["ii", "isti", "ì", "immo", "iste", "irono"],
  future: ["irò", "irai", "irà", "iremo", "irete", "iranno"],
  conditional: ["irei", "iresti", "irebbe", "iremmo", "ireste", "irebbero"],
  subjunctive: ["a", "a", "a", "iamo", "iate", "ano"],
  subjunctiveImperfect: ["issi", "issi", "isse", "issimo", "iste", "issero"],
  imperative: ["i", "a", "iamo", "ite", "ano"],
};

const INCHOATIVE: Endings = {
  ...THIRD,
  present: ["isco", "isci", "isce", "iamo", "ite", "iscono"],
  subjunctive: ["isca", "isca", "isca", "iamo", "iate", "iscano"],
  imperative: ["isci", "isca", "iamo", "ite", "iscano"],
};

const ENDINGS: Readonly<Record<ConjugationClass, Endings>> = {
  are: FIRST,
  care: WITH_H,
  gare: WITH_H,
  ciare: SOFT,
  giare: SOFT,
  iare: UNSTRESSED_I,
  ire: THIRD,
  "ire-b": INCHOATIVE,
};

/** Avere, by the compound tense it builds, as a record's table writes it. */
const AVERE: readonly { tags: readonly string[]; subjunctive: boolean; conditional: boolean; forms: Six }[] = [
  { tags: ["past", "perfect"], subjunctive: false, conditional: false, forms: ["ho", "hai", "ha", "abbiamo", "avete", "hanno"] },
  { tags: ["pluperfect", "past", "perfect"], subjunctive: false, conditional: false, forms: ["avevo", "avevi", "aveva", "avevamo", "avevate", "avevano"] },
  { tags: ["historic", "past-remote"], subjunctive: false, conditional: false, forms: ["ebbi", "avesti", "ebbe", "avemmo", "aveste", "ebbero"] },
  { tags: ["future", "perfect"], subjunctive: false, conditional: false, forms: ["avrò", "avrai", "avrà", "avremo", "avrete", "avranno"] },
  { tags: ["past"], subjunctive: false, conditional: true, forms: ["avrei", "avresti", "avrebbe", "avremmo", "avreste", "avrebbero"] },
  { tags: ["past"], subjunctive: true, conditional: false, forms: ["abbia", "abbia", "abbia", "abbiamo", "abbiate", "abbiano"] },
  { tags: ["past", "perfect"], subjunctive: true, conditional: false, forms: ["avessi", "avessi", "avesse", "avessimo", "aveste", "avessero"] },
];

const NUMBERS = ["singular", "singular", "singular", "plural", "plural", "plural"] as const;
const PERSONS = ["first-person", "second-person", "third-person", "first-person", "second-person", "third-person"] as const;
const PRONOUNS: Six = ["io", "tu", "lui/lei", "noi", "voi", "essi/esse"];
const CHE: Six = ["che io", "che tu", "che lui/che lei", "che noi", "che voi", "che essi/che esse"];

/**
 * The base verb's cells for a settled class, in the order a record's table
 * lists them: auxiliary, gerund, participles, the indicative's simple and
 * compound tenses, the conditional, the subjunctive, the imperative. The
 * auxiliary is avere, as every regular table of these classes writes it;
 * `it-pronominal-conjugation/v1` turns it, and every compound tense, to essere.
 */
export function regularCells(settled: SettledClass): RegularCell[] {
  const { stem, evidence } = settled;
  const endings = ENDINGS[settled.conjugationClass];
  const cells: Omit<RegularCell, "index" | "rule" | "evidence">[] = [];
  const add = (spelling: string, tags: readonly string[], rawTags: readonly string[] = []) => cells.push({ spelling, tags, rawTags });
  const pastParticiple = `${stem}${endings.pastParticiple}`;
  const personal = (six: Six, tense: readonly string[], compound?: Six) =>
    six.forEach((ending, i) => add(compound === undefined ? `${stem}${ending}` : `${compound[i]} ${pastParticiple}`, [NUMBERS[i], PERSONS[i], ...tense], [PRONOUNS[i]]));
  const pronouned = (six: Six, tense: readonly string[], pronouns: Six, compound?: Six) =>
    six.forEach((ending, i) => add(compound === undefined ? `${stem}${ending}` : `${compound[i]} ${pastParticiple}`, tense, [pronouns[i]]));

  add("avere", ["auxiliary"]);
  add(`${stem}${endings.gerund}`, ["gerund"]);
  add(`${stem}${endings.presentParticiple}`, ["present", "participle"]);
  add(pastParticiple, ["past", "participle"]);
  personal(endings.present, ["present"]);
  personal(endings.imperfect, ["imperfect"]);
  personal(endings.pastRemote, ["past-remote"]);
  personal(endings.future, ["future"]);
  for (const avere of AVERE.filter((one) => !one.subjunctive && !one.conditional)) personal(avere.forms, avere.tags, avere.forms);
  pronouned(endings.conditional, ["present"], PRONOUNS);
  for (const avere of AVERE.filter((one) => one.conditional)) pronouned(avere.forms, avere.tags, PRONOUNS, avere.forms);
  pronouned(endings.subjunctive, ["present"], CHE);
  pronouned(endings.subjunctiveImperfect, ["imperfect"], CHE);
  for (const avere of AVERE.filter((one) => one.subjunctive)) pronouned(avere.forms, avere.tags, CHE, avere.forms);
  const [tu, lui, noi, voi, loro] = endings.imperative;
  add(`${stem}${tu}`, ["imperative"], ["tu"]);
  add(`non ${stem}${endings.infinitive}`, ["imperative"], ["tu"]);
  add(`${stem}${lui}`, ["imperative"], ["lui/lei"]);
  add(`${stem}${noi}`, ["imperative"], ["noi"]);
  add(`${stem}${voi}`, ["imperative"], ["voi"]);
  add(`${stem}${loro}`, ["imperative"], ["essi/esse"]);
  return cells.map((cell, index) => ({ ...cell, index, rule: REGULAR_CONJUGATION_RULE, evidence }));
}
