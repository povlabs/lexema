// `pnpm run measure:missing-words` — count the common Italian words the lookup
// answers with nothing, and sort each into our bug, in Wikidata's words, or in
// neither (#807, src/lookup/missingWord.ts).
//
// Two check lists, fetched into the ignored `.data/check-lists/` on first use
// and checked by SHA-256. Neither is a source: nothing else reads them, and
// nothing they hold reaches the dictionary.
//
// - the subtitle frequency list `it_50k.txt` (FrequencyWords, OpenSubtitles
//   2018, CC BY-SA 4.0): its `MISSING_TOP` most frequent words, 20,000 by default;
// - Morph-it! 0.48 (CC BY-SA 2.0 / LGPL): of those, it keeps the forms
//   Morph-it! knows as something other than a proper name, so English names
//   and brands drop out.
//
// The words the brief names (#802) are checked as well, known or not.
//
// Each word goes through the real lookup twice, `lookup()` alone and
// `lookupBatch()` with every other word; a word is missing when the single
// lookup does not find it. Since #818 the lookup answers a declared lemma
// itself, so one is found and never missing. A missing word is then sorted:
// our bug when an archive record heads or lists it, when the lookup answers
// it as a declared lemma, or when Morph-it! names a lemma the lookup finds; else a
// Wikidata word when an Italian lexeme has it (query.wikidata.org); else
// neither.
//
// Reads the local D1 a full seed leaves (docs/RUN_AN_IMPORT.md), read-only:
//
//   SEED_INPUT=.data/source/it-extract.jsonl.gz SEED_SQL=.data/full-sql SEED_STATE=.data/full-state pnpm run seed:dev
//   SEED_STATE=.data/full-state MISSING_JSON=reports/<date>-missing-words.json pnpm run measure:missing-words
//
// Prints Markdown, so a run can be pasted into a report; `MISSING_JSON` names
// a file for the full evidence of every missing word.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isMain } from "../commandLine.js";
import { lookupBatch } from "./batch.js";
import { fromNodeSqlite, type LookupDatabase } from "./database.js";
import { dictionaryFile, masterOf } from "./localDictionary.js";
import { lookup } from "./lookup.js";
import { findNearby } from "./nearby.js";
import {
  BUG_CLASSES,
  groupOf,
  type MissingWordEvidence,
  type MissingWordGroup,
  type MorphAnalysis,
  type WikidataLexeme,
} from "./missingWord.js";

const CHECK_LISTS = ".data/check-lists";

/** A file fetched once and checked by its SHA-256. */
interface CheckList {
  name: string;
  url: string;
  file: string;
  sha256: string;
}

const FREQUENCY: CheckList = {
  name: "FrequencyWords it_50k.txt (OpenSubtitles 2018)",
  url: "https://raw.githubusercontent.com/hermitdave/FrequencyWords/bd9e23103f0a7f89b4c604ecf8638e6f62ee0211/content/2018/it/it_50k.txt",
  file: "it_50k.txt",
  sha256: "bb96cdcb56d28342c1e909db6b2525448b7767136b7e86a2ccc649a1be66fc19",
};

const MORPH_IT: CheckList = {
  name: "Morph-it! 0.48",
  url: "https://docs.sslmit.unibo.it/lib/exe/fetch.php?media=resources:morph-it.tgz",
  file: "morph-it.tgz",
  sha256: "b137343dc095e038ebfaef7c743185e85ec35f5322a1b8629b600e6e898c7024",
};

/** The list inside the Morph-it! archive, in Latin-1. */
const MORPH_IT_LIST = join("current_version", "morph-it_048.txt");

/** The words the brief names (#802), checked whatever the lists say. */
const NAMED = [
  "quei", "quegli", "stanotte", "stavolta", "domattina", "ehi", "oddio", "pochino", "amichetti", "raccontarvi",
  "paralimpico", "handbike", "trasferirsi", "si trasferiscono",
];

/** Morph-it! tags that name no Italian word: proper names, punctuation, symbols, smileys. */
const NOT_A_WORD = /^(NPR|PON|SENT|SYM|SMI)\b/;

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function fetchChecked(list: CheckList, log: (line: string) => void): Promise<string> {
  const path = join(CHECK_LISTS, list.file);
  if (!existsSync(path)) {
    log(`fetching ${list.name}`);
    const response = await fetch(list.url);
    if (!response.ok) throw new Error(`${list.url}: HTTP ${response.status}`);
    await mkdir(CHECK_LISTS, { recursive: true });
    await writeFile(path, new Uint8Array(await response.arrayBuffer()));
  }
  const got = sha256(await readFile(path));
  if (got !== list.sha256) throw new Error(`${path}: SHA-256 ${got}, expected ${list.sha256}`);
  return path;
}

