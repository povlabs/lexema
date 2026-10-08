// `pnpm run measure:form-of-gloss-edge` — the archive scan of rule
// `it-form-of-gloss-edge/v1` (src/italian/formOfGlossEdge.ts, #722), and the
// count it gives.
//
// 1. It reads the archive (`--archive`, default the master's in
//    `.data/source/`, fetched from `povlabs/lexema-data` when the cache lacks
//    it) once for every sense whose first gloss names a word after "di", and
//    the words those glosses name.
// 2. It reads it again for every record of those words, with its forms.
// 3. It judges each sense (`judgeSense`), pins each edge the rule confirms with
//    the record of the base word it cites, writes
//    src/italian/formOfGlossEdgeEvidence.ts, and prints the verdicts as
//    Markdown for the report: the count it corrects, and every sense it leaves
//    alone with the reason.
//
// It reads nothing but the archive, so a second run on the same archive
// writes the same file.

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { createGunzip } from "node:zlib";
import { edgeCorrections, HAND_CORRECTIONS } from "../italian/curatedCorrections.js";
import {
  FORM_OF_GLOSS_EDGE_RULE,
  type FormOfGlossEdgeEvidence,
  glossBase,
  judgeSense,
  type LeftAlone,
  type PinnedEdge,
  type ScannedLemma,
  type ScannedSense,
  type SenseVerdict,
} from "../italian/formOfGlossEdge.js";
import { SourceCache } from "../source/sourceCache.js";

const OUT = new URL("../italian/formOfGlossEdgeEvidence.ts", import.meta.url);

const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Each line of the archive, numbered from 1, and the archive's release id once the last line is read. */
async function* lines(path: string, release: { id?: string }): AsyncGenerator<[line: string, lineNo: number]> {
  const whole = createHash("sha256");
  const input = createReadStream(path);
  input.on("data", (chunk) => whole.update(chunk));
  let lineNo = 0;
  for await (const line of createInterface({ input: input.pipe(createGunzip()), crlfDelay: Infinity })) {
    lineNo++;
    yield [line, lineNo];
  }
  release.id = `it-${whole.digest("hex").slice(0, 8)}`;
}

/** The senses of `line` whose first gloss names a word after "di". */
function scanSenses(line: string, lineNo: number): ScannedSense[] {
  const record: unknown = JSON.parse(line);
  if (!isRecord(record) || typeof record.word !== "string" || typeof record.pos !== "string" || typeof record.lang_code !== "string") return [];
  const { word, pos, lang_code: langCode } = record;
  const senses = Array.isArray(record.senses) ? record.senses : [];
  const lineSha256 = sha256(line);
  return senses.flatMap((sense: unknown, senseIndex): ScannedSense[] => {
    if (!isRecord(sense) || !Array.isArray(sense.glosses) || typeof sense.glosses[0] !== "string") return [];
    const gloss = sense.glosses[0];
    if (glossBase(gloss) === undefined) return [];
    const formOf = Array.isArray(sense.form_of) ? sense.form_of.flatMap((target: unknown) => (isRecord(target) && typeof target.word === "string" ? [target.word] : [])) : [];
    return [{ lineNo, lineSha256, word, pos, langCode, senseIndex, gloss, formOf }];
  });
}

function scanLemma(line: string, lineNo: number): ScannedLemma | undefined {
  const record: unknown = JSON.parse(line);
  if (!isRecord(record) || typeof record.word !== "string" || typeof record.pos !== "string" || typeof record.lang_code !== "string") return undefined;
  const forms = Array.isArray(record.forms) ? record.forms.map((form: unknown) => (isRecord(form) && typeof form.form === "string" ? form.form : undefined)) : [];
  return { lineNo, lineSha256: sha256(line), word: record.word, pos: record.pos, langCode: record.lang_code, forms };
}

async function scan(path: string): Promise<{ releaseId: string; verdicts: SenseVerdict[] }> {
  const release: { id?: string } = {};
  const senses: ScannedSense[] = [];
  for await (const [line, lineNo] of lines(path, release)) {
    if (line.includes(" di ") || line.includes("\"di ")) senses.push(...scanSenses(line, lineNo));
  }
  const releaseId = release.id;
  if (releaseId === undefined) throw new Error("the archive was not read to its end");
  const bases = new Set(senses.flatMap((sense) => glossBase(sense.gloss)?.base ?? []));
  const lemmas = new Map<string, ScannedLemma[]>();
  for await (const [line, lineNo] of lines(path, {})) {
    const word = /^\{"word": "((?:[^"\\]|\\.)*)"/.exec(line)?.[1];
    if (word !== undefined && !bases.has(JSON.parse(`"${word}"`) as string)) continue;
    const lemma = scanLemma(line, lineNo);
    if (lemma === undefined || !bases.has(lemma.word)) continue;
    lemmas.set(lemma.word, [...(lemmas.get(lemma.word) ?? []), lemma]);
  }
  const hand = new Set(
    edgeCorrections(HAND_CORRECTIONS)
      .filter((correction) => correction.record.releaseId === releaseId)
      .map((correction) => `${correction.record.lineNo}:${correction.edge.sense}`),
  );
  const verdicts = senses.flatMap((sense) => judgeSense(sense, releaseId, lemmas.get(glossBase(sense.gloss)?.base ?? "") ?? [], hand) ?? []);
  return { releaseId, verdicts };
}

