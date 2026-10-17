// How rule `it-regular-conjugation/v1` reaches the verbs that are not
// pronominal and whose records draw no table (#841).
//
//   pnpm exec tsx tools/measureBaseRegularTables.ts <it-extract.jsonl.gz> > result.json
//
// It reads every Italian verb record of the archive and keeps the records the
// page may give a rule-built table: a verb whose word `pronominalVerb` does
// not read, no record of which fills a cell, and which no `form_of` edge
// names a verb record's form. For each it gives what `ownClassOf` answers,
// reading the calls pinned in src/italian/conjugationTemplateCalls.ts as the
// page does: the class its own `Appendice:Coniugazioni/Italiano/<verb>` page's
// call settles, or why none does. Most such records are forms of a verb the
// release has no record of (`metallizzino`, of metallizzare), which it counts
// by their glosses. Then it gives the same split for the records whose own
// page has a pinned call, word by word. It changes nothing.

import { CONJUGATION_TEMPLATE_CALLS } from "../src/italian/conjugationTemplateCalls.js";
import { pronominalVerb } from "../src/italian/pronominalConjugation.js";
import { conjugationPageOf, ownClassOf, REGULAR_CONJUGATION_RULE } from "../src/italian/regularConjugation.js";
import { fillsCell, namesVerb, readVerbs } from "./pronominalArchive.js";

const [archive] = process.argv.slice(2);
if (!archive) throw new Error("usage: tools/measureBaseRegularTables.ts <it-extract.jsonl.gz>");

const verbs = await readVerbs(archive);

/** One record's outcome: its word, the call on its own page if one is pinned, and the class settled or the reason declined. */
interface Outcome {
  word: string;
  call: string | undefined;
  revisionId: number | undefined;
  outcome: string;
}

const outcomes: Outcome[] = [];
for (const [word, records] of verbs) {
  if (pronominalVerb(word) !== undefined || records.some(fillsCell)) continue;
  const page = CONJUGATION_TEMPLATE_CALLS[conjugationPageOf(word)];
  for (const record of records.filter((one) => !namesVerb(verbs, one))) {
    const glosses = (record.senses ?? []).flatMap((sense) => sense.glosses ?? []);
    const answer = ownClassOf(word, glosses, CONJUGATION_TEMPLATE_CALLS);
    const outcome = answer.kind === "settled" ? `settled:${answer.conjugationClass}` : `declined:${answer.reason}`;
    outcomes.push({ word, call: page?.call, revisionId: page?.revisionId, outcome });
  }
}

/** Records and words by outcome; the words are listed only where every record has a pinned call. */
function tally(of: readonly Outcome[]): Record<string, { records: number; words: number; listed?: string[] }> {
  const groups = new Map<string, Outcome[]>();
  for (const one of of) groups.set(one.outcome, [...(groups.get(one.outcome) ?? []), one]);
  return Object.fromEntries(
    [...groups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, list]) => {
        const words = [...new Set(list.map((one) => one.word))].sort();
        const listed = list.every((one) => one.call !== undefined) ? { listed: words } : {};
        return [key, { records: list.length, words: words.length, ...listed }];
      }),
  );
}

const withCall = outcomes.filter((one) => one.call !== undefined);
const result = {
  rule: REGULAR_CONJUGATION_RULE,
  records: outcomes.length,
  words: new Set(outcomes.map((one) => one.word)).size,
  allOutcomes: tally(outcomes),
  withOwnCall: { records: withCall.length, words: new Set(withCall.map((one) => one.word)).size, outcomes: tally(withCall) },
  recordsWithOwnCall: withCall,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
