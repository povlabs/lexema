// `pnpm run measure:section-language` — how many archive records tagged
// `lang_code: "it"` are another language's entry, and how well the rule in
// `src/italian/sectionLanguage.ts` finds them (#29).
//
// Reads every Italian record of `it-extract.jsonl.gz` and the page it was
// extracted from in the dump the archive was built from, and lines each record
// up with its part-of-speech block. Every record any signal points at is a
// candidate, and every candidate must carry a hand label in
// `fixtures/section-language/labels.json` before a rate is printed: no number
// here comes from a record nobody read. Six signals: four read the page's
// structure (the rule itself, a bare language line above the block, a heading
// naming another language anywhere, and the translation box above it); two
// read only the record's text, and exist to test how much the structural ones
// miss.
//
// Reads the master's archive and dump from `.data/source/`, fetching a file the
// cache lacks from `povlabs/lexema-data` (src/source/sourceCache.ts); the cache
// is gitignored and absent in CI. Run with `SECTION_LANGUAGE_INPUT=<path>` or
// `RAW_PAGES=<path>` to name another copy of either.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { alignRecords, blockLanguage, headingCodes, LanguageHeadings, type PosBlock, readItalianPosBlocks } from "../italian/sectionLanguage.js";
import { SourceCache } from "../source/sourceCache.js";
import { ARCHIVE_DUMP, VerifiedDump } from "../source/wiktionaryDump.js";
import { parseArchive } from "./importRelease.js";

const source = new SourceCache();
const input = process.env.SECTION_LANGUAGE_INPUT === undefined ? await source.archive() : resolve(process.env.SECTION_LANGUAGE_INPUT);
const dumpPath = process.env.RAW_PAGES === undefined ? await source.dump() : resolve(process.env.RAW_PAGES);
const labelsPath = resolve("fixtures/section-language/labels.json");
const regressionsPath = resolve("fixtures/section-language/regressions.json");
const output = resolve(process.env.SECTION_LANGUAGE_OUTPUT ?? "artifacts/section-language-measure.json");

/** One Italian record, as much of it as the measurement reads. */
interface Held {
  line: number;
  posTitle: string;
  glosses: string[];
  /** Record and sense categories whose suffix names a language other than Italian: `Anatomia-LA`. */
  foreignTopics: string[];
}

type Label = "italian" | "other";
interface LabelEntry {
  word: string;
  posTitle: string;
  label: Label;
  note: string;
}

/** Why a record is a candidate. Each signal is one boolean, so a record carries all that apply. */
interface Signals {
  /** The rule says another language. */
  rule: boolean;
  /** The block's heading names a language other than Italian, wherever it stands. */
  headingOther: boolean;
  /** A bare language line stands above the block. */
  languageLine: boolean;
  /** The block comes after the Italian section's translation box. */
  belowTranslations: boolean;
  /** Every gloss repeats the headword: `curie` → "curie". */
  echoGloss: boolean;
  /** A topic category names another language. */
  foreignTopic: boolean;
}

const FOREIGN_TOPIC = /-([A-Z]{2,3})$/;
const normal = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();

/** Wilson score interval, 95%, for k of n. */
function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.96;
  const p = k / n;
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, centre - margin), Math.min(1, centre + margin)];
}

const labels = JSON.parse(await readFile(labelsPath, "utf8")) as { records: Record<string, LabelEntry> };
const regressions = JSON.parse(await readFile(regressionsPath, "utf8")) as { languageHeadings: string[] };

const byTitle = new Map<string, Held[]>();
const report = await parseArchive({
  input,
  onRejection: () => {},
  onRecord: ({ lineNo, line, record }) => {
    const parsed = JSON.parse(line) as { categories?: string[]; senses?: { categories?: string[]; glosses?: string[] }[] };
    const categories = [...(parsed.categories ?? []), ...(parsed.senses ?? []).flatMap((sense) => sense.categories ?? [])];
    const held: Held = {
      line: lineNo,
      posTitle: record.pos_title,
      glosses: (parsed.senses ?? []).flatMap((sense) => sense.glosses ?? []),
      foreignTopics: categories.filter((category) => FOREIGN_TOPIC.exec(category)?.[1] !== undefined && !category.endsWith("-IT")),
    };
    const list = byTitle.get(record.word) ?? [];
    list.push(held);
    byTitle.set(record.word, list);
  },
});

const dump = await VerifiedDump.open(dumpPath, ARCHIVE_DUMP);
let languages: LanguageHeadings;
const candidates: {
  line: number;
  word: string;
  posTitle: string;
  aligned: boolean;
  revisionId: number;
  block: { line: number; posTemplate: string; headingLanguage: string | null; languageLine: PosBlock["languageLine"]; translationsLine: number | null } | null;
  verdict: ReturnType<typeof blockLanguage> | null;
  signals: Signals;
  glosses: string[];
  foreignTopics: string[];
}[] = [];
const counts = { titles: byTitle.size, titlesWithAPage: 0, alignedTitles: 0, alignedRecords: 0, unalignedTitles: 0, unalignedRecords: 0, headingWithoutLanguage: 0 };
try {
  const codes = new Set<string>();
  for await (const page of dump.pages()) for (const code of headingCodes(page)) codes.add(code);
  languages = LanguageHeadings.fromList(codes);
  for await (const page of dump.pages()) {
    const records = byTitle.get(page.title);
    if (records === undefined) continue;
    counts.titlesWithAPage += 1;
    const blocks = alignRecords(readItalianPosBlocks(page, languages), records.map((record) => record.posTitle));
    if (blocks === null) {
      counts.unalignedTitles += 1;
      counts.unalignedRecords += records.length;
    } else {
      counts.alignedTitles += 1;
      counts.alignedRecords += records.length;
    }
    records.forEach((record, index) => {
      const block = blocks?.[index];
      const verdict = block === undefined ? null : blockLanguage(block);
      if (block !== undefined && block.headingLanguage === null) counts.headingWithoutLanguage += 1;
      const signals: Signals = {
        rule: verdict?.language === "other",
        headingOther: block !== undefined && block.headingLanguage !== null && block.headingLanguage !== "it",
        languageLine: block?.languageLine != null,
        belowTranslations: block?.translationsLine != null,
        echoGloss: record.glosses.length > 0 && record.glosses.every((gloss) => normal(gloss) === normal(page.title)),
        foreignTopic: record.foreignTopics.length > 0,
      };
      if (!Object.values(signals).some(Boolean)) return;
      candidates.push({
        line: record.line,
        word: page.title,
        posTitle: record.posTitle,
        aligned: blocks !== null,
        revisionId: page.revisionId,
        block: block === undefined ? null : {
          line: block.ref.line,
          posTemplate: block.posTemplate,
          headingLanguage: block.headingLanguage,
          languageLine: block.languageLine,
          translationsLine: block.translationsLine,
        },
        verdict,
        signals,
        glosses: record.glosses.slice(0, 3),
        foreignTopics: record.foreignTopics,
      });
    });
  }
} finally {
  await dump.close();
}

