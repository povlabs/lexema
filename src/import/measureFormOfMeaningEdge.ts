// `pnpm run measure:form-of-meaning-edge` — the archive scan of rule
// `it-form-of-meaning-edge` (src/italian/formOfMeaningEdge.ts, #755) at the
// version the curated list is made with, and the count it gives.
//
// 1. It reads the archive (`--archive`, default the master's in
//    `.data/source/`, fetched from `povlabs/lexema-data` when the cache lacks
//    it) once for every Italian record with a sense that declares an edge and
//    whose first gloss has no form opening, and the base words its form senses
//    name.
// 2. It reads it again for every record of those words, with its forms.
// 3. It reads the dump the archive was built from (`--dump`, default the
//    master's in `.data/source/`) for the revision of each page those records
//    and words are on: the pages a correction cites.
// 4. It judges each record (`judgeRecord`) against the edges the hand entries
//    and rule `it-form-of-gloss-edge` already set, pins each record the rule
//    corrects with the record of the base word that lists it and the page
//    revisions it cites, writes src/italian/formOfMeaningEdgeEvidence.ts, and
//    prints the verdicts as Markdown for the report: the count it removes and
//    the count it redirects, and every sense it leaves alone with the reason.
//
// It reads nothing but the archive and its dump, so a second run on the same
// two files writes the same file.

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { createGunzip } from "node:zlib";
import { edgeCorrections, evidenceUrl, HAND_CORRECTIONS } from "../italian/curatedCorrections.js";
import { formOfGlossEdgeCorrections, glossBase, type PageRevisions, type ScannedLemma } from "../italian/formOfGlossEdge.js";
import { FORM_OF_GLOSS_EDGE_EVIDENCE } from "../italian/formOfGlossEdgeEvidence.js";
import {
  FORM_OF_MEANING_EDGE_RULE,
  type FormOfMeaningEdgeEvidence,
  judgeRecord,
  type LeftAlone,
  type MeaningVerdict,
  type PinnedRecord,
  type RecordSense,
  type RemovedBecause,
  type ScannedRecord,
} from "../italian/formOfMeaningEdge.js";
import { SourceCache } from "../source/sourceCache.js";
import { ARCHIVE_DUMP, VerifiedDump } from "../source/wiktionaryDump.js";

const OUT = new URL("../italian/formOfMeaningEdgeEvidence.ts", import.meta.url);

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

/** The senses of a record the rule reads, when one of them declares an edge and its gloss has no form opening: those senses and the senses whose gloss has one. */
function scanRecord(line: string, lineNo: number): ScannedRecord | undefined {
  const record: unknown = JSON.parse(line);
  if (!isRecord(record) || typeof record.word !== "string" || typeof record.pos !== "string" || record.lang_code !== "it") return undefined;
  const senses = (Array.isArray(record.senses) ? record.senses : []).flatMap((sense: unknown, senseIndex): RecordSense[] => {
    if (!isRecord(sense) || !Array.isArray(sense.glosses) || typeof sense.glosses[0] !== "string") return [];
    const formOf = Array.isArray(sense.form_of) ? sense.form_of.flatMap((target: unknown) => (isRecord(target) && typeof target.word === "string" ? [target.word] : [])) : [];
    return [{ senseIndex, gloss: sense.glosses[0], formOf }];
  });
  const formOpening = (sense: RecordSense) => glossBase(sense.gloss)?.formOpening === true;
  if (!senses.some((sense) => sense.formOf.length > 0 && !formOpening(sense))) return undefined;
  return {
    lineNo,
    lineSha256: sha256(line),
    word: record.word,
    pos: record.pos,
    langCode: record.lang_code,
    senses: senses.filter((sense) => sense.formOf.length > 0 || formOpening(sense)),
  };
}

function scanLemma(line: string, lineNo: number): ScannedLemma | undefined {
  const record: unknown = JSON.parse(line);
  if (!isRecord(record) || typeof record.word !== "string" || typeof record.pos !== "string" || typeof record.lang_code !== "string") return undefined;
  const forms = Array.isArray(record.forms) ? record.forms.map((form: unknown) => (isRecord(form) && typeof form.form === "string" ? form.form : undefined)) : [];
  return { lineNo, lineSha256: sha256(line), word: record.word, pos: record.pos, langCode: record.lang_code, forms };
}

/** The revision of each page of `titles` in the dump at `path`, checked against the dump the archive was built from. */
async function revisionsOf(path: string, titles: ReadonlySet<string>): Promise<PageRevisions> {
  const dump = await VerifiedDump.open(path, ARCHIVE_DUMP);
  const revisions = new Map<string, number>();
  try {
    for await (const page of dump.pages()) if (titles.has(page.title)) revisions.set(page.title, page.revisionId);
  } finally {
    await dump.close();
  }
  return revisions;
}

