// Hand-kept conjugation tables: the base verb table of a pronominal verb whose
// class the source does not settle, kept by hand beside the source data on a
// ruling, each citing the en.wiktionary revision that shows it (ADR 0031's
// 2026-10-16 amendment, #844).
//
// `it-regular-conjugation/v1` (regularConjugation.ts) gives a pronominal verb
// with no base table the regular cells of the class the source settles, and
// declines the rest: an `-ire` verb with no call (`-isc-` or not), another
// `-iare` (`obliare`, *oblìo*), the second conjugation, the verbs made on
// `fare`, `dare` and `trarre`, and a call that overrides forms. Huey ruled on
// 2026-10-16 that such a verb gets a hand-kept table citing an en.wiktionary
// revision, or is listed for him, and is never guessed
// (https://github.com/povlabs/lexema/issues/838#issuecomment-6214333127); asked
// on #844 "Should I start the 24 hand-added tables next?", he answered "yes".
//
// A table keeps what the cited revision's `{{it-conj}}` call shows, in one of
// two ways:
//
// - **A class**, where the call names a regular one Lexema builds:
//   `{{it-conj|+isc}}` on `impadronirsi` is `ire-b` on `impadron-`, and
//   `regularCells`' own cells follow (*mi impadronisco*).
// - **The cells**, where it does not: the base verb's simple forms, slot by
//   slot, as the revision's table writes them (`avvedere`: *avvidi*,
//   *avvisto, avveduto*).
//
// Either way the table is a base verb's, on avere, and
// `it-pronominal-conjugation/v1` builds the pronominal table on it exactly as
// on a record's: pronouns, essere, and `it-essere-agreement/v2` on the
// compound cells. test/handKeptTables.test.ts checks every built cell against
// the table each cited call expands to, pinned in fixtures/hand-kept-tables/.
// The page shows it with no mark (ADR 0016).
//
// A table keys to nothing in the source and is not stored: the seed writes no
// row for it, and the page reads it from this list when it is built. It never
// edits `source_record_json` or any imported row.

import { evidenceUrl } from "./curatedCorrections.js";
import { PERMANENT_LINK, RULING, type EnWiktionaryEvidence } from "./handKeptReadings.js";
import { pronominalVerb } from "./pronominalConjugation.js";
import { classParadigm, infinitiveOf, paradigmCells, type ConjugationClass, type Paradigm, type ParadigmCell } from "./regularConjugation.js";

/** What a table keeps: a regular class on a stem, or the base verb's own simple forms. */
export type KeptConjugation = { kind: "class"; conjugationClass: ConjugationClass; stem: string } | { kind: "cells"; paradigm: Paradigm };

/** What a hand-kept table is made from; `handKeptTable` checks it. */
export interface HandKeptTableSpec {
  /** The pronominal verb whose page draws the table: `impadronirsi`. */
  verb: string;
  /** The base verb the table conjugates, one of `pronominalVerb(verb).bases`: `impadronire`. */
  base: string;
  conjugation: KeptConjugation;
  /**
   * At least one revision, of the verb's page or the base's. `shows` is the
   * revision's `{{it-conj}}` call, verbatim: `{{it-conj|+isc}}`.
   */
  evidence: readonly [EnWiktionaryEvidence, ...EnWiktionaryEvidence[]];
  /** The ruling that added it: a comment on a povlabs/lexema issue. */
  ruling: string;
}

declare const checked: unique symbol;

/** A hand-kept table `handKeptTable` checked; no other value has this type. */
export type HandKeptTable = Readonly<HandKeptTableSpec> & { readonly [checked]: true };

/** Why a spec is not a hand-kept table. */
export class InvalidHandKeptTable extends Error {
  override readonly name = "InvalidHandKeptTable";
}

/** A conjugation call as a revision writes it, `{{it-conj|+isc}}`; `it-conj-rfc` passes its argument to it. */
const CALL = /^\{\{it-conj(?:-rfc)?\|[^{}]*\}\}$/u;

/** One spelling of a form: letters and an apostrophe (`assuefa'`), several joined by `, `. */
const FORMS = /^[\p{L}']+(?:, [\p{L}']+)*$/u;

const slotsOf = (paradigm: Paradigm): string[] => [
  paradigm.gerund,
  paradigm.presentParticiple,
  paradigm.pastParticiple,
  ...paradigm.present,
  ...paradigm.imperfect,
  ...paradigm.pastRemote,
  ...paradigm.future,
  ...paradigm.conditional,
  ...paradigm.subjunctive,
  ...paradigm.subjunctiveImperfect,
  ...paradigm.imperative,
];

