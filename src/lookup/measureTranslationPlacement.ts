// `pnpm run measure:translation-placement` — how the four rules of
// src/lookup/translationPlacement.ts place one language's translations (#928):
// for every served page, each distinct translation of its table in that
// language, counted by the rule that placed it, or as unplaced. A translation
// two records take by different rules counts once, under the stronger rule
// (`TranslationPage.outcomes`).
//
// Reads the local D1 a seed leaves (docs/RUN_AN_IMPORT.md), through the same
// read the API places translations with (`readTranslationPages`):
//
//   pnpm run seed:dev
//   pnpm run measure:translation-placement
//
// `SEED_STATE` defaults to `.data/seed-state`, where `pnpm run seed:dev`
// leaves the dev seed; `LEXEMA_RELEASE` names the master, else the one master
// the database serves; `LANG_CODE` is the language counted, `en` by default.
// The database is opened read-only. Prints Markdown, so a run can be pasted
// into a pull request or a report.

import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isMain } from "../commandLine.js";
import { fromNodeSqlite } from "./database.js";
import { dictionaryFile, masterOf } from "./localDictionary.js";
import { dictionaryTables } from "./served.js";
import { readTranslationPages } from "./translationPages.js";
import type { Outcome } from "./translationPlacement.js";

/** How many headwords are read at a time. */
const CHUNK = 200;

const ROWS: readonly { outcome: Outcome; heading: string }[] = [
  { outcome: "pos-marker", heading: "Rule 1: a leading part-of-speech marker" },
  { outcome: "definition", heading: "Rule 2: a label equal to one of the record's definitions" },
  { outcome: "only-part-of-speech", heading: "Rule 3: a page of one part of speech" },
  { outcome: "unplaced", heading: "Rule 4: unplaced" },
];

async function measure(file: string, named: string | undefined, langCode: string): Promise<string> {
  const raw = new DatabaseSync(file, { readOnly: true });
  const releaseId = masterOf(raw, named);
  const db = fromNodeSqlite(raw);
  const tables = await dictionaryTables(db);
  const headwords = (
    raw
      .prepare(
        `SELECT DISTINCT r.word FROM lookup_form lf JOIN source_record r ON r.record_id = lf.record_id
          WHERE lf.release_id IN (SELECT release_id FROM served_release WHERE master_release_id = ?1) AND lf.origin = 'headword'
          ORDER BY r.word`,
      )
      .all(releaseId) as { word: string }[]
  ).map((row) => row.word);

  const counts = new Map<Outcome, number>(ROWS.map(({ outcome }) => [outcome, 0]));
  let pages = 0;
  for (let at = 0; at < headwords.length; at += CHUNK) {
    for (const page of (await readTranslationPages(db, releaseId, tables, headwords.slice(at, at + CHUNK))).values()) {
      const outcomes = page.outcomes().filter(({ translation }) => translation.langCode === langCode);
      if (outcomes.length > 0) pages += 1;
      for (const { outcome } of outcomes) counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
    }
  }
  raw.close();

  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  return [
    `Release \`${releaseId}\`: ${total} \`${langCode}\` translations on ${pages} pages.`,
    "",
    "| Placement | Translations |",
    "|---|---:|",
    ...ROWS.map(({ outcome, heading }) => `| ${heading} | ${counts.get(outcome)} |`),
  ].join("\n");
}

if (isMain(import.meta.url)) {
  const file = await dictionaryFile(resolve(process.env.SEED_STATE ?? ".data/seed-state"));
  process.stdout.write(`${await measure(file, process.env.LEXEMA_RELEASE, process.env.LANG_CODE ?? "en")}\n`);
}
