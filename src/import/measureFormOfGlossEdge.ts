// `pnpm run measure:form-of-gloss-edge` — the archive scan of rule
// `it-form-of-gloss-edge` (src/italian/formOfGlossEdge.ts, #722, #733) at the
// version the curated list is made with, and the count it gives.
//
// 1. It reads the archive (`--archive`, default the master's in
//    `.data/source/`, fetched from `povlabs/lexema-data` when the cache lacks
//    it) once for every sense whose first gloss names a word after "di", and
//    the words those glosses name.
// 2. It reads it again for every record of those words, with its forms.
// 3. It reads the dump the archive was built from (`--dump`, default the
//    master's in `.data/source/`) for the revision of each page those senses
//    and words are on: the pages a correction cites.
// 4. It judges each sense (`judgeSense`), pins each edge the rule confirms with
//    the record of the base word that lists it and the two page revisions it
//    cites, writes src/italian/formOfGlossEdgeEvidence.ts, and prints the
//    verdicts as Markdown for the report: the count it corrects, split into
//    edges it adds and edges it replaces (to the reflexive form of the gloss's
//    verb, or to another word), the count v1 adds on the same scan, and every
//    sense it leaves alone with the reason.
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
import {
  edgeChange,
  type EdgeChange,
  FORM_OF_GLOSS_EDGE_RULE,
  type FormOfGlossEdgeEvidence,
  type FormOfGlossEdgeRule,
  glossBase,
  judgeSense,
  type LeftAlone,
  type PageRevisions,
  type PinnedEdge,
  type ScannedLemma,
  type ScannedSense,
  type SenseVerdict,
} from "../italian/formOfGlossEdge.js";
import { SourceCache } from "../source/sourceCache.js";
import { ARCHIVE_DUMP, VerifiedDump } from "../source/wiktionaryDump.js";

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

/** The scanned archive, and its senses judged by a version of the rule. */
interface Scan {
  releaseId: string;
  judge: (rule: FormOfGlossEdgeRule) => SenseVerdict[];
}

async function scan(path: string, dumpPath: string): Promise<Scan> {
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
  const pages = await revisionsOf(dumpPath, new Set([...senses.map((sense) => sense.word), ...bases]));
  const judge = (rule: FormOfGlossEdgeRule): SenseVerdict[] =>
    senses.flatMap((sense) => judgeSense(sense, releaseId, lemmas.get(glossBase(sense.gloss)?.base ?? "") ?? [], hand, pages, rule) ?? []);
  return { releaseId, judge };
}

function moduleText(evidence: FormOfGlossEdgeEvidence): string {
  return [
    "// Generated by `pnpm run measure:form-of-gloss-edge` (src/import/measureFormOfGlossEdge.ts).",
    `// The senses rule \`${FORM_OF_GLOSS_EDGE_RULE}\` gives a \`form_of\` edge, each with the`,
    "// archive line of the base word whose forms table lists the word and the dump",
    "// revisions of the two pages it cites: never edited by hand (#722, #733).",
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
  "several-edges": "the sense declares several edges, none to the base, so no one edge is the one to replace",
  "page-not-in-dump": "the word's page or the base's page is not in the dump, so there is no page to cite",
};

const CHANGES: Record<EdgeChange, string> = {
  added: "edges added where the sense states none",
  "replaced-reflexive": "edges replaced that named the reflexive form of the gloss's verb",
  "replaced-other-word": "edges replaced that named another word",
};

const cell = (text: string): string => text.replaceAll("|", "\\|").replaceAll("\n", " ");

type EdgeVerdict = Extract<SenseVerdict, { kind: "edge" }>;

function edgeRow({ sense, correction: { edge, evidence } }: EdgeVerdict): string {
  const cited = [evidence.form, evidence.base].map((page) => `[${cell(page.title)}](${evidenceUrl(page)})`).join(", ");
  const replaced = edge.replaces === undefined ? "" : `\`${edge.replaces.text}\``;
  return `| ${sense.lineNo} | \`${sense.word}\` | ${sense.pos} | ${sense.senseIndex} | ${cell(sense.gloss)} | ${replaced} | \`${edge.target}\` | ${cited} |`;
}

function report(releaseId: string, verdicts: readonly SenseVerdict[], v1: readonly SenseVerdict[]): string {
  const edges = verdicts.flatMap((verdict) => (verdict.kind === "edge" ? [verdict] : []));
  const left = verdicts.flatMap((verdict) => (verdict.kind === "left-alone" ? [verdict] : []));
  const reasons = Object.keys(REASONS) as LeftAlone[];
  const changes = Object.keys(CHANGES) as EdgeChange[];
  const ofChange = (change: EdgeChange) => edges.filter((verdict) => edgeChange(verdict.correction.edge) === change);
  const v1Edges = v1.filter((verdict) => verdict.kind === "edge").length;
  const edgeTable = (rows: readonly EdgeVerdict[]) => [
    "| Line | Word | POS | Sense | Gloss | Edge it replaces | Edge to | Cited pages |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map(edgeRow),
  ];
  return [
    `Rule \`${FORM_OF_GLOSS_EDGE_RULE}\` on \`${releaseId}\`: ${edges.length} senses of ${new Set(edges.map((verdict) => verdict.sense.lineNo)).size} records get an edge; ${left.length} senses are left alone. Rule \`it-form-of-gloss-edge/v1\` on the same scan adds ${v1Edges}.`,
    "",
    "| Correction | Senses |",
    "|---|---|",
    ...changes.map((change) => `| ${CHANGES[change]} (\`${change}\`) | ${ofChange(change).length} |`),
    "",
    "| Left alone because | Senses |",
    "|---|---|",
    ...reasons.map((reason) => `| ${REASONS[reason]} (\`${reason}\`) | ${left.filter((verdict) => verdict.reason === reason).length} |`),
    "",
    "## Edges replaced: the reflexive form of the gloss's verb",
    "",
    ...edgeTable(ofChange("replaced-reflexive")),
    "",
    "## Edges replaced: another word",
    "",
    ...edgeTable(ofChange("replaced-other-word")),
    "",
    "## Edges added",
    "",
    ...edgeTable(ofChange("added")),
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

const { values } = parseArgs({ options: { archive: { type: "string" }, dump: { type: "string" } } });
const cache = new SourceCache();
const { releaseId, judge } = await scan(values.archive ?? (await cache.archive()), values.dump ?? (await cache.dump()));
const verdicts = judge(FORM_OF_GLOSS_EDGE_RULE);
const edges: PinnedEdge[] = verdicts.flatMap((verdict) =>
  verdict.kind === "edge"
    ? [
        {
          sense: verdict.sense,
          lemma: verdict.lemma,
          revisions: { form: verdict.correction.evidence.form.revisionId, base: verdict.correction.evidence.base.revisionId },
        },
      ]
    : [],
);
await writeFile(OUT, moduleText({ releaseId, edges }));
process.stdout.write(report(releaseId, verdicts, judge("it-form-of-gloss-edge/v1")));