const line = (text: string) => process.stdout.write(`${text}\n`);
const languageList = languages.list();
const fixtureDrift = JSON.stringify(languageList) !== JSON.stringify(regressions.languageHeadings);

await mkdir(resolve(output, ".."), { recursive: true });
const result = { archiveSha256: report.archiveSha256, italianRecords: report.admitted, dump: dumpPath, counts, languageHeadings: languageList, candidates };
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);

line(`archive ${report.archiveSha256.slice(0, 12)}…, ${report.admitted} Italian records, ${counts.titles} titles; ${counts.titlesWithAPage} with a page in ${dumpPath}`);
line(`  lined up with their page's blocks: ${counts.alignedRecords} records (${counts.alignedTitles} titles); not lined up: ${counts.unalignedRecords} records (${counts.unalignedTitles} titles)`);
line(`  language headings in the dump: ${languageList.length}`);
line(`  candidates: ${candidates.length}; details: ${output}`);
if (fixtureDrift) {
  line(`the language headings in ${regressionsPath} differ from the dump's; copy \`languageHeadings\` from ${output}`);
  process.exitCode = 1;
}

const unlabelled = candidates.filter((candidate) => labels.records[String(candidate.line)] === undefined);
const mislabelled = candidates.filter((candidate) => {
  const entry = labels.records[String(candidate.line)];
  return entry !== undefined && (entry.word !== candidate.word || entry.posTitle !== candidate.posTitle);
});
if (unlabelled.length > 0 || mislabelled.length > 0) {
  for (const candidate of unlabelled) line(`  unlabelled: line ${candidate.line} ${candidate.word} (${candidate.posTitle})`);
  for (const candidate of mislabelled) line(`  label names another record: line ${candidate.line} ${candidate.word} (${candidate.posTitle})`);
  line(`no rate is printed until every candidate is labelled in ${labelsPath}`);
  process.exit(1);
}

const isOther = (candidate: (typeof candidates)[number]) => labels.records[String(candidate.line)].label === "other";
const others = candidates.filter(isOther);
const share = (k: number, n: number) => {
  const [low, high] = wilson(k, n);
  return `${k}/${n} (95%: ${(low * 100).toFixed(1)}–${(high * 100).toFixed(1)}%)`;
};
const select = (test: (signals: Signals) => boolean) => candidates.filter((candidate) => test(candidate.signals));
const describe = (name: string, set: typeof candidates) => line(`  ${name}: ${set.length} records, ${set.filter(isOther).length} another language`);

line(`another language, by hand label: ${others.length} records (${new Set(others.map((c) => c.word)).size} titles)`);
const flagged = select((s) => s.rule);
line(`the rule: ${flagged.length} records; precision ${share(flagged.filter(isOther).length, flagged.length)}; ` +
  `recall over the labelled ${others.length}: ${share(flagged.filter(isOther).length, others.length)}`);
describe("language line", select((s) => s.languageLine));
describe("heading names another language, below the translation box", select((s) => s.headingOther && s.belowTranslations));
describe("heading names another language, anywhere", select((s) => s.headingOther));
describe("below the translation box, heading does not name another language", select((s) => s.belowTranslations && !s.headingOther && !s.languageLine));
const structural = select((s) => s.headingOther || s.languageLine || s.belowTranslations);
describe("any structural signal", structural);
const bare = others.filter((c) => c.block !== null && c.block.headingLanguage === null);
line(`  headings naming no language, \`{{-sost-}}\`: ${counts.headingWithoutLanguage} records; ${bare.length} of them another language, ` +
  `${bare.filter((c) => c.signals.rule).length} of those found by the rule`);
const byText = select((s) => s.echoGloss || s.foreignTopic);
const byTextOther = byText.filter(isOther);
const caught = byTextOther.filter((c) => c.signals.headingOther || c.signals.languageLine || c.signals.belowTranslations);
describe("gloss repeats the headword", select((s) => s.echoGloss));
describe("topic category names another language", select((s) => s.foreignTopic));
const [recallLow] = wilson(caught.length, byTextOther.length);
const structuralOthers = structural.filter(isOther).length;
line(`  of the ${byTextOther.length} the two text signals find, the structural signals also find ${share(caught.length, byTextOther.length)}`);
line(`  so the whole population is about ${structuralOthers}, at most ~${Math.ceil(structuralOthers / recallLow)} if that recall holds for records the text signals cannot see`);
