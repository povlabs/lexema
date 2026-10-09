// `pnpm run measure:quality` — how good the dictionary is past the twelve
// spot-checked words (#17), and `pnpm run measure:quality draw` — the sample
// that measurement hand-checks.
//
// Two kinds of answer, kept apart:
//
// - Whole-release counts. Two streaming passes over every Italian record count
//   what the source states and fails to state — definitions, gender and number,
//   verb moods, form-of targets, duplicate forms — against stated denominators.
//   They are exact for this archive and say nothing about whether the Italian
//   is right.
// - A sample. `draw` picks 25 records from each of eight strata by a fixed
//   hash rule and writes them to fixtures/quality-sample/sample.json. Each was
//   then read by hand and labelled in hand-labels.json. Usefulness rates come
//   only from those labels, per stratum, and the run refuses to print one
//   while any sampled record is unlabelled.
//
// Reads the master's archive from `.data/source/` (or QUALITY_INPUT), and the
// recovered layer from the master's dump there (or RAW_PAGES). A file the
// cache lacks is fetched from `povlabs/lexema-data` (src/source/sourceCache.ts).

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readHeadwordLine } from "../italian/furniture.js";
import { placeItalianVerbForm } from "../italian/moods.js";
import {
  duplicateForms,
  glossMood,
  hasAccent,
  hasGlossText,
  isFormOf,
  isThin,
  moodAgreement,
  PageSenses,
  rawTextNames,
  SENSE_KINDS,
  targetResolution,
  type DuplicateRelation,
  type MoodAgreement,
  type QualityRecord,
  type SenseKind,
} from "../italian/recordQuality.js";
import { recordText, recoverDefinitions, SectionRecords } from "../italian/recovery.js";
import { readItalianSections } from "../italian/wikitext.js";
import { SourceCache } from "../source/sourceCache.js";
import { expectedFormDimensions, expectedRecordDimensions, mapStructuralTag } from "./grammarPolicy.js";
import { parseArchive, type ArchiveRecord } from "./importRelease.js";

const source = new SourceCache();
const input = process.env.QUALITY_INPUT === undefined ? await source.archive() : resolve(process.env.QUALITY_INPUT);
const output = resolve(process.env.QUALITY_OUTPUT ?? "artifacts/quality-measure.json");
const SAMPLE = resolve("fixtures/quality-sample/sample.json");
const LABELS = resolve("fixtures/quality-sample/hand-labels.json");
const draw = process.argv[2] === "draw";

/** The rule that picks the sample. Changing anything it hashes is a new sample. */
const SAMPLE_RULE = "it-quality-sample/v1";
const PER_STRATUM = 25;
/** How many of the most frequent example-sentence tokens count as common words. */
const COMMON_TOKENS = 1000;

const STRATA = ["common", "noun", "verb", "adjective", "inflection", "ambiguous", "accented", "thin"] as const;
type Stratum = (typeof STRATA)[number];

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const add = <K>(map: Map<K, number>, key: K, by = 1) => map.set(key, (map.get(key) ?? 0) + by);
const counts = <K extends string>(keys: readonly K[]): Record<K, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;

// Pass 1: what every later count is measured against.

const recordsByWord = new Map<string, number>();
const recordsByWordAndPos = new Map<string, number>();
/** Lemma records (not form-of) by part of speech and word: two of one pair is one word split over two records. */
const lemmasByWordAndPos = new Map<string, number>();
/** Conjugation tables: `forms[]` of every verb record that is not itself a form-of record. */
const verbTables = new Map<string, QualityRecord["forms"][]>();
/** Token counts over every `senses[].examples[].text`, lower-cased. */
const exampleTokens = new Map<string, number>();

/** Every record's verb types, which name a record's siblings for recovery. */
const sectionRecords = new SectionRecords();

