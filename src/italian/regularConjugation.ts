// A regular verb's table, for a pronominal verb whose base verb has no record
// with one (#838), or for a verb no record of which has one (#841), by rule
// `it-regular-conjugation/v1`.
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
// A verb that is not pronominal takes the table only from its own page's call
// (#841): `verificare` from `{{It-conj|verific|care|avere}}`. Huey ruled on
// 2026-10-17 that such a verb gets the table pronominal verbs get when its own
// Appendice page has an `{{It-conj}}` call
// (https://github.com/povlabs/lexema/issues/841#issuecomment-6233282178); its
// ending alone settles nothing. Its compound tenses are built on the auxiliary
// the call names, as Modulo:It-conj builds them: avere (`verificare`), essere
// (`{{It-conj|affatic|care|essere}}`: `sono affaticato`, `siamo affaticati`),
// or both (`{{It-conj|scol|are|avere, come intr. essere}}`: `ho scolato` then
// `sono scolato` in each cell). Huey ruled on 2026-10-18 that the rule covers
// essere and both, following what the call states
// (https://github.com/povlabs/lexema/issues/873#issuecomment-6252704549). A
// call that names neither settles nothing. A pronominal verb's base cells are
// on avere whatever the call names, and `it-pronominal-conjugation/v1` turns
// every compound tense to essere.
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
  | "second-conjugation"
  /** A verb that is not pronominal, with no call pinned for its own page (#841). */
  | "no-own-call"
  /** A verb that is not pronominal, whose own call names neither avere nor essere as its auxiliary, or none at all (#873). */
  | "auxiliary-not-read";

/**
 * The auxiliary a built table's compound tenses are on, as Modulo:It-conj
 * (revision 4048685) reads a call's third parameter: exactly `avere`, exactly
 * `essere`, or any other text, on which it writes each compound cell twice,
 * the avere spelling then the essere one. The rule reads that other text only
 * when it names both (`avere, come intr. essere`), and keeps it as `named`:
 * the auxiliary cell spells it as a record's table does, one spelling per part
 * before `, ` (`avere`, `come intr. essere`).
 */
export type TableAuxiliary = { kind: "avere" } | { kind: "essere" } | { kind: "both"; named: string };

/** Avere: the auxiliary of every pronominal verb's base cells, and of a table an `-are` ending settles. */
export const ON_AVERE: TableAuxiliary = { kind: "avere" };

/** The auxiliary a call's third parameter names, or undefined when it names neither avere nor essere. */
export function tableAuxiliaryOf(named: string | undefined): TableAuxiliary | undefined {
  if (named === undefined) return undefined;
  if (named === "avere") return ON_AVERE;
  if (named === "essere") return { kind: "essere" };
  const words = new Set(named.split(/[^\p{L}]+/u));
  return words.has("avere") && words.has("essere") ? { kind: "both", named } : undefined;
}