/** The `top` most frequent words, most frequent first, with their counts. */
async function frequentWords(path: string, top: number): Promise<{ word: string; count: number }[]> {
  const lines = (await readFile(path, "utf8")).split("\n").filter((line) => line.length > 0);
  return lines.slice(0, top).map((line) => {
    const [word, count] = line.split(" ");
    return { word, count: Number(count) };
  });
}

/** Every Morph-it! analysis, keyed by the form in lower case. */
async function morphIt(archive: string): Promise<Map<string, MorphAnalysis[]>> {
  const list = join(CHECK_LISTS, MORPH_IT_LIST);
  if (!existsSync(list)) execFileSync("tar", ["-xzf", archive, "-C", CHECK_LISTS]);
  const text = new TextDecoder("latin1").decode(await readFile(list));
  const analyses = new Map<string, MorphAnalysis[]>();
  for (const line of text.split("\n")) {
    const [form, lemma, tag] = line.trimEnd().split("\t");
    if (tag === undefined) continue;
    const key = form.toLowerCase();
    analyses.set(key, [...(analyses.get(key) ?? []), { lemma: lemma.toLowerCase(), tag }]);
  }
  return analyses;
}

const isWord = (analyses: readonly MorphAnalysis[] | undefined) => analyses?.some((analysis) => !NOT_A_WORD.test(analysis.tag)) ?? false;

/** The words archive records head or list in `forms[]`, of those asked, leaving out hidden records (ADR 0023). */
function archiveMentions(raw: DatabaseSync, words: ReadonlySet<string>): { headwords: Set<string>; forms: Map<string, Set<string>> } {
  const headwords = new Set<string>();
  const forms = new Map<string, Set<string>>();
  const rows = raw
    .prepare(
      `SELECT j.raw_json FROM source_record_json j
        WHERE NOT EXISTS (SELECT 1 FROM hidden_record h WHERE h.record_id = j.record_id)`,
    )
    .iterate() as Iterable<{ raw_json: string }>;
  for (const { raw_json } of rows) {
    const record = JSON.parse(raw_json) as { word?: unknown; forms?: { form?: unknown }[] };
    const word = typeof record.word === "string" ? record.word.toLowerCase() : undefined;
    if (word !== undefined && words.has(word)) headwords.add(word);
    for (const entry of record.forms ?? []) {
      if (typeof entry.form !== "string") continue;
      const form = entry.form.toLowerCase();
      if (!words.has(form)) continue;
      forms.set(form, (forms.get(form) ?? new Set()).add(word ?? "?"));
    }
  }
  return { headwords, forms };
}

const SPARQL = "https://query.wikidata.org/sparql";
const WIKIDATA_CHUNK = 80;

