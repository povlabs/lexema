// What the declared-lemma page (#453) does over a whole master: every word a
// served form_of edge names and no served record heads, searched the way the
// page searches it (web/lib/dictionary/searchAttempt.ts). Aggregate counts
// only, and the dictionary is opened read-only.
//
//   TSX_TSCONFIG_PATH=web/tsconfig.json pnpm exec tsx tools/measureDeclaredLemmas.ts <master.sqlite> <master release id>
//
// reports/2026-10-03-declared-lemmas.md is its first run.

import { DatabaseSync } from "node:sqlite";
import { readPluralGloss } from "../src/italian/pluralGloss.js";
import { readVerbFormGloss } from "../src/italian/verbFormGloss.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { DECLARED_LEMMA_SQL } from "../src/lookup/declaredLemma.js";
import { servedBy } from "../src/lookup/served.js";
import type { DeclaredLemmaPage } from "../web/lib/dictionary/declaredLemmaPage.ts";
import { searchAttempt } from "../web/lib/dictionary/searchAttempt.ts";

const [path, release] = process.argv.slice(2);
if (!path || !release) throw new Error("usage: tools/measureDeclaredLemmas.ts <master.sqlite> <master release id>");
const sqlite = new DatabaseSync(path, { readOnly: true });
const db = fromNodeSqlite(sqlite);

/** Every edge target no served record heads, with one of its spellings. */
const DANGLING_SQL = `SELECT e.target_word_key AS key, min(e.target_word) AS word, count(*) AS edges
       FROM form_of_edge e
      WHERE e.release_id IN (${servedBy("?1")})
        AND NOT EXISTS (
              SELECT 1 FROM lookup_form lf
               WHERE lf.release_id IN (${servedBy("?1")}) AND lf.surface_key = e.target_word_key AND lf.origin = 'headword')
      GROUP BY e.target_word_key
      ORDER BY e.target_word_key`;

const count = (into: Record<string, number>, key: string, by = 1) => {
  into[key] = (into[key] ?? 0) + by;
};

/** How many of the page's forms take a cell. A form is one edge; a plural in two genders' cells counts once. */
function placedForms(page: DeclaredLemmaPage): number {
  const placed = new Set<object>();
  for (const { table } of page.readings) {
    if (table.shape === "grid") {
      for (const row of table.grid.rows) for (const cell of row.cells) for (const spelling of cell.spellings) spelling.declaredForms.forEach((form) => placed.add(form));
    } else {
      for (const item of table.conjugation.nonFinite) item.forms.forEach((form) => placed.add(form));
      for (const mood of table.conjugation.moods) {
        for (const tense of [...mood.simple, ...mood.compound]) for (const cell of tense.cells) cell.forms.forEach((form) => placed.add(form));
      }
    }
  }
  return placed.size;
}

/** The slots a verb's own table fills from these glosses: seven simple tenses, the imperative's five persons, gerundio and participio. */
const PERSONS = ["io", "tu", "lui, lei", "noi", "voi", "loro"] as const;
const SLOTS: readonly string[] = [
  ...(
    [["Indicativo", "presente"], ["Indicativo", "imperfetto"], ["Indicativo", "passato remoto"], ["Indicativo", "futuro semplice"],
      ["Congiuntivo", "presente"], ["Congiuntivo", "imperfetto"], ["Condizionale", "presente"]] as const
  ).flatMap(([mood, tense]) => PERSONS.map((person) => `${mood} ${tense} ${person}`)),
  ...PERSONS.slice(1).map((person) => `Imperativo presente ${person}`),
  "gerundio",
  "participio",
];

/** The slots of `SLOTS` a verb page leaves empty. */
function emptySlots(page: DeclaredLemmaPage): string[] {
  const verb = page.readings.find(({ reading }) => reading.pos === "verb");
  if (verb === undefined || verb.table.shape !== "conjugation") return [...SLOTS];
  const filled = new Set<string>(verb.table.conjugation.nonFinite.map((item) => item.label));
  for (const mood of verb.table.conjugation.moods) {
    for (const tense of mood.simple) {
      tense.cells.forEach((cell, i) => {
        if (cell.forms.length > 0) filled.add(`${mood.mood} ${tense.name} ${mood.persons[i]}`);
      });
    }
  }
  return SLOTS.filter((slot) => !filled.has(slot));
}

const dangling = sqlite.prepare(DANGLING_SQL).all(release) as { key: string; word: string; edges: number }[];
const outcomes: Record<string, number> = {};
const pagesByPos: Record<string, number> = {};
const edges: Record<string, number> = {};
let fullVerbTables = 0;
let verbPages = 0;
/** Verb pages by how many of `SLOTS` they leave empty, and how often each slot is empty. */
const emptyCells: Record<string, number> = {};
const emptiest: Record<string, number> = {};
const started = Date.now();

for (const { key, word, edges: total } of dangling) {
  count(edges, "named", total);
  const attempt = await searchAttempt(db, release, word);
  const outcome = attempt.outcome === "found" ? `found (${attempt.route.kind})` : attempt.outcome;
  count(outcomes, outcome);

  // Each edge, by what the rules make of its gloss.
  const rows = (await db.all<{ pos: string; target_word: string; gloss: string | null }>(DECLARED_LEMMA_SQL, [release, key]));
  let read = 0;
  for (const row of rows) {
    if (row.gloss === null) count(edges, "no gloss");
    else if (row.pos === "verb") {
      if (readVerbFormGloss(row.gloss, row.target_word) === undefined) count(edges, "verb: refused by it-verb-form-gloss/v1");
      else read += 1;
    } else if (row.pos === "noun" || row.pos === "adj") {
      if (readPluralGloss(row.gloss, row.target_word) === undefined) count(edges, `${row.pos}: refused by it-plural-gloss/v1`);
      else read += 1;
    } else count(edges, `declared by another part of speech (${row.pos})`);
  }
  count(edges, "read by a rule", read);

  if (attempt.outcome === "declared-lemma") {
    const placed = placedForms(attempt.page);
    count(edges, "read and placed in a cell", placed);
    count(edges, "read, on a page, but in no cell", read - placed);
    count(pagesByPos, attempt.page.readings.map(({ reading }) => reading.posTitle).join(" + "));
    if (attempt.page.readings.some(({ reading }) => reading.pos === "verb")) {
      verbPages += 1;
      const empty = emptySlots(attempt.page);
      if (empty.length === 0) fullVerbTables += 1;
      count(emptyCells, empty.length === 0 ? "0" : empty.length <= 5 ? "1-5" : empty.length <= 20 ? "6-20" : "21+");
      for (const slot of empty) count(emptiest, slot);
    }
  } else {
    count(edges, `read, but the lemma has no page (${outcome})`, read);
  }
}

console.log(JSON.stringify({
  release,
  danglingLemmas: dangling.length,
  outcomes,
  pagesByPartOfSpeech: pagesByPos,
  verbPages,
  fullVerbTables,
  verbPagesByEmptySlots: emptyCells,
  emptiestSlots: Object.fromEntries(Object.entries(emptiest).sort((a, b) => b[1] - a[1]).slice(0, 8)),
  edges,
  ms: Date.now() - started,
}, null, 2));
sqlite.close();
