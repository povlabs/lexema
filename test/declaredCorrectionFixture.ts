// Two made-up declared lemmas whose plural records a test-only curated
// correction sets right (#470). No record heads `gattolino` or `volpatore`;
// each has one noun record that glosses itself "plurale di <lemma>":
//
// - `gattolini` is tagged feminine plural; its correction sets its gender to
//   masculine.
// - `volpatrice` is tagged feminine plural; its correction sets its number to
//   singular, as `ammaliatrice` is ammaliatore's femminile singolare.
//
// The corrections are not in the committed list (src/italian/curatedCorrections.ts):
// a committed one needs a ruling, so a test passes these to `seedSql({ corrections })`.

import { createHash } from "node:crypto";
import type { RecordCorrection } from "../src/italian/curatedCorrections.js";

const plural = (word: string, lemma: string): string =>
  JSON.stringify({
    word,
    lang_code: "it",
    lang: "Italiano",
    pos: "noun",
    pos_title: "Sostantivo, forma flessa",
    senses: [{ glosses: [`plurale di ${lemma}`], tags: ["form-of"], form_of: [{ word: lemma }] }],
    tags: ["form-of", "feminine", "plural"],
  });

export const DECLARED_CORRECTION_LINES: readonly string[] = [plural("gattolini", "gattolino"), plural("volpatrice", "volpatore")];

const sha256 = (line: string): string => createHash("sha256").update(line, "utf8").digest("hex");

/** The two corrections, keyed to `releaseId` at the line of `lines` that holds each record. */
export function declaredCorrections(lines: readonly string[], releaseId: string): RecordCorrection[] {
  const at = (word: string) => {
    const line = DECLARED_CORRECTION_LINES.find((candidate) => (JSON.parse(candidate) as { word: string }).word === word) as string;
    const lineNo = lines.indexOf(line) + 1;
    if (lineNo === 0) throw new Error(`no line of the archive is ${word}`);
    return { releaseId, lineNo, lineSha256: sha256(line), word, pos: "noun" };
  };
  const evidence = (title: string) => [{ wiki: "en.wiktionary.org", title, revisionId: 1, shows: "made up for a test" }] as const;
  return [
    {
      record: at("gattolini"),
      facts: { gender: { overrides: { pointer: "/tags/1", text: "feminine" }, value: "masculine" } },
      evidence: evidence("gattolini"),
    },
    {
      record: at("volpatrice"),
      facts: { number: { overrides: { pointer: "/tags/2", text: "plural" }, value: "singular" } },
      evidence: evidence("volpatrice"),
    },
  ];
}
