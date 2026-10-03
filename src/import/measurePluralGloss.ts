// `pnpm run measure:plural-gloss` — the evidence fetch of rule
// `it-plural-gloss-number` (src/italian/pluralGlossNumber.ts, #483, #515), and
// the counts its current version gives.
//
// 1. It scans the archive (`--archive`, default it-extract.jsonl.gz) for the
//    records the rule reads (`scanRecord`): noun or adjective, tagged
//    `singular` and not `plural`, first gloss "plurale di <lemma>".
// 2. For each, it reads the pages `pagesFor` names: en.wiktionary's page of
//    the word and of the gloss's lemma, and for a noun it.wiktionary's page of
//    the gloss's lemma. Each page is read at one revision: the one
//    src/italian/pluralGlossEvidence.ts already pins for it, fetched by
//    `revids=<oldid>`, so a second run reads exactly what the first did. A
//    page not yet pinned, or every page with `--repin`, is read at its
//    current revision, fetched by title, and that revision is pinned. A page
//    the wiki does not have is pinned as absent.
// 3. It keeps only the lines the rule reads (`enExcerpt`, `itExcerpt`),
//    writes src/italian/pluralGlossEvidence.ts, and prints the rule's
//    verdicts as Markdown for the report.
//
// Fetches go to the MediaWiki API (`action=query&prop=revisions`), 50 pages
// a request. Nothing here judges a record; `judgeAll` does, from the file
// written.

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { createGunzip } from "node:zlib";
import { type Evidence, HAND_CORRECTIONS, recordCorrections } from "../italian/curatedCorrections.js";
import { PLURAL_GLOSS_EVIDENCE } from "../italian/pluralGlossEvidence.js";
import { judgeAll, pagesFor, type PluralGlossEvidence, scanRecord, type ScannedRecord, type Verdict } from "../italian/pluralGlossNumber.js";
import { enExcerpt, type FetchedPage, isPinned, itExcerpt, type PinnedPage } from "../italian/wiktionaryEvidence.js";

const OUT = new URL("../italian/pluralGlossEvidence.ts", import.meta.url);
const USER_AGENT = "lexema-plural-gloss/1 (https://github.com/hueypov/lexema)";
const BATCH = 50;

const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

async function scanArchive(path: string): Promise<{ releaseId: string; records: ScannedRecord[] }> {
  const whole = createHash("sha256");
  const input = createReadStream(path);
  input.on("data", (chunk) => whole.update(chunk));
  const records: ScannedRecord[] = [];
  let lineNo = 0;
  for await (const line of createInterface({ input: input.pipe(createGunzip()), crlfDelay: Infinity })) {
    lineNo++;
    if (!line.includes("plurale")) continue;
    const record = scanRecord(line, lineNo, sha256(line));
    if (record !== undefined) records.push(record);
  }
  return { releaseId: `it-${whole.digest("hex").slice(0, 8)}`, records };
}

interface ApiPage {
  title: string;
  missing?: boolean;
  revisions?: { revid: number; slots: { main: { content: string } } }[];
}