async function scan(path: string, dumpPath: string): Promise<{ releaseId: string; verdicts: MeaningVerdict[] }> {
  const release: { id?: string } = {};
  const records: ScannedRecord[] = [];
  for await (const [line, lineNo] of lines(path, release)) {
    if (!line.includes('"form_of"')) continue;
    const record = scanRecord(line, lineNo);
    if (record !== undefined) records.push(record);
  }
  const releaseId = release.id;
  if (releaseId === undefined) throw new Error("the archive was not read to its end");
  const bases = new Set(records.flatMap((record) => record.senses.flatMap((sense) => (glossBase(sense.gloss)?.formOpening === true ? [glossBase(sense.gloss)?.base ?? ""] : []))));
  const lemmas = new Map<string, ScannedLemma[]>();
  for await (const [line, lineNo] of lines(path, {})) {
    const word = /^\{"word": "((?:[^"\\]|\\.)*)"/.exec(line)?.[1];
    if (word !== undefined && !bases.has(JSON.parse(`"${word}"`) as string)) continue;
    const lemma = scanLemma(line, lineNo);
    if (lemma === undefined || !bases.has(lemma.word)) continue;
    lemmas.set(lemma.word, [...(lemmas.get(lemma.word) ?? []), lemma]);
  }
  const hand = edgeCorrections(HAND_CORRECTIONS);
  const targets = new Map<number, Map<number, string>>();
  for (const correction of [...hand, ...formOfGlossEdgeCorrections(FORM_OF_GLOSS_EDGE_EVIDENCE, hand)]) {
    if (correction.record.releaseId !== releaseId) continue;
    const ofLine = targets.get(correction.record.lineNo) ?? new Map<number, string>();
    ofLine.set(correction.edge.sense, correction.edge.target);
    targets.set(correction.record.lineNo, ofLine);
  }
  const pages = await revisionsOf(dumpPath, new Set([...records.map((record) => record.word), ...bases]));
  const verdicts = records.flatMap((record) => {
    const named = [...new Set(record.senses.flatMap((sense) => glossBase(sense.gloss)?.base ?? []))];
    return judgeRecord(record, releaseId, targets.get(record.lineNo) ?? new Map(), named.flatMap((base) => lemmas.get(base) ?? []), pages);
  });
  return { releaseId, verdicts };
}

/** Each record the rule corrects, pinned with what it reads and the pages it cites. */
function pinned(verdicts: readonly MeaningVerdict[]): PinnedRecord[] {
  const byLine = new Map<number, PinnedRecord>();
  for (const verdict of verdicts) {
    if (verdict.kind === "left-alone") continue;
    const pin = byLine.get(verdict.record.lineNo) ?? { record: verdict.record, revisions: { form: verdict.correction.evidence.form.revisionId } };
    // Every edge a record redirects names its one base word, so any of them pins it.
    byLine.set(
      verdict.record.lineNo,
      verdict.kind === "redirected" ? { ...pin, lemma: verdict.lemma, revisions: { ...pin.revisions, base: verdict.correction.evidence.base.revisionId } } : pin,
    );
  }
  return [...byLine.values()].sort((a, b) => a.record.lineNo - b.record.lineNo);
}

function moduleText(evidence: FormOfMeaningEdgeEvidence): string {
  return [
    "// Generated by `pnpm run measure:form-of-meaning-edge` (src/import/measureFormOfMeaningEdge.ts).",
    `// The records rule \`${FORM_OF_MEANING_EDGE_RULE}\` corrects, each with the senses it reads,`,
    "// the archive line of the base word whose forms table lists the word when it",
    "// redirects an edge, and the dump revisions of the pages it cites: never edited by hand (#755).",
    "",
    'import type { FormOfMeaningEdgeEvidence } from "./formOfMeaningEdge.js";',
    "",
    "export const FORM_OF_MEANING_EDGE_EVIDENCE: FormOfMeaningEdgeEvidence = {",
    `  releaseId: ${JSON.stringify(evidence.releaseId)},`,
    "  records: [",
    ...evidence.records.map((record) => `    ${JSON.stringify(record)},`),
    "  ],",
    "};",
    "",
  ].join("\n");
}

const REASONS: Record<LeftAlone, string> = {
  "already-corrected": "a hand entry or rule `it-form-of-gloss-edge` already sets this sense's edge",
  "form-gloss": "a word of the gloss names a form",
  "several-edges": "the sense declares several edges",
  "names-base": "its edge already names the record's base word",
  "page-not-in-dump": "the record's page is not in the dump, so there is no page to cite",
};