const first = await parseArchive({
  input,
  onRejection: () => {},
  onRecord: ({ lineNo, record }) => {
    sectionRecords.add(lineNo, record);
    add(recordsByWord, record.word);
    add(recordsByWordAndPos, `${record.pos}\u0000${record.word}`);
    if (!isFormOf(record)) add(lemmasByWordAndPos, `${record.pos}\u0000${record.word}`);
    if (record.pos === "verb" && record.forms.length > 0 && !isFormOf(record)) {
      verbTables.set(record.word, [...(verbTables.get(record.word) ?? []), record.forms]);
    }
    for (const sense of record.senses as QualityRecord["senses"]) {
      if (!Array.isArray(sense.examples)) continue;
      for (const example of sense.examples as unknown[]) {
        const text = (example as { text?: unknown } | null)?.text;
        if (typeof text !== "string") continue;
        for (const token of text.toLocaleLowerCase("it-IT").match(/\p{L}+/gu) ?? []) add(exampleTokens, token);
      }
    }
  },
});

/**
 * Common words: the most frequent tokens of the dictionary's own usage
 * sentences that are also a headword. No outside frequency list is read; the
 * report states how this skews.
 */
const commonWords = new Set(
  [...exampleTokens]
    .filter(([token]) => recordsByWord.has(token))
    .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1))
    .slice(0, COMMON_TOKENS)
    .map(([token]) => token),
);

function strataOf(record: ArchiveRecord["record"]): Stratum[] {
  const formOf = isFormOf(record);
  const strata: Stratum[] = [];
  if (commonWords.has(record.word)) strata.push("common");
  if (!formOf && record.pos === "noun") strata.push("noun");
  if (!formOf && record.pos === "verb") strata.push("verb");
  if (!formOf && record.pos === "adj") strata.push("adjective");
  if (formOf) strata.push("inflection");
  if ((recordsByWord.get(record.word) ?? 0) > 1) strata.push("ambiguous");
  if (hasAccent(record.word)) strata.push("accented");
  if (isThin(record)) strata.push("thin");
  return strata;
}

const sampleKey = (stratum: Stratum, lineSha256: string): string =>
  createHash("sha256").update(`${SAMPLE_RULE}\n${stratum}\n${lineSha256}`).digest("hex");

// Pass 2: the counts.

const { pages, described } = await source.rawPages();

/** A record's kind is its strongest sense's, in `SENSE_KINDS` order. */
const recordKind = (kinds: readonly SenseKind[]): SenseKind | "no-sense" =>
  SENSE_KINDS.find((kind) => kinds.includes(kind)) ?? "no-sense";

const definitions = {
  records: 0,
  withGlossText: 0,
  /** Records with gloss text the page still numbers no definition for. */
  glossTextButNothingShown: 0,
  shownNothing: 0,
  /** Records with no sense of kind `meaning` or `form-of`, whose only definitions are recovered ones. */
  meaningOnlyThroughRecovery: 0,
  /** Records with gloss text, no sense of kind `meaning` or `form-of`, and nothing recovered. */
  glossTextButNoMeaning: 0,
  byRecordKind: counts([...SENSE_KINDS, "no-sense"] as const),
  senses: counts(SENSE_KINDS),
  /** Records holding at least one sense of each kind. */
  recordsWithSense: counts(SENSE_KINDS),
  /** Records with a furniture sense, by what the page then does with it. */
  furnitureRecords: { hiddenBehindOthers: 0, shownBecauseNothingElse: 0, hiddenAndNothingShown: 0 },
};
interface FurnitureGloss {
  line: number;
  word: string;
  pos: string;
  gloss: string;
  page: keyof typeof definitions.furnitureRecords;
  recovered: number;
}
const furnitureGlosses: FurnitureGloss[] = [];
/** A gloss the headword line leads, which rule `gloss-headword-lead/v1` stores as its prose alone (#325). */
interface HeadwordLeadGloss {
  line: number;
  word: string;
  gloss: string;
  /** Whether the page numbers the sense it belongs to. */
  numbered: boolean;
}
const headwordLeads: HeadwordLeadGloss[] = [];