async function query(wiki: PinnedPage["wiki"], params: Record<string, string>): Promise<{ pages: ApiPage[]; normalized: { from: string; to: string }[] }> {
  const url = new URL(`https://${wiki}/w/api.php`);
  url.search = new URLSearchParams({ action: "query", prop: "revisions", rvprop: "ids|content", rvslots: "main", format: "json", formatversion: "2", ...params }).toString();
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${wiki}: HTTP ${response.status}`);
  const body = (await response.json()) as { query?: { pages?: ApiPage[]; normalized?: { from: string; to: string }[] } };
  return { pages: body.query?.pages ?? [], normalized: body.query?.normalized ?? [] };
}

const excerptOf = (wiki: PinnedPage["wiki"], content: string): string[] => (wiki === "en.wiktionary.org" ? enExcerpt(content) : itExcerpt(content));

/** Each page `wanted` names, at its pinned revision, or at its current one when unpinned or `repin`. */
async function readPages(wanted: readonly { wiki: PinnedPage["wiki"]; title: string }[], pinned: readonly FetchedPage[], repin: boolean): Promise<FetchedPage[]> {
  const held = new Map(pinned.map((page) => [`${page.wiki}:${page.title}`, page]));
  const read: FetchedPage[] = [];
  for (const wiki of ["en.wiktionary.org", "it.wiktionary.org"] as const) {
    const titles = [...new Set(wanted.filter((page) => page.wiki === wiki).map((page) => page.title))].sort();
    const byRevision = repin ? [] : titles.flatMap((title) => {
      const page = held.get(`${wiki}:${title}`);
      return isPinned(page) ? [page] : [];
    });
    const keptAbsent = repin ? [] : titles.flatMap((title) => {
      const page = held.get(`${wiki}:${title}`);
      return page !== undefined && !isPinned(page) ? [page] : [];
    });
    const done = new Set([...byRevision, ...keptAbsent].map((page) => page.title));
    const byTitle = titles.filter((title) => !done.has(title));
    read.push(...keptAbsent);
    for (let i = 0; i < byRevision.length; i += BATCH) {
      const batch = byRevision.slice(i, i + BATCH);
      const { pages } = await query(wiki, { revids: batch.map((page) => page.revisionId).join("|") });
      for (const page of batch) {
        const found = pages.find((entry) => entry.revisions?.[0]?.revid === page.revisionId);
        if (found?.revisions === undefined) throw new Error(`${wiki}: revision ${page.revisionId} of ${page.title} is gone`);
        read.push({ wiki, title: page.title, revisionId: page.revisionId, lines: excerptOf(wiki, found.revisions[0].slots.main.content) });
      }
    }
    for (let i = 0; i < byTitle.length; i += BATCH) {
      const batch = byTitle.slice(i, i + BATCH);
      const { pages, normalized } = await query(wiki, { titles: batch.join("|") });
      if (normalized.length > 0) throw new Error(`${wiki} renamed titles: ${normalized.map((entry) => `${entry.from} -> ${entry.to}`).join(", ")}`);
      for (const title of batch) {
        const found = pages.find((entry) => entry.title === title);
        if (found === undefined) throw new Error(`${wiki} answered nothing for ${title}`);
        const revision = found.revisions?.[0];
        read.push(found.missing === true || revision === undefined
          ? { wiki, title, absent: true }
          : { wiki, title, revisionId: revision.revid, lines: excerptOf(wiki, revision.slots.main.content) });
      }
    }
  }
  return read.sort((a, b) => (a.wiki === b.wiki ? (a.title < b.title ? -1 : a.title > b.title ? 1 : 0) : a.wiki < b.wiki ? -1 : 1));
}

function moduleText(evidence: PluralGlossEvidence): string {
  return [
    "// Generated by `pnpm run measure:plural-gloss` (src/import/measurePluralGloss.ts).",
    "// The records rule `it-plural-gloss-number` reads and the Wiktionary revisions it reads",
    "// them against, pinned by revision id: never edited by hand (#483, #515).",
    "",
    'import type { PluralGlossEvidence } from "./pluralGlossNumber.js";',
    "",
    "export const PLURAL_GLOSS_EVIDENCE: PluralGlossEvidence = {",
    `  releaseId: ${JSON.stringify(evidence.releaseId)},`,
    "  records: [",
    ...evidence.records.map((record) => `    ${JSON.stringify(record)},`),
    "  ],",
    "  pages: [",
    ...evidence.pages.map((page) => `    ${JSON.stringify(page)},`),
    "  ],",
    "};",
    "",
  ].join("\n");
}

const CLASSES: readonly { heading: string; holds: (verdict: Verdict) => boolean }[] = [
  { heading: "Corrected: number only", holds: (verdict) => verdict.kind === "plural" && verdict.correction.confirmedBy === "own-pos" && !verdict.genderCorrected },
  { heading: "Corrected: number and gender", holds: (verdict) => verdict.kind === "plural" && verdict.correction.confirmedBy === "own-pos" && verdict.genderCorrected },
  { heading: "Corrected (v2): gloss names the feminine singular", holds: (verdict) => verdict.kind === "plural" && verdict.correction.confirmedBy === "feminine-lemma" },
  { heading: "Corrected (v2): plural under a neighbouring part of speech", holds: (verdict) => verdict.kind === "plural" && verdict.correction.confirmedBy === "neighbouring-pos" },
  { heading: "Corrected: wrong-gloss singular noun", holds: (verdict) => verdict.kind === "singular" },
  { heading: "Already corrected by hand (#420, #449)", holds: (verdict) => verdict.kind === "excluded" && verdict.reason === "already-corrected" },
  { heading: "Not an Italian record", holds: (verdict) => verdict.kind === "excluded" && verdict.reason === "not-italian" },
  {
    heading: "No en.wiktionary confirmation",
    holds: (verdict) => verdict.kind === "excluded" && ["no-en-page", "no-italian-entry", "no-section-for-pos", "no-plural-statement"].includes(verdict.reason),
  },
  { heading: "Other, with a named reason", holds: (verdict) => verdict.kind === "excluded" && ["other-lemma", "sources-disagree", "singular-adjective"].includes(verdict.reason) },
];

function report(verdicts: readonly Verdict[]): string {
  const rows = CLASSES.map(({ heading, holds }) => {
    const held = verdicts.filter(holds);
    return `| ${heading} | ${held.filter((verdict) => verdict.record.pos === "noun").length} | ${held.filter((verdict) => verdict.record.pos === "adj").length} | ${held.length} |`;
  });
  const excluded = verdicts.flatMap((verdict) => (verdict.kind === "excluded" ? [verdict] : []));
  const widened = verdicts.flatMap((verdict) => (verdict.kind === "plural" && verdict.correction.confirmedBy !== "own-pos" ? [verdict] : []));
  const cited = (evidence: readonly Evidence[]): string => evidence.map((entry) => `${entry.title} ${entry.revisionId}`).join(", ");
  return [
    "| Class | Noun | Adj | Total |",
    "|---|---|---|---|",
    ...rows,
    `| **All** | ${verdicts.filter((verdict) => verdict.record.pos === "noun").length} | ${verdicts.filter((verdict) => verdict.record.pos === "adj").length} | ${verdicts.length} |`,
    "",
    "| Line | Word | Pos | Confirmed by | Gender set to | Cited en.wiktionary revisions |",
    "|---|---|---|---|---|---|",
    ...widened.map(({ record, correction }) =>
      `| ${record.lineNo} | \`${record.word}\` | ${record.pos} | ${correction.confirmedBy} | ${correction.facts.gender?.value ?? "—"} | ${cited(correction.evidence)} |`),
    "",
    "| Line | Word | Pos | Reason |",
    "|---|---|---|---|",
    ...excluded.map((verdict) => `| ${verdict.record.lineNo} | \`${verdict.record.word}\` | ${verdict.record.pos} | ${verdict.reason} |`),
    "",
  ].join("\n");
}

const { values } = parseArgs({ options: { archive: { type: "string", default: "it-extract.jsonl.gz" }, repin: { type: "boolean", default: false } } });
const scanned = await scanArchive(values.archive);
const pinned = PLURAL_GLOSS_EVIDENCE.releaseId === scanned.releaseId ? PLURAL_GLOSS_EVIDENCE.pages : [];
const pages = await readPages(scanned.records.flatMap(pagesFor), pinned, values.repin);
const evidence: PluralGlossEvidence = { releaseId: scanned.releaseId, records: scanned.records, pages };
await writeFile(OUT, moduleText(evidence));
process.stdout.write(report(judgeAll(evidence, recordCorrections(HAND_CORRECTIONS))));
