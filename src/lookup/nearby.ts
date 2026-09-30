// What a search that found nothing offers instead (#142, board 24): the
// expression its words spell as their lemmas (`vado via` → `andare via`, #214),
// the same letters with an accent (`citta` → `città`), a spelling one edit away
// (`mangare` → `mangiare`), or the words that begin with what was typed
// (`bab`). Each step runs only when the one before it found nothing, and each
// is an indexed read: `accent_fold` and `typo_key` are written by the seed
// (src/import/seedSql.ts), and the prefix list is the search field's own
// `suggest`. Nothing here scores the whole word list per request.
//
// This is not a lookup. It names spellings a reader might mean; following one
// runs the real lookup for it.

import { normalizeItalianExact } from "../italian/normalize.js";
import type { LookupDatabase } from "./database.js";
import { phraseHeadwords } from "./phrase.js";
import { suggest } from "./suggest.js";

/** A key with its accents taken off: `città` → `citta`. The query is folded the same way. */
export function foldKey(key: string): string {
  return key.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
}

/** A key and every spelling of it with one character left out: the typo index's keys. */
export function deletionKeys(key: string): string[] {
  const chars = [...key];
  return [...new Set([key, ...chars.map((_, i) => [...chars.slice(0, i), ...chars.slice(i + 1)].join(""))])];
}

/**
 * Whether two keys are at most one edit apart: one character inserted,
 * deleted or replaced, or two neighbours swapped (restricted
 * Damerau–Levenshtein). The deletion index proposes candidates; this is what
 * keeps only the true ones.
 */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const x = [...a];
  const y = [...b];
  if (Math.abs(x.length - y.length) > 1) return false;
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  const rest = (from: string[], at: number) => from.slice(at).join("");
  if (x.length === y.length) {
    // One replacement, or one swap of neighbours.
    return rest(x, i + 1) === rest(y, i + 1) || (x[i] === y[i + 1] && x[i + 1] === y[i] && rest(x, i + 2) === rest(y, i + 2));
  }
  // One insertion or deletion.
  return x.length > y.length ? rest(x, i + 1) === rest(y, i) : rest(x, i) === rest(y, i + 1);
}

/** A spelling that might be meant, and what ranks it. */
export interface Candidate {
  key: string;
  /** The spelling shown and searched for, as the source writes it. */
  surface: string;
  /** 0 for the same letters with other accents, 1 for one edit away. */
  edits: number;
  /** Some record's own headword, not only a form inside a table. */
  headword: boolean;
  /** Distinct languages its lemma records translate into: how common it is, as the source can say. */
  languages: number;
  /** Its lemma records' senses plus forms; the tie-break when languages tie (often at 0). */
  richness: number;
}

/**
 * Fewest edits; then the more common word, as the source can say: more
 * translation languages, then more senses and forms (Huey, 2026-09-27:
 * `mangare` offers `mangiare` before `magnare`); then a headword before a
 * form, then shorter, then alphabetical.
 */
export function rankCandidates(candidates: readonly Candidate[]): Candidate[] {
  return [...candidates].sort(
    (a, b) =>
      a.edits - b.edits ||
      b.languages - a.languages ||
      b.richness - a.richness ||
      Number(b.headword) - Number(a.headword) ||
      [...a.surface].length - [...b.surface].length ||
      a.surface.localeCompare(b.surface, "it-IT"),
  );
}

/** How many spellings a list offers, and how many prefix words the page shows before `+ more`. */
export const NEARBY_LIMIT = 8;
/** The longest key the typo step tries: its deletions are bound parameters, and D1 allows 100. */
export const TYPO_MAX_LENGTH = 30;
/**
 * The shortest key the typo step tries. A two- or three-letter key is one edit
 * from dozens of words (`bab` from `AB`, `BA`, `bar`, `bau`, `bob` on the full
 * release), none of them a better guess than the words that begin with it.
 */
export const TYPO_MIN_LENGTH = 4;

/**
 * What the not-found page offers, one shape per case on board 24. A best guess
 * leads `phrase`, `accent` and `typo`; `others` follow it. The `phrase` lead is
 * the first lemma sequence tried, not a ranked guess.
 */
export type Nearby =
  | { kind: "phrase"; best: string; others: string[] }
  | { kind: "accent"; best: string; others: string[] }
  | { kind: "typo"; best: string; others: string[] }
  | { kind: "prefix"; words: string[] }
  | { kind: "none" };

const placeholders = (count: number, from: number): string =>
  Array.from({ length: count }, (_, i) => `?${from + i}`).join(",");

/** The spelling to show for each key, a headword's before a form's. */
async function surfacesFor(db: LookupDatabase, releaseId: string, keys: readonly string[]): Promise<Map<string, { surface: string; headword: boolean }>> {
  if (keys.length === 0) return new Map();
  const rows = await db.all<{ surface_key: string; surface: string; origin: string }>(
    `SELECT surface_key, surface, origin FROM lookup_form
      WHERE release_id = ?1 AND surface_key IN (${placeholders(keys.length, 2)})
      ORDER BY origin = 'headword' DESC, lookup_id`,
    [releaseId, ...keys],
  );
  const found = new Map<string, { surface: string; headword: boolean }>();
  for (const row of rows) {
    if (!found.has(row.surface_key)) found.set(row.surface_key, { surface: row.surface, headword: row.origin === "headword" });
  }
  return found;
}