/**
 * - `unclassified` — no structural tag states it, and a raw tag names it in
 *   prose (`rawTextNames`).
 * - `missing-other-raw-text` — no tag states it and no raw tag names it, though
 *   the record carries raw tags about something else (`diritto`).
 */
type GrammarState = "stated" | "stated-twice" | "unclassified" | "missing-other-raw-text" | "missing";
const GRAMMAR_STATES: readonly GrammarState[] = ["stated", "stated-twice", "unclassified", "missing-other-raw-text", "missing"];
const grammar = new Map<string, Record<GrammarState, number>>();
const grammarCell = (key: string) => {
  if (!grammar.has(key)) grammar.set(key, counts(GRAMMAR_STATES));
  return grammar.get(key)!;
};

/**
 * `forms[]` rows of verb records, split by whether the record is a lemma's
 * conjugation table or a form-of record — a participle's `andati`, whose rows
 * are its gender and number forms and no cell of any table.
 */
const verbRows = () => ({ rows: 0, owedMood: 0, owedAndPlaced: 0, owedAndUnplaced: 0, statedMood: 0 });
const verbForms = { lemma: verbRows(), formOf: verbRows() };

const targets = { edges: 0, anyPos: counts(["resolved", "ambiguous", "dangling"] as const), samePos: counts(["resolved", "ambiguous", "dangling"] as const) };
/** Form-of targets no record carries, with how many edges name each. */
const danglingTargets = new Map<string, number>();
const ambiguousExamples: { line: number; word: string; pos: string; target: string; records: number; samePos: number }[] = [];

const MOOD_AGREEMENTS: readonly MoodAgreement[] = ["corroborated", "elsewhere", "unplaced", "unlisted", "no-table"];
const moods = {
  verbFormOfSenses: 0,
  namesNoMood: 0,
  /** Of the `no-table` answers, how many name a target no record carries at all. */
  noTableTargetHasNoRecord: 0,
  byMood: new Map<string, Record<MoodAgreement, number>>(),
};
/** Every `elsewhere` and `unlisted` answer outside the participle, and the first participle ones, for reading by hand. */
const moodExamples: { line: number; word: string; gloss: string; target: string; agreement: MoodAgreement }[] = [];
let participleExamples = 0;

const duplicates = {
  recordsWithForms: 0,
  recordsWith: counts(["identical", "subsumed", "distinct"] as DuplicateRelation[]),
  groups: counts(["identical", "subsumed", "distinct"] as DuplicateRelation[]),
  byPos: new Map<string, Record<DuplicateRelation, number>>(),
};
const duplicateExamples: { line: number; word: string; pos: string; surface: string; relation: DuplicateRelation; forms: unknown[] }[] = [];

const stratumSize = counts(STRATA);
const candidates = new Map<Stratum, { key: string; lineNo: number }[]>(STRATA.map((stratum) => [stratum, []]));
/** What a sampled record reads as, for the hand label and the scoring. */
interface SampledRecord {
  line: number;
  lineSha256: string;
  word: string;
  pos: string;
  kinds: SenseKind[];
  glossText: boolean;
  shown: number;
  recovered: number;
  glosses: string[];
  recoveredTexts: string[];
}
const sampleDetail = new Map<number, SampledRecord>();
const committedSample: { strata: Record<Stratum, { line: number; lineSha256: string }[]> } | undefined = draw
  ? undefined
  : JSON.parse(await readFile(SAMPLE, "utf8"));
const sampledLines = new Set(committedSample ? Object.values(committedSample.strata).flat().map(({ line }) => line) : []);