/** A verb whose class the source settles: the class, the stem the template writes, its base verb, the auxiliary its compound tenses are on, and what settled it. */
export interface SettledClass {
  kind: "settled";
  conjugationClass: ConjugationClass;
  stem: string;
  base: string;
  auxiliary: TableAuxiliary;
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

/**
 * What a class's infinitive adds to its stem, and the letters the stem must
 * end in. Modulo:It-conj (revision 4048685 in the release's dump) writes
 * `care` and `gare` in one branch, and `ciare` and `giare` in another, on any
 * stem: `{{It-conj|vang|care|avere}}` is *vango, vanghi*, and
 * `{{It-conj|contegg|ciare|avere}}` *conteggio, conteggerò* (#841). So either
 * name takes a stem in `c` or `g`.
 */
const INFINITIVE: Readonly<Record<ConjugationClass, { ending: string; stemEnds: RegExp }>> = {
  are: { ending: "are", stemEnds: /\p{L}$/u },
  care: { ending: "are", stemEnds: /[cg]$/u },
  gare: { ending: "are", stemEnds: /[cg]$/u },
  ciare: { ending: "iare", stemEnds: /[cg]$/u },
  giare: { ending: "iare", stemEnds: /[cg]$/u },
  iare: { ending: "are", stemEnds: /i$/u },
  ire: { ending: "ire", stemEnds: /\p{L}$/u },
  "ire-b": { ending: "ire", stemEnds: /\p{L}$/u },
};

/** The infinitive a class writes on `stem` (`sment` + `ire-b` → `smentire`), or undefined when the stem cannot take that class. */
export function infinitiveOf(conjugationClass: ConjugationClass, stem: string): string | undefined {
  const { ending, stemEnds } = INFINITIVE[conjugationClass];
  return stemEnds.test(stem) ? `${stem}${ending}` : undefined;
}

/** A pinned call this rule reads: the class it names, the stem, the infinitive they write, and the auxiliary it names, as written. */
interface ReadCall {
  conjugationClass: ConjugationClass;
  stem: string;
  infinitive: string;
  auxiliary: string | undefined;
}

/** What a pinned call names, or undefined when it overrides a form or names a class this rule does not build. */
function readCall(page: PinnedTemplateCall): ReadCall | undefined {
  const [call] = templatesOn(page.call.replace(/\n/g, ""));
  if (call === undefined || call.name !== "It-conj" || Object.keys(call.named).length > 0 || call.positional.length > 3) return undefined;
  const [stem, type, auxiliary] = call.positional;
  const conjugationClass = TEMPLATE_CLASS[type ?? ""];
  const infinitive = stem === undefined || conjugationClass === undefined ? undefined : infinitiveOf(conjugationClass, stem);
  if (stem === undefined || conjugationClass === undefined || infinitive === undefined) return undefined;
  return { conjugationClass, stem, infinitive, auxiliary: auxiliary?.trim() };
}

/** The class a read call settles, its compound tenses on `auxiliary`, the call's page its evidence. */
const settledBy = (read: ReadCall, page: PinnedTemplateCall, auxiliary: TableAuxiliary): SettledClass => ({
  kind: "settled",
  conjugationClass: read.conjugationClass,
  stem: read.stem,
  base: read.infinitive,
  auxiliary,
  evidence: { kind: "template", page },
});

/** The class a pinned call names for one of a pronominal verb's bases, on avere, or why it names none this rule reads. */
function classOfCall(bases: readonly string[], page: PinnedTemplateCall): ClassAnswer {
  const read = readCall(page);
  return read === undefined || !bases.includes(read.infinitive) ? { kind: "declined", reason: "template-not-read", page } : settledBy(read, page, ON_AVERE);
}

/** Whether a gloss says what it is a form of: "seconda persona singolare dell'indicativo presente di traversare". */
const isFormGloss = (gloss: string): boolean => glossBase(gloss.replace(/,/g, ""))?.formOpening === true;

/**
 * Whether a record's every gloss says it is a form of another word. False for
 * no gloss. `regularClassOf` and `ownClassOf` decline on it
 * (`form-of-another-word`), and `isPronominalVerb` in
 * src/italian/pronominalPair.ts reads it to drop a form record (#860).
 */
export const isFormOfAnotherWord = (glosses: readonly string[]): boolean => glosses.length > 0 && glosses.every(isFormGloss);

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
    auxiliary: ON_AVERE,
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
  if (isFormOfAnotherWord(glosses)) return { kind: "declined", reason: "form-of-another-word" };
  for (const title of [verb.word, ...verb.bases].map(conjugationPageOf)) {
    const page = calls[title];
    if (page !== undefined) return classOfCall(verb.bases, page);
  }
  const [base] = verb.bases;
  if (base.endsWith("are")) return classOfEnding(base);
  if (base.endsWith("ire")) return { kind: "declined", reason: "ire-isc" };
  return { kind: "declined", reason: "second-conjugation" };
}

/**
 * The regular class of `word`, a verb that is not pronominal and no record of
 * which has a table (#841), read off its record's glosses and the call pinned
 * for its own Appendice page alone; or why none settles it. The call must
 * write `word` itself, and the table's compound tenses are on the auxiliary
 * it names (#873).
 */
export function ownClassOf(word: string, glosses: readonly string[], calls: TemplateCalls): ClassAnswer {
  if (isFormOfAnotherWord(glosses)) return { kind: "declined", reason: "form-of-another-word" };
  const page = calls[conjugationPageOf(word)];
  if (page === undefined) return { kind: "declined", reason: "no-own-call" };
  const read = readCall(page);
  if (read === undefined || read.infinitive !== word) return { kind: "declined", reason: "template-not-read", page };
  const auxiliary = tableAuxiliaryOf(read.auxiliary);
  return auxiliary === undefined ? { kind: "declined", reason: "auxiliary-not-read", page } : settledBy(read, page, auxiliary);
}

/** One base verb cell, as a record's table lists it: its spelling, its tags as the source would write them, and its place. */
export interface ParadigmCell extends VerbFormTags {
  spelling: string;
  /** Its place in the built table, which no other cell of it shares. */
  index: number;
}

/** One cell this rule built for a base verb: a paradigm cell, and the evidence that chose its class. */
export interface RegularCell extends ParadigmCell {
  rule: typeof REGULAR_CONJUGATION_RULE;
  evidence: ClassEvidence;
}

