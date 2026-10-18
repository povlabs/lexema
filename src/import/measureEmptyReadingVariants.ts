// `pnpm run measure:empty-reading-variants` — the archive and dump scan of rule
// `it-empty-reading-variant` (src/italian/emptyReadingVariant.ts, #803) at the
// version the list is made with, and the count it gives.
//
// 1. It reads the archive (`--archive`, default the master's in
//    `.data/source/`, fetched from `povlabs/lexema-data` when the cache lacks
//    it) once for every Italian record: whether it defines something, and the
//    whole line of each that defines nothing. A second pass names each
//    record's siblings, as the seed's recovered layer does.
// 2. It reads the dump the archive was built from (`--dump`, default the
//    master's in `.data/source/`) for the page of each record that defines
//    nothing, and on it the lines of the Italian `{{-var-}}` section that link
//    a word. A record the recovered layer reads a definition for off that page
//    defines something on the word page, so the rule leaves it alone.
// 3. It names each remaining reading's variants (`variantsOf`), writes every
//    reading that has one to src/italian/emptyReadingVariantEvidence.ts, and
//    prints the readings as Markdown for the pull request.
//
// It reads nothing but the archive and its dump, so a second run on the same
// two files writes the same file.

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { createGunzip } from "node:zlib";
import {
  EMPTY_READING_VARIANT_RULE,
  sensesDefineNothing,
  variantLines,
  variantsOf,
  type EmptyReadingVariant,
  type EmptyReadingVariantEvidence,
  type VariantRecord,
} from "../italian/emptyReadingVariant.js";
import { recordText, recoverDefinitions } from "../italian/recovery.js";
import { SourceCache } from "../source/sourceCache.js";
import { ARCHIVE_DUMP, VerifiedDump } from "../source/wiktionaryDump.js";
import { readSectionRecords } from "./recoveredLayer.js";

const OUT = new URL("../italian/emptyReadingVariantEvidence.ts", import.meta.url);

const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

/** An Italian archive record as the rule reads it. */
interface ItalianRecord {
  word: string;
  pos: string;
  pos_title: string;
  lang_code: string;
  tags?: unknown;
  senses: { glosses?: unknown; examples?: unknown; form_of?: unknown }[];
}

const isItalianRecord = (value: unknown): value is ItalianRecord => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<ItalianRecord>;
  return record.lang_code === "it" && typeof record.word === "string" && typeof record.pos === "string" && typeof record.pos_title === "string";
};

/** A record that defines nothing, with its whole line read. */
interface EmptyRecord {
  lineNo: number;
  lineSha256: string;
  record: ItalianRecord;
}

/** What the rule found for one record that defines nothing. */
type Verdict =
  | { kind: "linked"; reading: EmptyReadingVariant }
  | { kind: "not-in-dump" | "no-variant-line" | "recovered" | "no-variant-reading"; empty: EmptyRecord };

async function scan(path: string, dumpPath: string): Promise<{ releaseId: string; verdicts: Verdict[] }> {
  const whole = createHash("sha256");
  const input = createReadStream(path);
  input.on("data", (chunk) => whole.update(chunk));
  const empty: EmptyRecord[] = [];
  const records = new Map<string, VariantRecord[]>();
  let lineNo = 0;
  for await (const line of createInterface({ input: input.pipe(createGunzip()), crlfDelay: Infinity })) {
    lineNo++;
    const record: unknown = JSON.parse(line);
    if (!isItalianRecord(record)) continue;
    const senses = Array.isArray(record.senses) ? record.senses : [];
    const definesSomething = !sensesDefineNothing(record.word, senses);
    const lineSha256 = sha256(line);
    records.set(record.word, [...(records.get(record.word) ?? []), { lineNo, lineSha256, word: record.word, posTitle: record.pos_title, definesSomething }]);
    if (!definesSomething) empty.push({ lineNo, lineSha256, record: { ...record, senses } });
  }
  const releaseId = `it-${whole.digest("hex").slice(0, 8)}`;
  const sections = await readSectionRecords(path);

  const titles = new Set(empty.map(({ record }) => record.word));
  const dump = await VerifiedDump.open(dumpPath, ARCHIVE_DUMP);
  const verdicts = new Map<number, Verdict>();
  try {
    for await (const page of dump.pages()) {
      if (!titles.has(page.title)) continue;
      const lines = variantLines(page);
      for (const one of empty.filter(({ record }) => record.word === page.title)) {
        const { record } = one;
        if (lines.length === 0) {
          verdicts.set(one.lineNo, { kind: "no-variant-line", empty: one });
          continue;
        }
        const recovery = recoverDefinitions(recordText(record, sections.siblingsOf(one.lineNo, record)), page);
        if (recovery.outcome === "matched" && recovery.recovered.length > 0) {
          verdicts.set(one.lineNo, { kind: "recovered", empty: one });
          continue;
        }
        const [first, ...rest] = variantsOf(record.word, record.pos_title, lines, (word) => records.get(word) ?? []);
        verdicts.set(
          one.lineNo,
          first === undefined
            ? { kind: "no-variant-reading", empty: one }
            : {
                kind: "linked",
                reading: {
                  record: { lineNo: one.lineNo, lineSha256: one.lineSha256, word: record.word, pos: record.pos, posTitle: record.pos_title },
                  revisionId: page.revisionId,
                  variants: [first, ...rest],
                },
              },
        );
      }
    }
  } finally {
    await dump.close();
  }
  for (const one of empty) if (!verdicts.has(one.lineNo)) verdicts.set(one.lineNo, { kind: "not-in-dump", empty: one });
  return { releaseId, verdicts: [...verdicts.values()].sort((a, b) => lineOf(a) - lineOf(b)) };
}

