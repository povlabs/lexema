// The Italian a grammar value is shown in on a result (ADR 0015). A value
// with no entry here is shown as the source states it, never translated on
// the fly.

import type { GrammarClaim } from "@lexema/lookup/types.ts";

const ITALIAN: Readonly<Record<string, string>> = {
  masculine: "maschile",
  feminine: "femminile",
  singular: "singolare",
  plural: "plurale",
  invariable: "invariabile",
  "first-person": "prima persona",
  "second-person": "seconda persona",
  "third-person": "terza persona",
  present: "presente",
  imperfect: "imperfetto",
  past: "passato",
  "past-remote": "passato remoto",
  future: "futuro",
  perfect: "perfetto",
  pluperfect: "trapassato",
  imperative: "imperativo",
  infinitive: "infinito",
  gerund: "gerundio",
  participle: "participio",
  auxiliary: "ausiliare",
  positive: "positivo",
  comparative: "comparativo",
  superlative: "superlativo",
  absolute: "assoluto",
  reflexive: "riflessivo",
  pronominal: "pronominale",
};

/** A claim as the page labels it: its value in Italian, else the source's own text. */
export function italianLabel(claim: Exclude<GrammarClaim, { status: "missing" }>): string {
  if (claim.status === "stated") return ITALIAN[claim.value] ?? ITALIAN[claim.sourceText] ?? claim.sourceText;
  return ITALIAN[claim.sourceText] ?? claim.sourceText;
}