/**
 * The only way to make a `HandKeptTable`. It refuses a spec whose verb is not
 * pronominal or whose base is not that verb's, a class that does not write the
 * base on its stem, kept cells of another infinitive or with a slot that is not
 * a form, evidence that is not a permanent link to an en.wiktionary revision of
 * the verb or the base showing its `{{it-conj}}` call, and a spec with no
 * ruling, so none of these is a value the list can hold.
 */
export function handKeptTable(spec: HandKeptTableSpec): HandKeptTable {
  const refuse = (why: string): never => {
    throw new InvalidHandKeptTable(`hand-kept table ${JSON.stringify(spec.verb)}: ${why}`);
  };
  const verb = pronominalVerb(spec.verb);
  if (verb === undefined) refuse("the verb is not pronominal");
  if (!verb?.bases.includes(spec.base)) refuse(`${spec.base} is not a base verb of ${spec.verb}`);
  const { conjugation } = spec;
  if (conjugation.kind === "class" && infinitiveOf(conjugation.conjugationClass, conjugation.stem) !== spec.base) {
    refuse(`${conjugation.stem} in ${conjugation.conjugationClass} is not ${spec.base}`);
  }
  if (conjugation.kind === "cells") {
    if (conjugation.paradigm.infinitive !== spec.base) refuse(`its cells conjugate ${conjugation.paradigm.infinitive}, not ${spec.base}`);
    const bad = slotsOf(conjugation.paradigm).find((forms) => !FORMS.test(forms));
    if (bad !== undefined) refuse(`a cell is not a form: ${JSON.stringify(bad)}`);
  }
  if (spec.evidence.length === 0) refuse("it cites no revision");
  for (const evidence of spec.evidence) {
    if (evidence.wiki !== "en.wiktionary.org" || !PERMANENT_LINK.test(evidenceUrl(evidence))) refuse(`not an en.wiktionary permanent link: ${evidenceUrl(evidence)}`);
    if (evidence.title !== spec.verb && evidence.title !== spec.base) refuse(`${evidence.title} is neither the verb nor its base`);
    if (!CALL.test(evidence.shows) || Number.isNaN(Date.parse(evidence.timestamp))) refuse("its evidence shows no conjugation call, or has no timestamp");
  }
  if (!RULING.test(spec.ruling)) refuse(`no ruling comment: ${spec.ruling}`);
  return Object.freeze({ ...spec }) as HandKeptTable;
}

/** One base cell of a hand-kept table: a paradigm cell, and the table that keeps it. */
export interface HandKeptCell extends ParadigmCell {
  kept: HandKeptTable;
}

/** The base verb's cells a table keeps, in the order a record's table lists them, on avere. */
export function handKeptCells(table: HandKeptTable): HandKeptCell[] {
  const { conjugation } = table;
  const paradigm = conjugation.kind === "class" ? classParadigm(conjugation.conjugationClass, conjugation.stem) : conjugation.paradigm;
  return paradigmCells(paradigm).map((cell) => ({ ...cell, kept: table }));
}

/** `tables` as a list: refused when two keep one verb, since a page draws one table. */
function handKeptList(tables: readonly HandKeptTable[]): ReadonlyMap<string, HandKeptTable> {
  const byVerb = new Map<string, HandKeptTable>();
  for (const table of tables) {
    if (byVerb.has(table.verb)) throw new InvalidHandKeptTable(`the list keeps ${table.verb} twice`);
    byVerb.set(table.verb, table);
  }
  return byVerb;
}

const RULING_838 = "https://github.com/povlabs/lexema/issues/838#issuecomment-6214333127";

const enWiktionary = (title: string, revisionId: number, timestamp: string, shows: string): EnWiktionaryEvidence => ({
  wiki: "en.wiktionary.org",
  title,
  revisionId,
  timestamp,
  shows,
});

const keptClass = (verb: string, base: string, conjugationClass: ConjugationClass, stem: string, evidence: EnWiktionaryEvidence): HandKeptTable =>
  handKeptTable({ verb, base, conjugation: { kind: "class", conjugationClass, stem }, evidence: [evidence], ruling: RULING_838 });

const keptCells = (verb: string, paradigm: Paradigm, evidence: readonly [EnWiktionaryEvidence, ...EnWiktionaryEvidence[]]): HandKeptTable =>
  handKeptTable({ verb, base: paradigm.infinitive, conjugation: { kind: "cells", paradigm }, evidence, ruling: RULING_838 });