const second = await parseArchive({
  input,
  onRejection: () => {},
  onRecord: ({ lineNo, lineSha256, record }) => {
    const word = record.word;

    // Definitions, as the page shows them: read from the stored gloss text,
    // through the lookup's filter, never from the archive's glosses (#400).
    const senses = PageSenses.of(record);
    const kinds = senses.kinds;
    const page = pages.page(word);
    const recovery = page === undefined ? undefined : recoverDefinitions(recordText(record, sectionRecords.siblingsOf(lineNo, record)), page);
    const recovered = recovery?.outcome === "matched" ? recovery.recovered : [];
    const opensList = new Set(recovered.flatMap((definition) => (definition.listedUnder?.in === "sense" ? [definition.listedUnder.senseIndex] : [])));
    const split = senses.split(recovered.length, opensList);
    const shown = split.numbered.length + recovered.length;
    const glossText = hasGlossText(record);
    definitions.records += 1;
    if (glossText) definitions.withGlossText += 1;
    if (glossText && shown === 0) definitions.glossTextButNothingShown += 1;
    if (shown === 0) definitions.shownNothing += 1;
    const ownMeaning = kinds.some((kind) => kind === "meaning" || kind === "form-of");
    if (!ownMeaning && recovered.length > 0) definitions.meaningOnlyThroughRecovery += 1;
    if (glossText && !ownMeaning && recovered.length === 0) definitions.glossTextButNoMeaning += 1;
    definitions.byRecordKind[recordKind(kinds)] += 1;
    for (const kind of kinds) definitions.senses[kind] += 1;
    for (const kind of new Set(kinds)) definitions.recordsWithSense[kind] += 1;
    if (split.furniture.length > 0) {
      // What the page does with the furniture, by the split it renders from.
      const treatment: FurnitureGloss["page"] = !split.furnitureHidden
        ? "shownBecauseNothingElse"
        : shown > 0
          ? "hiddenBehindOthers"
          : "hiddenAndNothingShown";
      definitions.furnitureRecords[treatment] += 1;
      for (const index of split.furniture) {
        for (const gloss of senses.glosses(index)) {
          const row: FurnitureGloss = { line: lineNo, word, pos: record.pos, gloss, page: treatment, recovered: recovered.length };
          furnitureGlosses.push(row);
        }
      }
    }
    // Read off the archive's glosses: the stored text no longer has the lead.
    record.senses.forEach((sense, index) => {
      for (const gloss of strings(sense.glosses)) {
        if (readHeadwordLine(gloss, word)?.kind !== "lead") continue;
        headwordLeads.push({ line: lineNo, word, gloss, numbered: split.numbered.includes(index) });
      }
    });

    // Gender and number, where the importer expects them.
    const formOf = isFormOf(record);
    const recordTags = strings(record.tags);
    const rawTexts = [...strings(record.raw_tags), ...record.senses.flatMap((sense) => strings(sense.raw_tags))];
    const rawNames = new Set<string>(rawTexts.flatMap((text) => [...rawTextNames(text)]));
    for (const dimension of expectedRecordDimensions(record.pos)) {
      const values = new Set(
        recordTags.flatMap((tag) => {
          const mapped = mapStructuralTag(tag);
          return mapped.status === "stated" && mapped.dimension === dimension ? [mapped.value] : [];
        }),
      );
      const cell = grammarCell(`${record.pos} ${formOf ? "form-of" : "lemma"} ${dimension}`);
      if (values.size === 1) cell.stated += 1;
      else if (values.size > 1) cell["stated-twice"] += 1;
      else if (rawNames.has(dimension)) cell.unclassified += 1;
      else if (rawTexts.length > 0) cell["missing-other-raw-text"] += 1;
      else cell.missing += 1;
    }

    // Verb moods on conjugation rows, as the importer and `it-moods/v1` read them.
    for (const form of record.forms) {
      if (typeof form.form !== "string") continue;
      const tags = strings(form.tags);
      const stated = new Set(tags.flatMap((tag) => {
        const mapped = mapStructuralTag(tag);
        return mapped.status === "stated" ? [mapped.dimension] : [];
      }));
      if (record.pos !== "verb") continue;
      const tally = formOf ? verbForms.formOf : verbForms.lemma;
      tally.rows += 1;
      if (stated.has("mood")) tally.statedMood += 1;
      if (expectedFormDimensions(record.pos, stated).includes("mood")) {
        tally.owedMood += 1;
        const slot = placeItalianVerbForm({ tags, rawTags: strings(form.raw_tags) });
        if (slot.kind === "unplaced") tally.owedAndUnplaced += 1;
        else tally.owedAndPlaced += 1;
      }
    }

    // Form-of targets, and the mood a verb form's gloss names against its target's table.
    record.senses.forEach((sense) => {
      for (const target of sense.form_of) {
        if (typeof target.word !== "string") continue;
        targets.edges += 1;
        const any = targetResolution(recordsByWord.get(target.word) ?? 0);
        const samePosCount = recordsByWordAndPos.get(`${record.pos}\u0000${target.word}`) ?? 0;
        const same = targetResolution(samePosCount);
        targets.anyPos[any] += 1;
        if (any === "dangling") add(danglingTargets, target.word);
        targets.samePos[same] += 1;
        if (same === "ambiguous" && ambiguousExamples.length < 40) {
          ambiguousExamples.push({ line: lineNo, word, pos: record.pos, target: target.word, records: recordsByWord.get(target.word) ?? 0, samePos: samePosCount });
        }
      }
      if (record.pos !== "verb" || sense.form_of.length === 0) return;
      moods.verbFormOfSenses += 1;
      const gloss = strings(sense.glosses)[0] ?? "";
      const mood = glossMood(gloss);
      const target = sense.form_of[0].word;
      if (mood === undefined || typeof target !== "string") {
        moods.namesNoMood += 1;
        return;
      }
      // A table lists a participle once, masculine singular; its feminine and
      // plural forms are no cell of it, so they are tallied apart.
      const row = mood === "participio" && /femminile|plurale/u.test(gloss) ? "participio, femminile o plurale" : mood;
      if (!moods.byMood.has(row)) moods.byMood.set(row, counts(MOOD_AGREEMENTS));
      const agreement = moodAgreement(word, mood, verbTables.get(target) ?? []);
      moods.byMood.get(row)![agreement] += 1;
      if (agreement === "no-table" && !recordsByWord.has(target)) moods.noTableTargetHasNoRecord += 1;
      if (agreement === "elsewhere" || agreement === "unlisted") {
        if (row !== "participio, femminile o plurale" || participleExamples++ < 40) moodExamples.push({ line: lineNo, word, gloss, target, agreement });
      }
    });

    // Duplicate forms.
    if (record.forms.length > 0) {
      duplicates.recordsWithForms += 1;
      const groups = duplicateForms(record.forms);
      const seen = new Set<DuplicateRelation>();
      for (const group of groups) {
        duplicates.groups[group.relation] += 1;
        seen.add(group.relation);
        if (group.relation !== "distinct" && duplicateExamples.length < 40) {
          duplicateExamples.push({ line: lineNo, word, pos: record.pos, surface: group.surface, relation: group.relation, forms: group.indexes.map((index) => record.forms[index]) });
        }
      }
      for (const relation of seen) {
        duplicates.recordsWith[relation] += 1;
        if (!duplicates.byPos.has(record.pos)) duplicates.byPos.set(record.pos, counts(["identical", "subsumed", "distinct"] as DuplicateRelation[]));
        duplicates.byPos.get(record.pos)![relation] += 1;
      }
    }

    // The sample.
    for (const stratum of strataOf(record)) {
      stratumSize[stratum] += 1;
      if (draw) candidates.get(stratum)!.push({ key: sampleKey(stratum, lineSha256), lineNo });
    }
    if (sampledLines.has(lineNo)) {
      sampleDetail.set(lineNo, {
        line: lineNo,
        lineSha256,
        word,
        pos: record.pos,
        kinds,
        glossText,
        shown,
        recovered: recovered.length,
        glosses: record.senses.flatMap((sense) => strings(sense.glosses)),
        recoveredTexts: recovered.map((definition) => definition.text),
      });
    }
  },
});