/** One form per row: io, tu, lui, noi, voi, loro. */
export type Six = readonly [string, string, string, string, string, string];

/**
 * A base verb's simple forms, slot by slot: everything its table holds but
 * the auxiliary, which builds each compound tense on `pastParticiple`. A slot may hold
 * several spellings, joined by `, ` as a record's cell joins them (`avvisto,
 * avveduto`).
 */
export interface Paradigm {
  infinitive: string;
  gerund: string;
  presentParticiple: string;
  pastParticiple: string;
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

/** The endings a class adds to its stem, slot by slot, as Modulo:It-conj writes them. */
type Endings = Paradigm;

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

/** A compound tense: its tags as a record's table writes them, and the forms of avere and of essere it is built on, io to loro. */
interface CompoundTense {
  tags: readonly string[];
  subjunctive: boolean;
  conditional: boolean;
  avere: Six;
  essere: Six;
}

/** Each compound tense, in the order a record's table lists them. */
const COMPOUND: readonly CompoundTense[] = [
  {
    tags: ["past", "perfect"],
    subjunctive: false,
    conditional: false,
    avere: ["ho", "hai", "ha", "abbiamo", "avete", "hanno"],
    essere: ["sono", "sei", "è", "siamo", "siete", "sono"],
  },
  {
    tags: ["pluperfect", "past", "perfect"],
    subjunctive: false,
    conditional: false,
    avere: ["avevo", "avevi", "aveva", "avevamo", "avevate", "avevano"],
    essere: ["ero", "eri", "era", "eravamo", "eravate", "erano"],
  },
  {
    tags: ["historic", "past-remote"],
    subjunctive: false,
    conditional: false,
    avere: ["ebbi", "avesti", "ebbe", "avemmo", "aveste", "ebbero"],
    essere: ["fui", "fosti", "fu", "fummo", "foste", "furono"],
  },
  {
    tags: ["future", "perfect"],
    subjunctive: false,
    conditional: false,
    avere: ["avrò", "avrai", "avrà", "avremo", "avrete", "avranno"],
    essere: ["sarò", "sarai", "sarà", "saremo", "sarete", "saranno"],
  },
  {
    tags: ["past"],
    subjunctive: false,
    conditional: true,
    avere: ["avrei", "avresti", "avrebbe", "avremmo", "avreste", "avrebbero"],
    essere: ["sarei", "saresti", "sarebbe", "saremmo", "sareste", "sarebbero"],
  },
  {
    tags: ["past"],
    subjunctive: true,
    conditional: false,
    avere: ["abbia", "abbia", "abbia", "abbiamo", "abbiate", "abbiano"],
    essere: ["sia", "sia", "sia", "siamo", "siate", "siano"],
  },
  {
    tags: ["past", "perfect"],
    subjunctive: true,
    conditional: false,
    avere: ["avessi", "avessi", "avesse", "avessimo", "aveste", "avessero"],
    essere: ["fossi", "fossi", "fosse", "fossimo", "foste", "fossero"],
  },
];

const NUMBERS = ["singular", "singular", "singular", "plural", "plural", "plural"] as const;
const PERSONS = ["first-person", "second-person", "third-person", "first-person", "second-person", "third-person"] as const;
const PRONOUNS: Six = ["io", "tu", "lui/lei", "noi", "voi", "essi/esse"];
const CHE: Six = ["che io", "che tu", "che lui/che lei", "che noi", "che voi", "che essi/che esse"];

/** What the auxiliary cell spells: `avere`, `essere`, or a call's two-auxiliary text cut where a record's table cuts it (`avere`, `come intr. essere`). */
const auxiliarySpellings = (auxiliary: TableAuxiliary): readonly string[] => (auxiliary.kind === "both" ? auxiliary.named.split(", ") : [auxiliary.kind]);

/**
 * A base verb's cells, in the order a record's table lists them: auxiliary,
 * gerund, participles, the indicative's simple and compound tenses, the
 * conditional, the subjunctive, the imperative. Each compound tense is on
 * `auxiliary`, as Modulo:It-conj builds it: on avere the participle stays as
 * it is (`abbiamo verificato`); on essere it is plural on a plural row
 * (`siamo affaticati`); on both, each cell holds the avere spelling, then the
 * essere one (`abbiamo scolato`, `siamo scolati`). A pronominal verb's base
 * cells are on avere, and `it-pronominal-conjugation/v1` turns the auxiliary,
 * and every compound tense, to essere.
 */
export function paradigmCells(paradigm: Paradigm, auxiliary: TableAuxiliary = ON_AVERE): ParadigmCell[] {
  const cells: Omit<ParadigmCell, "index">[] = [];
  const add = (spelling: string, tags: readonly string[], rawTags: readonly string[] = []) => cells.push({ spelling, tags, rawTags });
  const { pastParticiple } = paradigm;
  const pluralParticiple = `${pastParticiple.slice(0, -1)}i`;
  /** A compound tense's spellings on row `i`, one per auxiliary it is on, avere first. */
  const compoundAt = (tense: CompoundTense, i: number): string[] => {
    const onAvere = `${tense.avere[i]} ${pastParticiple}`;
    const onEssere = `${tense.essere[i]} ${NUMBERS[i] === "plural" ? pluralParticiple : pastParticiple}`;
    if (auxiliary.kind === "avere") return [onAvere];
    return auxiliary.kind === "essere" ? [onEssere] : [onAvere, onEssere];
  };
  const personal = (six: Six, tense: readonly string[]) => six.forEach((form, i) => add(form, [NUMBERS[i], PERSONS[i], ...tense], [PRONOUNS[i]]));
  const pronouned = (six: Six, tense: readonly string[], pronouns: Six) => six.forEach((form, i) => add(form, tense, [pronouns[i]]));
  const personalCompound = (tense: CompoundTense) =>
    PERSONS.forEach((person, i) => compoundAt(tense, i).forEach((spelling) => add(spelling, [NUMBERS[i], person, ...tense.tags], [PRONOUNS[i]])));
  const pronounedCompound = (tense: CompoundTense, pronouns: Six) =>
    pronouns.forEach((pronoun, i) => compoundAt(tense, i).forEach((spelling) => add(spelling, tense.tags, [pronoun])));

  for (const spelling of auxiliarySpellings(auxiliary)) add(spelling, ["auxiliary"]);
  add(paradigm.gerund, ["gerund"]);
  add(paradigm.presentParticiple, ["present", "participle"]);
  add(pastParticiple, ["past", "participle"]);
  personal(paradigm.present, ["present"]);
  personal(paradigm.imperfect, ["imperfect"]);
  personal(paradigm.pastRemote, ["past-remote"]);
  personal(paradigm.future, ["future"]);
  for (const tense of COMPOUND.filter((one) => !one.subjunctive && !one.conditional)) personalCompound(tense);
  pronouned(paradigm.conditional, ["present"], PRONOUNS);
  for (const tense of COMPOUND.filter((one) => one.conditional)) pronounedCompound(tense, PRONOUNS);
  pronouned(paradigm.subjunctive, ["present"], CHE);
  pronouned(paradigm.subjunctiveImperfect, ["imperfect"], CHE);
  for (const tense of COMPOUND.filter((one) => one.subjunctive)) pronounedCompound(tense, CHE);
  const [tu, lui, noi, voi, loro] = paradigm.imperative;
  add(tu, ["imperative"], ["tu"]);
  add(`non ${paradigm.infinitive}`, ["imperative"], ["tu"]);
  add(lui, ["imperative"], ["lui/lei"]);
  add(noi, ["imperative"], ["noi"]);
  add(voi, ["imperative"], ["voi"]);
  add(loro, ["imperative"], ["essi/esse"]);
  return cells.map((cell, index) => ({ ...cell, index }));
}

const withStem = <T extends readonly string[]>(stem: string, endings: T): T => endings.map((ending) => `${stem}${ending}`) as readonly string[] as T;

/** The paradigm of a regular class on `stem`: the stem before each of the class's endings. */
export function classParadigm(conjugationClass: ConjugationClass, stem: string): Paradigm {
  const endings = ENDINGS[conjugationClass];
  return {
    infinitive: `${stem}${endings.infinitive}`,
    gerund: `${stem}${endings.gerund}`,
    presentParticiple: `${stem}${endings.presentParticiple}`,
    pastParticiple: `${stem}${endings.pastParticiple}`,
    present: withStem(stem, endings.present),
    imperfect: withStem(stem, endings.imperfect),
    pastRemote: withStem(stem, endings.pastRemote),
    future: withStem(stem, endings.future),
    conditional: withStem(stem, endings.conditional),
    subjunctive: withStem(stem, endings.subjunctive),
    subjunctiveImperfect: withStem(stem, endings.subjunctiveImperfect),
    imperative: withStem(stem, endings.imperative),
  };
}

/** The base verb's cells for a settled class (`paradigmCells`), on its auxiliary, each carrying what settled it. */
export function regularCells(settled: SettledClass): RegularCell[] {
  const { evidence } = settled;
  return paradigmCells(classParadigm(settled.conjugationClass, settled.stem), settled.auxiliary).map((cell) => ({
    ...cell,
    rule: REGULAR_CONJUGATION_RULE,
    evidence,
  }));
}