const lineOf = (verdict: Verdict): number => (verdict.kind === "linked" ? verdict.reading.record.lineNo : verdict.empty.lineNo);

function moduleText(evidence: EmptyReadingVariantEvidence): string {
  return [
    "// Generated by `pnpm run measure:empty-reading-variants` (src/import/measureEmptyReadingVariants.ts).",
    `// The empty readings rule \`${EMPTY_READING_VARIANT_RULE}\` links to a variant, each pinned by its`,
    "// archive line and digest, with the dump revision of its page, the `{{-var-}}` line that",
    "// links each variant and the variant's record that defines something: never edited by hand (#803).",
    "",
    'import type { EmptyReadingVariantEvidence } from "./emptyReadingVariant.js";',
    "",
    "export const EMPTY_READING_VARIANT_EVIDENCE: EmptyReadingVariantEvidence = {",
    `  releaseId: ${JSON.stringify(evidence.releaseId)},`,
    "  readings: [",
    ...evidence.readings.map((reading) => `    ${JSON.stringify(reading)},`),
    "  ],",
    "};",
    "",
  ].join("\n");
}

const LEFT: Record<Exclude<Verdict["kind"], "linked">, string> = {
  "not-in-dump": "its page is not in the dump",
  "no-variant-line": "its page's Italian `{{-var-}}` section links no word, or it has none",
  recovered: "the recovered layer reads a definition for it off its page",
  "no-variant-reading": "no word the section links has a reading of its section title that defines something",
};

const cell = (text: string): string => text.replaceAll("|", "\\|").replaceAll("\n", " ");
const pageUrl = (title: string, revisionId: number): string => `https://it.wiktionary.org/w/index.php?title=${encodeURIComponent(title)}&oldid=${revisionId}`;

function report(releaseId: string, verdicts: readonly Verdict[]): string {
  const linked = verdicts.flatMap((verdict) => (verdict.kind === "linked" ? [verdict.reading] : []));
  const reasons = Object.keys(LEFT) as (keyof typeof LEFT)[];
  return [
    `Rule \`${EMPTY_READING_VARIANT_RULE}\` on \`${releaseId}\` reads ${verdicts.length} Italian readings that define nothing. It links ${linked.length} of them to a variant.`,
    "",
    "| Left alone because | Readings |",
    "|---|---|",
    ...reasons.map((reason) => `| ${LEFT[reason]} (\`${reason}\`) | ${verdicts.filter((verdict) => verdict.kind === reason).length} |`),
    "",
    "| Line | Word | Section | Leads to | `{{-var-}}` line |",
    "|---|---|---|---|---|",
    ...linked.map(
      ({ record, revisionId, variants }) =>
        `| ${record.lineNo} | [${cell(record.word)}](${pageUrl(record.word, revisionId)}) | ${record.posTitle} | ${variants.map((variant) => `\`${cell(variant.word)}\``).join(", ")} | ${[...new Set(variants.map((variant) => `${variant.line.line}: \`${cell(variant.line.wikitext.trim())}\``))].join("; ")} |`,
    ),
    "",
  ].join("\n");
}

const { values } = parseArgs({ options: { archive: { type: "string" }, dump: { type: "string" } } });
const cache = new SourceCache();
const { releaseId, verdicts } = await scan(values.archive ?? (await cache.archive()), values.dump ?? (await cache.dump()));
await writeFile(OUT, moduleText({ releaseId, readings: verdicts.flatMap((verdict) => (verdict.kind === "linked" ? [verdict.reading] : [])) }));
process.stdout.write(report(releaseId, verdicts));