if (second.archiveSha256 !== first.archiveSha256) throw new Error("the archive changed between the two passes");

// The sample: drawn, or read back and scored.

const line = (text: string) => process.stdout.write(`${text}\n`);

if (draw) {
  const strata = Object.fromEntries(
    STRATA.map((stratum) => [
      stratum,
      candidates
        .get(stratum)!
        .sort((a, b) => (a.key < b.key ? -1 : 1))
        .slice(0, PER_STRATUM)
        .map(({ lineNo }) => lineNo)
        .sort((a, b) => a - b),
    ]),
  ) as Record<Stratum, number[]>;
  // The words come from a third, cheap read of only the drawn lines.
  const drawn = new Set(Object.values(strata).flat());
  const words = new Map<number, { word: string; pos: string; lineSha256: string }>();
  await parseArchive({
    input,
    onRejection: () => {},
    onRecord: ({ lineNo, lineSha256, record }) => {
      if (drawn.has(lineNo)) words.set(lineNo, { word: record.word, pos: record.pos, lineSha256 });
    },
  });
  const sample = {
    rule: SAMPLE_RULE,
    archiveSha256: first.archiveSha256,
    perStratum: PER_STRATUM,
    commonTokens: COMMON_TOKENS,
    population: stratumSize,
    strata: Object.fromEntries(
      STRATA.map((stratum) => [stratum, strata[stratum].map((lineNo) => ({ line: lineNo, ...words.get(lineNo)! }))]),
    ),
  };
  await mkdir(resolve(SAMPLE, ".."), { recursive: true });
  await writeFile(SAMPLE, `${JSON.stringify(sample, null, 2)}\n`);
  line(`drew ${drawn.size} records into ${SAMPLE}`);
  process.exit(0);
}