function moduleText(evidence: FormOfGlossEdgeEvidence): string {
  return [
    "// Generated by `pnpm run measure:form-of-gloss-edge` (src/import/measureFormOfGlossEdge.ts).",
    "// The senses rule `it-form-of-gloss-edge/v1` gives a `form_of` edge, each with the",
    "// archive line of the base word whose forms table lists the word: never edited by hand (#722).",
    "",
    'import type { FormOfGlossEdgeEvidence } from "./formOfGlossEdge.js";',
    "",
    "export const FORM_OF_GLOSS_EDGE_EVIDENCE: FormOfGlossEdgeEvidence = {",
    `  releaseId: ${JSON.stringify(evidence.releaseId)},`,
    "  edges: [",
    ...evidence.edges.map((edge) => `    ${JSON.stringify(edge)},`),
    "  ],",
    "};",
    "",
  ].join("\n");
}

const REASONS: Record<LeftAlone, string> = {
  "not-italian": "another language's record",
  "hand-entry": "a hand entry sets this sense's edge",
  "names-itself": "the gloss names the word itself",
  "not-a-form-gloss": "the gloss names the base after \"di\" and the base's table lists the word, but its opening does not say which form it is",
  "no-record-of-base": "a form's gloss, and no Italian record of the base",
  "base-table-does-not-list": "a form's gloss, and no Italian record of the base lists the word",
  "edge-names-another-word": "the sense's edge names another word, which only a ruling fixes",
};

const cell = (text: string): string => text.replaceAll("|", "\\|").replaceAll("\n", " ");

function report(releaseId: string, verdicts: readonly SenseVerdict[]): string {
  const edges = verdicts.flatMap((verdict) => (verdict.kind === "edge" ? [verdict] : []));
  const left = verdicts.flatMap((verdict) => (verdict.kind === "left-alone" ? [verdict] : []));
  const reasons = Object.keys(REASONS) as LeftAlone[];
  return [
    `Rule \`${FORM_OF_GLOSS_EDGE_RULE}\` on \`${releaseId}\`: ${edges.length} senses of ${new Set(edges.map((verdict) => verdict.sense.lineNo)).size} records get an edge; ${left.length} senses are left alone.`,
    "",
    "| Left alone because | Senses |",
    "|---|---|",
    ...reasons.map((reason) => `| ${REASONS[reason]} (\`${reason}\`) | ${left.filter((verdict) => verdict.reason === reason).length} |`),
    "",
    "## Edges added",
    "",
    "| Line | Word | POS | Sense | Gloss | Edge to | Cited line |",
    "|---|---|---|---|---|---|---|",
    ...edges.map(
      ({ sense, correction }) =>
        `| ${sense.lineNo} | \`${sense.word}\` | ${sense.pos} | ${sense.senseIndex} | ${cell(sense.gloss)} | \`${correction.edge.target}\` | ${correction.evidence.lineNo} ${correction.evidence.pointer} |`,
    ),
    "",
    "## Senses left alone",
    "",
    "| Line | Word | POS | Sense | Gloss | Edge | Reason |",
    "|---|---|---|---|---|---|---|",
    ...left.map(
      ({ sense, reason }) =>
        `| ${sense.lineNo} | \`${sense.word}\` | ${sense.pos} | ${sense.senseIndex} | ${cell(sense.gloss)} | ${sense.formOf.map((word) => `\`${word}\``).join(", ")} | \`${reason}\` |`,
    ),
    "",
  ].join("\n");
}

const { values } = parseArgs({ options: { archive: { type: "string" } } });
const { releaseId, verdicts } = await scan(values.archive ?? (await new SourceCache().archive()));
const edges: PinnedEdge[] = verdicts.flatMap((verdict) =>
  verdict.kind === "edge"
    ? [
        {
          sense: verdict.sense,
          lemma: {
            lineNo: verdict.correction.evidence.lineNo,
            lineSha256: verdict.correction.evidence.lineSha256,
            word: verdict.correction.evidence.word,
            pos: verdict.correction.evidence.pos,
            langCode: "it",
            formIndex: Number(verdict.correction.evidence.pointer.split("/")[2]),
          },
        },
      ]
    : [],
);
await writeFile(OUT, moduleText({ releaseId, edges }));
process.stdout.write(report(releaseId, verdicts));