/** A candidate key's edit count and how common it is, as its index row states them. */
interface Found {
  edits: number;
  languages: number;
  richness: number;
}

async function candidatesFor(
  db: LookupDatabase,
  releaseId: string,
  keys: ReadonlyMap<string, Found>,
): Promise<Candidate[]> {
  const surfaces = await surfacesFor(db, releaseId, [...keys.keys()]);
  return rankCandidates(
    [...keys].flatMap(([key, found]) => {
      const spelled = surfaces.get(key);
      return spelled === undefined ? [] : [{ key, surface: spelled.surface, headword: spelled.headword, ...found }];
    }),
  );
}

/** Step 2: the same letters with other accents, including an unaccented spelling of an accented query. */
async function accentMatches(db: LookupDatabase, releaseId: string, key: string): Promise<Candidate[]> {
  const folded = foldKey(key);
  const rows = await db.all<{ surface_key: string; languages: number; richness: number }>(
    "SELECT surface_key, languages, richness FROM accent_fold WHERE release_id = ?1 AND fold_key = ?2",
    [releaseId, folded],
  );
  const keys = new Map<string, Found>(
    rows.map((row) => [row.surface_key, { edits: 0, languages: row.languages, richness: row.richness }]),
  );
  // An unaccented spelling of an accented query is not in accent_fold; it ranks last among equals.
  if (folded !== key && !keys.has(folded)) keys.set(folded, { edits: 0, languages: 0, richness: 0 });
  keys.delete(key);
  return candidatesFor(db, releaseId, keys);
}

/** Step 3: a lemma headword one edit away, through its stored deletions. */
async function typoMatches(db: LookupDatabase, releaseId: string, key: string): Promise<Candidate[]> {
  const length = [...key].length;
  if (length < TYPO_MIN_LENGTH || length > TYPO_MAX_LENGTH) return [];
  const probes = deletionKeys(key);
  const rows = await db.all<{ surface_key: string; languages: number; richness: number }>(
    `SELECT DISTINCT surface_key, languages, richness FROM typo_key WHERE release_id = ?1 AND deletion_key IN (${placeholders(probes.length, 2)})`,
    [releaseId, ...probes],
  );
  const keys = new Map<string, Found>(
    rows
      .filter((row) => row.surface_key !== key && withinOneEdit(key, row.surface_key))
      .map((row) => [row.surface_key, { edits: 1, languages: row.languages, richness: row.richness }]),
  );
  return candidatesFor(db, releaseId, keys);
}

/**
 * Step 1: the multi-word headwords the query's words spell as their lemmas
 * (src/lookup/phrase.ts), each as the source spells it.
 */
async function phraseOffers(db: LookupDatabase, releaseId: string, key: string): Promise<string[]> {
  const keys = await phraseHeadwords(db, releaseId, key);
  const surfaces = await surfacesFor(db, releaseId, keys);
  return keys.flatMap((phrase) => {
    const spelled = surfaces.get(phrase);
    return spelled === undefined ? [] : [spelled.surface];
  });
}

/**
 * What to offer for a query the exact lookup did not find, trying each step
 * only when the one before found nothing: the expressions its words spell,
 * then accent, then one edit, then the words that begin with it, then nothing.
 */
export async function findNearby({ db, releaseId, query }: { db: LookupDatabase; releaseId: string; query: string }): Promise<Nearby> {
  const key = normalizeItalianExact(query);
  if (key === "") return { kind: "none" };

  // Every expression the words spell is offered: they are headwords, not guesses.
  const [phrase, ...morePhrases] = await phraseOffers(db, releaseId, key);
  if (phrase !== undefined) return { kind: "phrase", best: phrase, others: morePhrases };

  const prefixWords = async (): Promise<string[]> => {
    const answer = await suggest({ db, releaseId, prefix: query });
    return answer.outcome === "suggested" ? answer.suggestions : [];
  };

  const accent = await accentMatches(db, releaseId, key);
  if (accent.length > 0) {
    const [best, ...rest] = accent;
    const others = [...rest.map((c) => c.surface), ...(await prefixWords()).filter((w) => w !== best.surface)];
    return { kind: "accent", best: best.surface, others: [...new Set(others)].slice(0, NEARBY_LIMIT) };
  }

  const typo = await typoMatches(db, releaseId, key);
  if (typo.length > 0) {
    const [best, ...rest] = typo;
    return { kind: "typo", best: best.surface, others: rest.map((c) => c.surface).slice(0, NEARBY_LIMIT) };
  }

  const words = await prefixWords();
  return words.length > 0 ? { kind: "prefix", words } : { kind: "none" };
}