interface HandLabel {
  word: string;
  useful: boolean;
  why: string;
}
const labels = JSON.parse(await readFile(LABELS, "utf8").catch(() => "{}")) as Record<string, HandLabel>;

/** Wilson score interval, 95%, for k of n. */
function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = k / n;
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, centre - margin), Math.min(1, centre + margin)];
}

for (const record of sampleDetail.values()) {
  const label = labels[String(record.line)];
  if (label !== undefined && label.word !== record.word) throw new Error(`hand label for line ${record.line} names ${label.word}, not ${record.word}`);
}
for (const { line: lineNo, lineSha256 } of Object.values(committedSample!.strata).flat()) {
  if (sampleDetail.get(lineNo)?.lineSha256 !== lineSha256) {
    throw new Error(`sampled line ${lineNo} is not the line it was drawn from; the archive is not the one the sample names`);
  }
}
const unlabelled = [...sampleDetail.values()].filter((record) => labels[String(record.line)] === undefined);
const scored = unlabelled.length > 0
  ? undefined
  : STRATA.map((stratum) => {
      const records = committedSample!.strata[stratum].map(({ line: lineNo }) => sampleDetail.get(lineNo)!);
      const n = records.length;
      const glossed = records.filter((record) => record.glossText).length;
      const shown = records.filter((record) => record.shown > 0).length;
      const useful = records.filter((record) => labels[String(record.line)].useful).length;
      const shownButNotUseful = records.filter((record) => record.shown > 0 && !labels[String(record.line)].useful).length;
      return {
        stratum,
        population: stratumSize[stratum],
        n,
        glossText: glossed,
        shown,
        useful,
        usefulCi95: wilson(useful, n),
        shownButNotUseful,
      };
    });

// Why a dangling target has no record: no page of that title in the raw
// pages, or a page the extraction made no Italian record of.
const dangling = { targets: danglingTargets.size, noPage: { targets: 0, edges: 0 }, page: { targets: 0, edges: 0 } };
const danglingWithAPage: { word: string; edges: number; italianSections: number }[] = [];
for (const [word, edges] of danglingTargets) {
  const page = pages.page(word);
  const cell = page === undefined ? dangling.noPage : dangling.page;
  cell.targets += 1;
  cell.edges += edges;
  if (page !== undefined) danglingWithAPage.push({ word, edges, italianSections: readItalianSections(page).length });
}
danglingWithAPage.sort((a, b) => b.edges - a.edges || (a.word < b.word ? -1 : 1));

