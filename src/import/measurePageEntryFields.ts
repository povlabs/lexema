// Read-only measurement for #439: over the actual page-only set the seed
// reads (rules v1 and v2, every raw page whose title no archive record
// spells), which of the fields ADR 0026 grants each word's page supplies,
// read by the production rule (src/italian/pageFacts.ts). It writes nothing
// but its JSON, and assumes no page gives every field.
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { isMain } from "../commandLine.js";
import type { RecoveredEntry } from "../italian/pageEntry.js";
import { PAGE_FACT_RULE, type PageFact } from "../italian/pageFacts.js";
import { PUBLISHED_ARCHIVE_SHA256 } from "../source/archiveFacts.js";
import { ARCHIVE_DUMP, VerifiedDump } from "../source/wiktionaryDump.js";
import { parseArchive } from "./importRelease.js";
import { findPageEntries } from "./loadPageEntries.js";

/** The fields ADR 0026 grants, named as the report names them. */
export const GRANTED_FIELDS = [
  "partOfSpeech", "genderNumber", "definitions", "formOf", "forms", "pronunciation",
  "etymology", "synonyms", "antonyms", "derived", "expressions",
] as const;
export type GrantedField = (typeof GRANTED_FIELDS)[number];

/** Which granted fields one entry's page supplies, and how many definitions, labels and examples it has. */
export interface EntryFields {
  posTitle: string;
  posLine: number;
  rule: string;
  definitions: number;
  labels: number;
  examples: number;
  supplied: GrantedField[];
}

const has = (facts: readonly PageFact[], ...kinds: PageFact["kind"][]): boolean => facts.some((fact) => kinds.includes(fact.kind));

/** The granted fields an entry carries, in `GRANTED_FIELDS` order. A part of speech and a definition every entry has. */
export function suppliedFields(entry: RecoveredEntry): EntryFields {
  const { facts, definitions } = entry;
  const present: Record<GrantedField, boolean> = {
    partOfSpeech: true,
    genderNumber: has(facts, "gender", "number"),
    definitions: definitions.length > 0,
    formOf: has(facts, "form-of"),
    forms: has(facts, "form"),
    pronunciation: has(facts, "pronunciation"),
    etymology: has(facts, "etymology"),
    synonyms: has(facts, "synonym"),
    antonyms: has(facts, "antonym"),
    derived: has(facts, "derived"),
    expressions: has(facts, "expression"),
  };
  return {
    posTitle: entry.posTitle,
    posLine: entry.posRef.line,
    rule: entry.rule,
    definitions: definitions.length,
    labels: definitions.reduce((sum, definition) => sum + definition.labels.length, 0),
    examples: definitions.reduce((sum, definition) => sum + definition.examples.length, 0),
    supplied: GRANTED_FIELDS.filter((field) => present[field]),
  };
}

/** One word: its page revision, its entries, and the fields any of them carries. */
export interface WordFields {
  title: string;
  revisionId: number;
  entries: EntryFields[];
  supplied: GrantedField[];
}

/** The entries by word, in title order, as `findPageEntries` returns them. */
export function fieldsByWord(entries: readonly RecoveredEntry[]): WordFields[] {
  const words = new Map<string, WordFields>();
  for (const entry of entries) {
    const word = words.get(entry.page.title) ?? { title: entry.page.title, revisionId: entry.page.revisionId, entries: [], supplied: [] };
    word.entries.push(suppliedFields(entry));
    words.set(entry.page.title, word);
  }
  return [...words.values()].map((word) => ({
    ...word,
    supplied: GRANTED_FIELDS.filter((field) => word.entries.some((entry) => entry.supplied.includes(field))),
  }));
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { archive: { type: "string" }, dump: { type: "string" }, out: { type: "string" } } });
  if (values.archive === undefined || values.dump === undefined || values.out === undefined) {
    throw new Error("usage: pnpm run measure:page-entry-fields --archive <jsonl.gz> --dump <xml.bz2> --out <json>");
  }
  const spelled = new Set<string>();
  const archive = await parseArchive({ input: values.archive, onRejection: () => {}, onRecord: ({ record }) => void spelled.add(record.word) });
  if (archive.archiveSha256 !== PUBLISHED_ARCHIVE_SHA256 || archive.status !== "complete") {
    throw new Error("measurement requires the verified, complete it-0c432803 archive");
  }
  const dump = await VerifiedDump.open(values.dump, ARCHIVE_DUMP);
  let entries: RecoveredEntry[];
  try {
    entries = await findPageEntries(dump.pages(), spelled);
  } finally {
    await dump.close();
  }
  const words = fieldsByWord(entries);
  const count = (field: GrantedField, of: readonly { supplied: readonly GrantedField[] }[]) => of.filter((item) => item.supplied.includes(field)).length;
  const allEntries = words.flatMap((word) => word.entries);
  const output = {
    release: `it-${archive.archiveSha256.slice(0, 8)}`,
    archiveSha256: archive.archiveSha256,
    dump: "itwiktionary-20260701",
    dumpSha1: ARCHIVE_DUMP.sha1,
    rule: PAGE_FACT_RULE,
    words: words.length,
    entries: allEntries.length,
    byField: Object.fromEntries(GRANTED_FIELDS.map((field) => [field, { words: count(field, words), entries: count(field, allEntries) }])),
    everyField: words.filter((word) => word.supplied.length === GRANTED_FIELDS.length).map((word) => word.title),
    titles: words,
  };
  await writeFile(values.out, JSON.stringify(output, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ release: output.release, rule: output.rule, words: output.words, entries: output.entries, byField: output.byField, everyField: output.everyField.length, output: values.out }) + "\n");
}

if (isMain(import.meta.url)) await main();