const BECAUSE: Record<RemovedBecause, string> = {
  "no-form-sense": "the record has no real form sense",
  "several-bases": "the record's form senses name more than one base word",
  "base-not-confirmed": "one base word, but its table does not list the word or its page is not in the dump",
};

const cell = (text: string): string => text.replaceAll("|", "\\|").replaceAll("\n", " ");

type Removed = Extract<MeaningVerdict, { kind: "removed" }>;
type Redirected = Extract<MeaningVerdict, { kind: "redirected" }>;

function report(releaseId: string, verdicts: readonly MeaningVerdict[]): string {
  const removed = verdicts.flatMap((verdict) => (verdict.kind === "removed" ? [verdict] : []));
  const redirected = verdicts.flatMap((verdict) => (verdict.kind === "redirected" ? [verdict] : []));
  const left = verdicts.flatMap((verdict) => (verdict.kind === "left-alone" ? [verdict] : []));
  const corrected = [...removed, ...redirected];
  const records = new Set(corrected.map((verdict) => verdict.record.lineNo)).size;
  const reasons = Object.keys(REASONS) as LeftAlone[];
  const because = Object.keys(BECAUSE) as RemovedBecause[];
  const row = (verdict: MeaningVerdict) => `| ${verdict.record.lineNo} | \`${verdict.record.word}\` | ${verdict.record.pos} | ${verdict.sense.senseIndex} | ${cell(verdict.sense.gloss)} | ${verdict.sense.formOf.map((word) => `\`${cell(word)}\``).join(", ")} |`;
  const redirectedRow = (verdict: Redirected) => {
    const { form, base } = verdict.correction.evidence;
    const cited = [form, base].map((page) => `[${cell(page.title)}](${evidenceUrl(page)})`).join(", ");
    return `${row(verdict)} \`${verdict.correction.edge.target}\` | ${verdict.formSense.senseIndex} | ${cited} |`;
  };
  const removedRow = (verdict: Removed) => {
    const { form } = verdict.correction.evidence;
    return `${row(verdict)} \`${verdict.because}\` | ${verdict.bases.map((base) => `\`${cell(base)}\``).join(", ")} | [${cell(form.title)}](${evidenceUrl(form)}) |`;
  };
  return [
    `Rule \`${FORM_OF_MEANING_EDGE_RULE}\` on \`${releaseId}\` reads ${verdicts.length} senses that declare an edge and whose gloss has no form opening. It corrects ${corrected.length} senses of ${records} records: it removes ${removed.length} edges and points ${redirected.length} at the record's own base word. It leaves ${left.length} senses alone.`,
    "",
    "| Correction | Senses |",
    "|---|---|",
    `| edges pointed at the record's own base word (\`redirected\`) | ${redirected.length} |`,
    ...because.map((reason) => `| edges removed: ${BECAUSE[reason]} (\`${reason}\`) | ${removed.filter((verdict) => verdict.because === reason).length} |`),
    "",
    "| Left alone because | Senses |",
    "|---|---|",
    ...reasons.map((reason) => `| ${REASONS[reason]} (\`${reason}\`) | ${left.filter((verdict) => verdict.reason === reason).length} |`),
    "",
    "## Edges pointed at the record's own base word",
    "",
    "| Line | Word | POS | Sense | Gloss | Edge it replaces | Edge to | Form sense | Cited pages |",
    "|---|---|---|---|---|---|---|---|---|",
    ...redirected.map(redirectedRow),
    "",
    "## Edges removed",
    "",
    "| Line | Word | POS | Sense | Gloss | Edge it removes | Because | Base words named | Cited page |",
    "|---|---|---|---|---|---|---|---|---|",
    ...removed.map(removedRow),
    "",
    "## Senses left alone",
    "",
    "| Line | Word | POS | Sense | Gloss | Edge | Reason | Form word |",
    "|---|---|---|---|---|---|---|---|",
    ...left.map((verdict) => `${row(verdict)} \`${verdict.reason}\` | ${verdict.term === undefined ? "" : `\`${cell(verdict.term)}\``} |`),
    "",
  ].join("\n");
}

const { values } = parseArgs({ options: { archive: { type: "string" }, dump: { type: "string" } } });
const cache = new SourceCache();
const { releaseId, verdicts } = await scan(values.archive ?? (await cache.archive()), values.dump ?? (await cache.dump()));
await writeFile(OUT, moduleText({ releaseId, records: pinned(verdicts) }));
process.stdout.write(report(releaseId, verdicts));