/** The Italian (Q652) lexemes with each word as their lemma or one of their forms. */
async function wikidataLexemes(words: readonly string[], log: (line: string) => void): Promise<Map<string, WikidataLexeme[]>> {
  const found = new Map<string, WikidataLexeme[]>();
  for (let start = 0; start < words.length; start += WIKIDATA_CHUNK) {
    const chunk = words.slice(start, start + WIKIDATA_CHUNK);
    const values = chunk.map((word) => `${JSON.stringify(word)}@it`).join(" ");
    const query = `SELECT ?w ?l ?lemma (COUNT(DISTINCT ?s) AS ?senses) (COUNT(DISTINCT ?g) AS ?itGlosses) WHERE {
  VALUES ?w { ${values} }
  ?l dct:language wd:Q652 ; wikibase:lemma ?lemma .
  { ?l wikibase:lemma ?w } UNION { ?l ontolex:lexicalForm/ontolex:representation ?w }
  OPTIONAL { ?l ontolex:sense ?s . OPTIONAL { ?s skos:definition ?g . FILTER(LANG(?g) = "it") } }
} GROUP BY ?w ?l ?lemma`;
    const response = await fetch(SPARQL, {
      method: "POST",
      headers: {
        Accept: "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "lexema-measure-missing-words/1 (https://github.com/povlabs/lexema)",
      },
      body: new URLSearchParams({ query }),
    });
    if (!response.ok) throw new Error(`${SPARQL}: HTTP ${response.status}`);
    const json = (await response.json()) as { results: { bindings: Record<string, { value: string }>[] } };
    for (const row of json.results.bindings) {
      const lexeme: WikidataLexeme = {
        id: row.l.value.replace(/^.*\//, ""),
        lemma: row.lemma.value,
        senses: Number(row.senses.value),
        italianGloss: Number(row.itGlosses.value) > 0,
      };
      found.set(row.w.value, [...(found.get(row.w.value) ?? []), lexeme]);
    }
    log(`${Math.min(start + WIKIDATA_CHUNK, words.length)} of ${words.length} words asked of Wikidata`);
  }
  for (const lexemes of found.values()) lexemes.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  return found;
}

interface Missing {
  word: string;
  /** Rank in the frequency list, 1 for the most frequent; undefined for a named word outside the top. */
  rank: number | undefined;
  named: boolean;
  /** Morph-it! also knows the form as a proper name (`alan`), so its Italian reading may be noise. */
  alsoName: boolean;
  /** Every Morph-it! tag of the form. */
  tags: string[];
  evidence: MissingWordEvidence;
  group: MissingWordGroup;
}

async function measure(file: string, named: string | undefined, top: number, log: (line: string) => void) {
  const frequencyPath = await fetchChecked(FREQUENCY, log);
  const morphPath = await fetchChecked(MORPH_IT, log);
  const frequent = await frequentWords(frequencyPath, top);
  const analyses = await morphIt(morphPath);

  const rankOf = new Map(frequent.map(({ word }, index) => [word, index + 1]));
  const unknown = frequent.filter(({ word }) => !analyses.has(word));
  const nameOnly = frequent.filter(({ word }) => analyses.has(word) && !isWord(analyses.get(word)));
  const kept = frequent.filter(({ word }) => isWord(analyses.get(word))).map(({ word }) => word);
  const probes = [...new Set([...kept, ...NAMED])];
  log(`${frequent.length} frequent words: ${kept.length} known to Morph-it!, ${nameOnly.length} only as names or symbols, ${unknown.length} unknown; ${probes.length} probes with the named words`);

  const raw = new DatabaseSync(file, { readOnly: true });
  const releaseId = masterOf(raw, named);
  const db: LookupDatabase = fromNodeSqlite(raw);

  const found = new Map<string, boolean>();
  const single = async (word: string) => {
    let result = found.get(word);
    if (result === undefined) {
      const { outcome } = await lookup({ db, releaseId, query: word });
      result = outcome === "found" || outcome === "declared-lemma";
      found.set(word, result);
    }
    return result;
  };
  for (const [index, word] of probes.entries()) {
    await single(word);
    if ((index + 1) % 2000 === 0) log(`${index + 1} of ${probes.length} words looked up one at a time`);
  }
  const batch = await lookupBatch({ db, releaseId, queries: probes });
  const batchFound = new Map(probes.map((word, index) => [word, batch.answers[index].outcome === "found"]));
  const disagreements = probes.filter((word) => batchFound.get(word) !== found.get(word));
  log(`batch lookup done; ${disagreements.length} word(s) where single and batch disagree`);

  const missing = probes.filter((word) => found.get(word) === false);
  const missingSet = new Set(missing);
  log(`${missing.length} words missing; reading the archive's records`);
  const mentions = archiveMentions(raw, missingSet);

  const evidence = new Map<string, MissingWordEvidence>();
  for (const word of missing) {
    const answer = await lookup({ db, releaseId, query: word });
    const declared = answer.outcome === "declared-lemma";
    const nearby = await findNearby({ db, releaseId, query: word });
    const accentVariant = nearby.kind === "accent" ? nearby.best : undefined;
    const verbPart = /^si (\S+)$/.exec(word)?.[1];
    let pronominal: MissingWordEvidence["pronominal"];
    if (verbPart !== undefined && (await single(verbPart))) {
      // `trasferiscono` → `trasferire` → `trasferirsi`.
      const verbs = (analyses.get(verbPart) ?? []).filter((analysis) => analysis.tag.startsWith("VER")).map((analysis) => analysis.lemma.replace(/e$/, "si"));
      const servedVerbs = [];
      for (const verb of new Set(verbs)) if (await single(verb)) servedVerbs.push(verb);
      pronominal = { part: verbPart, verb: servedVerbs[0] };
    }
    const foundLemmas: MorphAnalysis[] = [];
    for (const analysis of analyses.get(word) ?? []) {
      if (analysis.lemma !== word && !NOT_A_WORD.test(analysis.tag) && (await single(analysis.lemma))) foundLemmas.push(analysis);
    }
    evidence.set(word, {
      word,
      archiveHeadword: mentions.headwords.has(word),
      archiveForm: mentions.forms.has(word),
      declaredLemma: declared,
      accentVariant,
      pronominal,
      foundLemmas,
      lexemes: [],
    });
  }

  // Wikidata is asked only about the words that are not our bug.
  const unexplained = missing.filter((word) => groupOf(evidence.get(word)!).group !== "our-bug");
  const lexemes = await wikidataLexemes(unexplained, log);
  raw.close();

  const rows: Missing[] = missing.map((word) => {
    const withLexemes = { ...evidence.get(word)!, lexemes: lexemes.get(word) ?? [] };
    const forms = analyses.get(word) ?? [];
    return {
      word,
      rank: rankOf.get(word),
      named: NAMED.includes(word),
      alsoName: forms.some((analysis) => analysis.tag === "NPR"),
      tags: [...new Set(forms.map((analysis) => analysis.tag))],
      evidence: withLexemes,
      group: groupOf(withLexemes),
    };
  });
  return {
    releaseId,
    top,
    counts: { frequent: frequent.length, kept: kept.length, nameOnly: nameOnly.length, unknown: unknown.length, probes: probes.length },
    disagreements,
    namedOutcomes: NAMED.map((word) => ({ word, found: found.get(word) === true })),
    rows,
  };
}

type Measured = Awaited<ReturnType<typeof measure>>;

const rankText = (row: Missing) => (row.rank === undefined ? "named" : `#${row.rank}`);
const wordText = (row: Missing) => (row.alsoName ? `${row.word} (also a name)` : row.word);

function markdown(measured: Measured): string {
  const { releaseId, top, counts, rows } = measured;
  const ours = rows.filter((row) => row.group.group === "our-bug");
  const wikidata = rows.filter((row) => row.group.group === "wikidata");
  const neither = rows.filter((row) => row.group.group === "neither");
  const out = [
    `Release \`${releaseId}\`. Of the ${counts.frequent} most frequent subtitle words, Morph-it! knows ${counts.kept} as Italian words; ${counts.nameOnly} only as names or symbols and ${counts.unknown} not at all, and those are not looked up. With the ${NAMED.length} words the brief names, ${counts.probes} words were looked up, single and batch; single and batch disagree on ${measured.disagreements.length}${measured.disagreements.length === 0 ? "" : ` (${measured.disagreements.join(", ")})`}.`,
    "",
    "| Group | Words |",
    "|---|---:|",
    `| Our bug | ${ours.length} |`,
    `| In Wikidata's words | ${wikidata.length} |`,
    `| In neither | ${neither.length} |`,
    `| Missing in all | ${rows.length} |`,
    "",
    `The top ${top} alone: ${rows.filter((row) => row.rank !== undefined).length} missing.`,
    "",
    `### Our bug (${ours.length})`,
    "",
    "| Bug class | Words |",
    "|---|---:|",
    ...BUG_CLASSES.flatMap((bugClass) => {
      const n = ours.filter((row) => row.group.group === "our-bug" && row.group.bugClass === bugClass).length;
      return n === 0 ? [] : [`| \`${bugClass}\` | ${n} |`];
    }),
    "",
    "| Word | Rank | Bug class | Lemma |",
    "|---|---:|---|---|",
    ...ours.map((row) => {
      const group = row.group as Extract<MissingWordGroup, { group: "our-bug" }>;
      return `| ${wordText(row)} | ${rankText(row)} | \`${group.bugClass}\` | ${group.lemma ?? ""} |`;
    }),
    "",
    `### In Wikidata's words (${wikidata.length})`,
    "",
    "| Word | Rank | Lexeme | Lemma | Italian sense |",
    "|---|---:|---|---|---|",
    ...wikidata.map((row) => {
      const group = row.group as Extract<MissingWordGroup, { group: "wikidata" }>;
      const ids = group.lexemes.map((lexeme) => lexeme.id).join(", ");
      const lemmas = [...new Set(group.lexemes.map((lexeme) => lexeme.lemma))].join(", ");
      return `| ${wordText(row)} | ${rankText(row)} | ${ids} | ${lemmas} | ${group.lexemes.some((lexeme) => lexeme.italianGloss) ? "yes" : "no"} |`;
    }),
    "",
    `### In neither (${neither.length})`,
    "",
    "| Word | Rank | Morph-it! tags |",
    "|---|---:|---|",
    ...neither.map((row) => `| ${wordText(row)} | ${rankText(row)} | ${row.tags.map((tag) => `\`${tag}\``).join(" ") || "unknown"} |`),
  ];
  return out.join("\n");
}

if (isMain(import.meta.url)) {
  const file = await dictionaryFile(resolve(process.env.SEED_STATE ?? ".data/full-state"));
  const top = Number(process.env.MISSING_TOP ?? "20000");
  const measured = await measure(file, process.env.LEXEMA_RELEASE, top, (line) => process.stderr.write(`${line}\n`));
  if (process.env.MISSING_JSON !== undefined) await writeFile(process.env.MISSING_JSON, `${JSON.stringify(measured, null, 2)}\n`);
  process.stdout.write(`${markdown(measured)}\n`);
}