/** Words two or more lemma records of one part of speech carry, by part of speech. */
const splitLemmas: Record<string, number> = {};
for (const [key, n] of lemmasByWordAndPos) if (n > 1) splitLemmas[key.split("\u0000")[0]] = (splitLemmas[key.split("\u0000")[0]] ?? 0) + 1;

const result = {
  archiveSha256: first.archiveSha256,
  italianRecords: first.admitted,
  linesNotAdmitted: { otherLanguage: first.skippedOtherLanguage, malformed: first.malformed, malformedMembers: first.malformedMembers },
  rawPageInput: described,
  commonWords: [...commonWords],
  strata: stratumSize,
  definitions,
  furnitureGlosses,
  headwordLeads,
  grammar: Object.fromEntries(grammar),
  verbForms,
  targets,
  dangling,
  danglingWithAPage,
  splitLemmas,
  ambiguousExamples,
  moods: { ...moods, byMood: Object.fromEntries(moods.byMood) },
  moodExamples,
  duplicates: { ...duplicates, byPos: Object.fromEntries(duplicates.byPos) },
  duplicateExamples,
  sample: [...sampleDetail.values()],
  unlabelled: unlabelled.map(({ line: lineNo, word }) => ({ line: lineNo, word })),
  scored,
};
await mkdir(resolve(output, ".."), { recursive: true });
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);

line(`archive ${first.archiveSha256.slice(0, 12)}…, ${first.admitted} Italian records of ${first.linesRead} lines ` +
  `(${first.skippedOtherLanguage} another language, ${first.malformed} malformed, ${first.malformedMembers} malformed members), raw pages from ${described}`);
line(`definitions: ${definitions.withGlossText} records with gloss text; ${definitions.shownNothing} show no definition ` +
  `(${definitions.glossTextButNothingShown} of them have gloss text); ` +
  `${definitions.meaningOnlyThroughRecovery} have a meaning only through the recovered layer; ${definitions.glossTextButNoMeaning} have gloss text and no meaning at all`);
line(`  record kinds: ${JSON.stringify(definitions.byRecordKind)}`);
line(`  senses: ${JSON.stringify(definitions.senses)}; records holding one: ${JSON.stringify(definitions.recordsWithSense)}`);
line(`  furniture glosses ${furnitureGlosses.length} in ${new Set(furnitureGlosses.map((row) => row.line)).size} records; ` +
  `headword-led definitions ${headwordLeads.length} in ${new Set(headwordLeads.map((row) => row.line)).size} records, ` +
  `${headwordLeads.filter((row) => row.numbered).length} of them numbered`);
line(`dangling targets ${dangling.targets}: no raw page ${JSON.stringify(dangling.noPage)}; a raw page ${JSON.stringify(dangling.page)}`);
line(`form-of edges ${targets.edges}: any part of speech ${JSON.stringify(targets.anyPos)}; same ${JSON.stringify(targets.samePos)}`);
for (const [kind, tally] of Object.entries(verbForms)) {
  line(`verb rows on ${kind} records ${tally.rows}: owed a mood ${tally.owedMood}, placed by it-moods/v1 ${tally.owedAndPlaced}, unplaced ${tally.owedAndUnplaced}, mood tag stated ${tally.statedMood}`);
}
for (const [mood, tally] of moods.byMood) line(`  gloss names ${mood}: ${JSON.stringify(tally)}`);
line(`duplicate forms: ${JSON.stringify(duplicates.recordsWith)} of ${duplicates.recordsWithForms} records with forms`);
if (scored === undefined) line(`sample: ${unlabelled.length} of ${sampleDetail.size} records have no hand label, so no usefulness rate is printed`);
else for (const row of scored) {
  line(`sample ${row.stratum}: ${row.useful}/${row.n} useful [${(row.usefulCi95[0] * 100).toFixed(0)}%, ${(row.usefulCi95[1] * 100).toFixed(0)}%], ` +
    `${row.glossText}/${row.n} with gloss text, ${row.shown}/${row.n} show a definition, ${row.shownButNotUseful} shown but not useful`);
}
line(`details: ${output}`);