/**
 * The committed list, by verb. Add a table only with its evidence, and only on
 * a ruling. Three of the 24 verbs #844 lists have none: en.wiktionary has no
 * page for `attremirsi`, `sdarsi` or `inostrarsi`, nor for their base verbs,
 * so they are listed for Huey.
 */
export const HAND_KEPT_TABLES: ReadonlyMap<string, HandKeptTable> = handKeptList([
  // `-ire`: the call says whether the verb takes `-isc-`.
  keptClass("impadronirsi", "impadronire", "ire-b", "impadron", enWiktionary("impadronirsi", 91778278, "2026-08-02T12:28:45Z", "{{it-conj|+isc}}")),
  keptClass("appassirsi", "appassire", "ire-b", "appass", enWiktionary("appassire", 90569343, "2026-05-09T13:29:12Z", "{{it-conj|e[intransitive]:a[transitive]/+isc}}")),
  keptClass("assennirsi", "assennire", "ire-b", "assenn", enWiktionary("assennire", 71366604, "2023-02-22T08:29:41Z", "{{it-conj-rfc|a/+isc}}")),
  keptClass("immusonirsi", "immusonire", "ire-b", "immuson", enWiktionary("immusonirsi", 71366912, "2023-02-22T08:34:15Z", "{{it-conj|+isc}}")),
  keptClass("informicolirsi", "informicolire", "ire-b", "informicol", enWiktionary("informicolirsi", 75047050, "2023-07-03T19:27:52Z", "{{it-conj|+isc}}")),
  keptClass("susseguirsi", "susseguire", "ire", "sussegu", enWiktionary("susseguirsi", 90583647, "2026-05-09T17:36:16Z", "{{it-conj|@}}")),
  // `-iare` with an unstressed `i`: the call puts the stress before it (`à`, `ù`, `ì-`).
  keptClass("adastiarsi", "adastiare", "iare", "adasti", enWiktionary("adastiarsi", 71027279, "2023-01-23T07:15:37Z", "{{it-conj|à}}")),
  keptClass("appollaiarsi", "appollaiare", "iare", "appollai", enWiktionary("appollaiarsi", 71105779, "2023-01-31T05:34:22Z", "{{it-conj|à}}")),
  keptClass("incacchiarsi", "incacchiare", "iare", "incacchi", enWiktionary("incacchiarsi", 71106904, "2023-01-31T05:52:39Z", "{{it-conj|à}}")),
  keptClass("industriarsi", "industriare", "iare", "industri", enWiktionary("industriarsi", 92190948, "2026-08-24T04:13:58Z", "{{it-conj|ù}}")),
  keptClass("infischiarsi", "infischiare", "iare", "infischi", enWiktionary("infischiarsi", 80612746, "2024-07-02T22:21:55Z", "{{it-conj|ì-}}")),
  // `-iare` with a stressed `i` (`ì`): oblìo, oblìi, no class Lexema builds.
  keptCells(
    "obliarsi",
    {
      infinitive: "obliare",
      gerund: "obliando",
      presentParticiple: "obliante",
      pastParticiple: "obliato",
      present: ["oblio", "oblii", "oblia", "obliamo", "obliate", "obliano"],
      imperfect: ["obliavo", "obliavi", "obliava", "obliavamo", "obliavate", "obliavano"],
      pastRemote: ["obliai", "obliasti", "obliò", "obliammo", "obliaste", "obliarono"],
      future: ["oblierò", "oblierai", "oblierà", "oblieremo", "oblierete", "oblieranno"],
      conditional: ["oblierei", "oblieresti", "oblierebbe", "oblieremmo", "obliereste", "oblierebbero"],
      subjunctive: ["oblii", "oblii", "oblii", "obliamo", "obliate", "obliino"],
      subjunctiveImperfect: ["obliassi", "obliassi", "obliasse", "obliassimo", "obliaste", "obliassero"],
      imperative: ["oblia", "oblii", "obliamo", "obliate", "obliino"],
    },
    [enWiktionary("obliarsi", 92175298, "2026-08-24T01:23:48Z", "{{it-conj|ì}}")],
  ),
  // The second conjugation: each verb's passato remoto and participle are its own.
  keptCells(
    "avvalersi",
    {
      infinitive: "avvalere",
      gerund: "avvalendo",
      presentParticiple: "avvalente",
      pastParticiple: "avvalso",
      present: ["avvalgo", "avvali", "avvale", "avvaliamo", "avvalete", "avvalgono"],
      imperfect: ["avvalevo", "avvalevi", "avvaleva", "avvalevamo", "avvalevate", "avvalevano"],
      pastRemote: ["avvalsi", "avvalesti", "avvalse", "avvalemmo", "avvaleste", "avvalsero"],
      future: ["avvarrò", "avvarrai", "avvarrà", "avvarremo", "avvarrete", "avvarranno"],
      conditional: ["avvarrei", "avvarresti", "avvarrebbe", "avvarremmo", "avvarreste", "avvarrebbero"],
      subjunctive: ["avvalga", "avvalga", "avvalga", "avvaliamo", "avvaliate", "avvalgano"],
      subjunctiveImperfect: ["avvalessi", "avvalessi", "avvalesse", "avvalessimo", "avvaleste", "avvalessero"],
      imperative: ["avvali", "avvalga", "avvaliamo", "avvalete", "avvalgano"],
    },
    [enWiktionary("avvalersi", 80612794, "2024-07-02T22:23:18Z", "{{it-conj|/@}}")],
  ),
  keptCells(
    "avvedersi",
    {
      infinitive: "avvedere",
      gerund: "avvedendo",
      presentParticiple: "avvedente, avveggente",
      pastParticiple: "avvisto, avveduto",
      present: ["avvedo", "avvedi", "avvede", "avvediamo", "avvedete", "avvedono"],
      imperfect: ["avvedevo", "avvedevi", "avvedeva", "avvedevamo", "avvedevate", "avvedevano"],
      pastRemote: ["avvidi", "avvedesti", "avvide", "avvedemmo", "avvedeste", "avvidero"],
      future: ["avvedrò", "avvedrai", "avvedrà", "avvedremo", "avvedrete", "avvedranno"],
      conditional: ["avvedrei", "avvedresti", "avvedrebbe", "avvedremmo", "avvedreste", "avvedrebbero"],
      subjunctive: ["avveda", "avveda", "avveda", "avvediamo", "avvediate", "avvedano"],
      subjunctiveImperfect: ["avvedessi", "avvedessi", "avvedesse", "avvedessimo", "avvedeste", "avvedessero"],
      imperative: ["avvedi", "avveda", "avvediamo", "avvedete", "avvedano"],
    },
    [enWiktionary("avvedersi", 67977311, "2022-07-17T19:50:46Z", "{{it-conj|/@}}")],
  ),
  keptCells(
    "genuflettersi",
    {
      infinitive: "genuflettere",
      gerund: "genuflettendo",
      presentParticiple: "genuflettente",
      pastParticiple: "genuflesso",
      present: ["genufletto", "genufletti", "genuflette", "genuflettiamo", "genuflettete", "genuflettono"],
      imperfect: ["genuflettevo", "genuflettevi", "genufletteva", "genuflettevamo", "genuflettevate", "genuflettevano"],
      pastRemote: ["genuflettei, genuflessi", "genuflettesti", "genufletté, genuflesse", "genuflettemmo", "genufletteste", "genufletterono, genuflessero"],
      future: ["genufletterò", "genufletterai", "genufletterà", "genufletteremo", "genufletterete", "genufletteranno"],
      conditional: ["genufletterei", "genufletteresti", "genufletterebbe", "genufletteremmo", "genuflettereste", "genufletterebbero"],
      subjunctive: ["genufletta", "genufletta", "genufletta", "genuflettiamo", "genuflettiate", "genuflettano"],
      subjunctiveImperfect: ["genuflettessi", "genuflettessi", "genuflettesse", "genuflettessimo", "genufletteste", "genuflettessero"],
      imperative: ["genufletti", "genufletta", "genuflettiamo", "genuflettete", "genuflettano"],
    },
    [enWiktionary("genuflettersi", 93133732, "2026-09-30T09:16:46Z", "{{it-conj|\\@}}")],
  ),
  keptCells(
    "imbattersi",
    {
      infinitive: "imbattere",
      gerund: "imbattendo",
      presentParticiple: "imbattente",
      pastParticiple: "imbattuto",
      present: ["imbatto", "imbatti", "imbatte", "imbattiamo", "imbattete", "imbattono"],
      imperfect: ["imbattevo", "imbattevi", "imbatteva", "imbattevamo", "imbattevate", "imbattevano"],
      pastRemote: ["imbattei", "imbattesti", "imbatté", "imbattemmo", "imbatteste", "imbatterono"],
      future: ["imbatterò", "imbatterai", "imbatterà", "imbatteremo", "imbatterete", "imbatteranno"],
      conditional: ["imbatterei", "imbatteresti", "imbatterebbe", "imbatteremmo", "imbattereste", "imbatterebbero"],
      subjunctive: ["imbatta", "imbatta", "imbatta", "imbattiamo", "imbattiate", "imbattano"],
      subjunctiveImperfect: ["imbattessi", "imbattessi", "imbattesse", "imbattessimo", "imbatteste", "imbattessero"],
      imperative: ["imbatti", "imbatta", "imbattiamo", "imbattete", "imbattano"],
    },
    [enWiktionary("imbattersi", 90564438, "2026-05-09T11:48:36Z", "{{it-conj|\\@}}")],
  ),
  keptCells(
    "ravvedersi",
    {
      infinitive: "ravvedere",
      gerund: "ravvedendo",
      presentParticiple: "ravvedente, ravveggente",
      pastParticiple: "ravveduto",
      present: ["ravvedo", "ravvedi", "ravvede", "ravvediamo", "ravvedete", "ravvedono"],
      imperfect: ["ravvedevo", "ravvedevi", "ravvedeva", "ravvedevamo", "ravvedevate", "ravvedevano"],
      pastRemote: ["ravvidi", "ravvedesti", "ravvide", "ravvedemmo", "ravvedeste", "ravvidero"],
      future: ["ravvedrò, ravvederò", "ravvedrai, ravvederai", "ravvedrà, ravvederà", "ravvedremo, ravvederemo", "ravvedrete, ravvederete", "ravvedranno, ravvederanno"],
      conditional: [
        "ravvedrei, ravvederei",
        "ravvedresti, ravvederesti",
        "ravvedrebbe, ravvederebbe",
        "ravvedremmo, ravvederemmo",
        "ravvedreste, ravvedereste",
        "ravvedrebbero, ravvederebbero",
      ],
      subjunctive: ["ravveda", "ravveda", "ravveda", "ravvediamo", "ravvediate", "ravvedano"],
      subjunctiveImperfect: ["ravvedessi", "ravvedessi", "ravvedesse", "ravvedessimo", "ravvedeste", "ravvedessero"],
      imperative: ["ravvedi", "ravveda", "ravvediamo", "ravvedete", "ravvedano"],
    },
    [enWiktionary("ravvedersi", 90577471, "2026-05-09T15:58:49Z", "{{it-conj|/@}}")],
  ),
  keptCells(
    "rivalersi",
    {
      infinitive: "rivalere",
      gerund: "rivalendo",
      presentParticiple: "rivalente",
      pastParticiple: "rivalso",
      present: ["rivalgo", "rivali", "rivale", "rivaliamo", "rivalete", "rivalgono"],
      imperfect: ["rivalevo", "rivalevi", "rivaleva", "rivalevamo", "rivalevate", "rivalevano"],
      pastRemote: ["rivalsi", "rivalesti", "rivalse", "rivalemmo", "rivaleste", "rivalsero"],
      future: ["rivarrò", "rivarrai", "rivarrà", "rivarremo", "rivarrete", "rivarranno"],
      conditional: ["rivarrei", "rivarresti", "rivarrebbe", "rivarremmo", "rivarreste", "rivarrebbero"],
      subjunctive: ["rivalga", "rivalga", "rivalga", "rivaliamo", "rivaliate", "rivalgano"],
      subjunctiveImperfect: ["rivalessi", "rivalessi", "rivalesse", "rivalessimo", "rivaleste", "rivalessero"],
      imperative: ["rivali", "rivalga", "rivaliamo", "rivalete", "rivalgano"],
    },
    [enWiktionary("rivalersi", 93588532, "2026-10-15T06:56:57Z", "{{it-conj|/@}}")],
  ),
  // A call that overrides a form: prefisso, prefissi.
  keptCells(
    "prefiggersi",
    {
      infinitive: "prefiggere",
      gerund: "prefiggendo",
      presentParticiple: "prefiggente",
      pastParticiple: "prefisso",
      present: ["prefiggo", "prefiggi", "prefigge", "prefiggiamo", "prefiggete", "prefiggono"],
      imperfect: ["prefiggevo", "prefiggevi", "prefiggeva", "prefiggevamo", "prefiggevate", "prefiggevano"],
      pastRemote: ["prefissi", "prefiggesti", "prefisse", "prefiggemmo", "prefiggeste", "prefissero"],
      future: ["prefiggerò", "prefiggerai", "prefiggerà", "prefiggeremo", "prefiggerete", "prefiggeranno"],
      conditional: ["prefiggerei", "prefiggeresti", "prefiggerebbe", "prefiggeremmo", "prefiggereste", "prefiggerebbero"],
      subjunctive: ["prefigga", "prefigga", "prefigga", "prefiggiamo", "prefiggiate", "prefiggano"],
      subjunctiveImperfect: ["prefiggessi", "prefiggessi", "prefiggesse", "prefiggessimo", "prefiggeste", "prefiggessero"],
      imperative: ["prefiggi", "prefigga", "prefiggiamo", "prefiggete", "prefiggano"],
    },
    [enWiktionary("prefiggersi", 67588523, "2022-07-01T06:03:53Z", "{{it-conj|\\@}}")],
  ),
  // Made on fare. The base's page gives the short `tu` imperative, `assuefa'`, the pronoun doubles on (`assuefatti`).
  keptCells(
    "assuefarsi",
    {
      infinitive: "assuefare",
      gerund: "assuefacendo",
      presentParticiple: "assuefacente",
      pastParticiple: "assuefatto",
      present: ["assuefaccio", "assuefai", "assuefà", "assuefacciamo", "assuefate", "assuefanno"],
      imperfect: ["assuefacevo", "assuefacevi", "assuefaceva", "assuefacevamo", "assuefacevate", "assuefacevano"],
      pastRemote: ["assuefeci", "assuefacesti", "assuefece", "assuefacemmo", "assuefaceste", "assuefecero"],
      future: ["assuefarò", "assuefarai", "assuefarà", "assuefaremo", "assuefarete", "assuefaranno"],
      conditional: ["assuefarei", "assuefaresti", "assuefarebbe", "assuefaremmo", "assuefareste", "assuefarebbero"],
      subjunctive: ["assuefaccia", "assuefaccia", "assuefaccia", "assuefacciamo", "assuefacciate", "assuefacciano"],
      subjunctiveImperfect: ["assuefacessi", "assuefacessi", "assuefacesse", "assuefacessimo", "assuefaceste", "assuefacessero"],
      imperative: ["assuefai, assuefa'", "assuefaccia", "assuefacciamo", "assuefate", "assuefacciano"],
    },
    [enWiktionary("assuefarsi", 92141667, "2026-08-23T20:23:21Z", "{{it-conj|@}}"), enWiktionary("assuefare", 92141666, "2026-08-23T20:23:19Z", "{{it-conj|a/@}}")],
  ),
  keptCells(
    "stupefarsi",
    {
      infinitive: "stupefare",
      gerund: "stupefacendo",
      presentParticiple: "stupefacente",
      pastParticiple: "stupefatto",
      present: ["stupefaccio", "stupefai", "stupefà", "stupefacciamo", "stupefate", "stupefanno"],
      imperfect: ["stupefacevo", "stupefacevi", "stupefaceva", "stupefacevamo", "stupefacevate", "stupefacevano"],
      pastRemote: ["stupefeci", "stupefacesti", "stupefece", "stupefacemmo", "stupefaceste", "stupefecero"],
      future: ["stupefarò", "stupefarai", "stupefarà", "stupefaremo", "stupefarete", "stupefaranno"],
      conditional: ["stupefarei", "stupefaresti", "stupefarebbe", "stupefaremmo", "stupefareste", "stupefarebbero"],
      subjunctive: ["stupefaccia", "stupefaccia", "stupefaccia", "stupefacciamo", "stupefacciate", "stupefacciano"],
      subjunctiveImperfect: ["stupefacessi", "stupefacessi", "stupefacesse", "stupefacessimo", "stupefaceste", "stupefacessero"],
      imperative: ["stupefai, stupefa'", "stupefaccia", "stupefacciamo", "stupefate", "stupefacciano"],
    },
    [enWiktionary("stupefarsi", 77623586, "2024-01-13T23:49:02Z", "{{it-conj|@}}"), enWiktionary("stupefare", 93134607, "2026-09-30T09:19:41Z", "{{it-conj|a[transitive]:e[intransitive]/@}}")],
  ),
]);

/** The hand-kept table of a pronominal verb, or undefined when the list keeps none for it. */
export const handKeptTableOf = (verb: string): HandKeptTable | undefined => HAND_KEPT_TABLES.get(verb);
