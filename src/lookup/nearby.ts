// What a search that found nothing offers instead (#142, board 24): the same
// letters with an accent (`citta` → `città`) or a final apostrophe (`dall` →
// `dall'`, #468), a spelling one edit away
// (`mangare` → `mangiare`), or the words that begin with what was typed
// (`bab`). Each step is offered only when the one before it found nothing, and
// each is an indexed read: `accent_fold` and `typo_key` are written by the seed
// (src/import/seedSql.ts), and the prefix list is the search field's own
// `suggest`. Nothing here scores the whole word list per request.
//
// A query of several words also gets itself corrected so that it reads as a
// multi-word headword (`vadoo via` → `vado via`, which opens *andare via*'s
// short page; #214, src/lookup/phrase.ts). These join the "Did you mean" list
// after an accent or a typo match, and lead it when there is neither.
//
// This is not a lookup. It names spellings a reader might mean; following one
// runs the real lookup for it.

import { normalizeItalianExact } from "../italian/normalize.js";
import type { LookupDatabase } from "./database.js";
import { nearPhrases, type PhraseOffer } from "./phrase.js";
import { servedBy } from "./served.js";
import { suggest } from "./suggest.js";

/** A key with its accents taken off: `città` → `citta`. The query is folded the same way. */
export function foldKey(key: string): string {
  return key.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
}

/**
 * The letters an accent offer matches on: a key with its accents and a final
 * apostrophe taken off, so `città` and `po'` match `citta` and `po`. Stored
 * keys are folded by `foldKey` alone; the apostrophe is the query's to add
 * (`accentMatches`).
 */
export function bareKey(key: string): string {
  const folded = foldKey(key);
  return folded.length > 1 && folded.endsWith("'") ? folded.slice(0, -1) : folded;
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
 * leads `accent`, `typo` and `phrase`; `others` follow it. `phrases` are the
 * query corrected so that it reads as a multi-word headword, which join the
 * list after an accent or a typo match; with neither, they are the `phrase`
 * offer itself. Each is offered as its `phrase`, the words to search.
 */
export type Nearby =
  | { kind: "accent"; best: string; others: string[]; phrases: PhraseOffer[] }
  | { kind: "typo"; best: string; others: string[]; phrases: PhraseOffer[] }
  | { kind: "phrase"; best: PhraseOffer; others: PhraseOffer[] }
  | { kind: "prefix"; words: string[] }
  | { kind: "none" };

const placeholders = (count: number, from: number): string =>
  Array.from({ length: count }, (_, i) => `?${from + i}`).join(",");

/** The spelling to show for each key, a headword's before a form's. */
async function surfacesFor(db: LookupDatabase, releaseId: string, keys: readonly string[]): Promise<Map<string, { surface: string; headword: boolean }>> {
  if (keys.length === 0) return new Map();
  const rows = await db.all<{ surface_key: string; surface: string; origin: string }>(
    `SELECT surface_key, surface, origin FROM lookup_form
      WHERE release_id IN (${servedBy("?1")}) AND surface_key IN (${placeholders(keys.length, 2)})
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

/** How common a key is, as its own `typo_key` row states it; 0 and 0 for a key that is no lemma headword. */
async function scoreOf(db: LookupDatabase, releaseId: string, key: string): Promise<Found> {
  const [row] = await db.all<{ languages: number; richness: number }>(
    `SELECT languages, richness FROM typo_key WHERE release_id IN (${servedBy("?1")}) AND deletion_key = ?2 AND surface_key = ?2`,
    [releaseId, key],
  );
  return { edits: 0, languages: row?.languages ?? 0, richness: row?.richness ?? 0 };
}

/**
 * The keys with the same letters as `key` once accents and a final apostrophe
 * are set aside, as `accent_fold` and the apostrophe probe find them. A key
 * nothing spells is kept here and dropped when its surface is read.
 */
async function sameLetterKeys(db: LookupDatabase, releaseId: string, key: string): Promise<Map<string, Found>> {
  const folded = foldKey(key);
  // `accent_fold` keys on accents alone, so the apostrophe is added here and
  // probed there, for an accented spelling, and as a key of its own.
  const elided = key.endsWith("'") ? undefined : `${folded}'`;
  const folds = elided === undefined ? [folded] : [folded, elided];
  const [rows, elidedScore] = await Promise.all([
    db.all<{ surface_key: string; languages: number; richness: number }>(
      `SELECT surface_key, languages, richness FROM accent_fold WHERE release_id IN (${servedBy("?1")}) AND fold_key IN (${placeholders(folds.length, 2)})`,
      [releaseId, ...folds],
    ),
    elided === undefined ? undefined : scoreOf(db, releaseId, elided),
  ]);
  const keys = new Map<string, Found>(
    rows.map((row) => [row.surface_key, { edits: 0, languages: row.languages, richness: row.richness }]),
  );
  if (elided !== undefined && elidedScore !== undefined) keys.set(elided, elidedScore);
  return keys;
}

/**
 * Step 2: the same letters with other accents, including an unaccented
 * spelling of an accented query, or with the final apostrophe the query left
 * off (#468).
 */
async function accentMatches(db: LookupDatabase, releaseId: string, key: string): Promise<Candidate[]> {
  const keys = await sameLetterKeys(db, releaseId, key);
  const folded = foldKey(key);
  // An unaccented spelling of an accented query is not in accent_fold; it ranks last among equals.
  if (folded !== key && !keys.has(folded)) keys.set(folded, { edits: 0, languages: 0, richness: 0 });
  keys.delete(key);
  return candidatesFor(db, releaseId, keys);
}

const isMark = (char: string): boolean => /\p{M}/u.test(char);

/**
 * Whether `written` is `key` with marks added and none taken away: accents,
 * and a final apostrophe. `citta` → `città` and `po` → `po'` are; `città` →
 * `citta` drops one, `perchè` → `perché` swaps one, and a key is not its own.
 */
export function addsMarksTo(key: string, written: string): boolean {
  if (written === key) return false;
  const typed = [...key.normalize("NFD")];
  const chars = [...written.normalize("NFD")];
  let at = 0;
  for (const [i, char] of chars.entries()) {
    if (at < typed.length && char === typed[at]) at += 1;
    else if (!isMark(char) && !(char === "'" && i === chars.length - 1)) return false;
  }
  return at === typed.length;
}

/**
 * The headwords that write a found query with an accent or a final apostrophe
 * it lacks (#478): `citta` → `città`, `po` → `po'`, `e` → `è`. Ranked as the
 * not-found accent offer ranks them; a spelling that drops or swaps a mark the
 * query has is never one (`città` offers no `citta`).
 */
export async function writtenSpellings({ db, releaseId, query }: { db: LookupDatabase; releaseId: string; query: string }): Promise<string[]> {
  const key = normalizeItalianExact(query);
  if (key === "") return [];
  const keys = await sameLetterKeys(db, releaseId, key);
  for (const candidate of keys.keys()) if (!addsMarksTo(key, candidate)) keys.delete(candidate);
  const candidates = await candidatesFor(db, releaseId, keys);
  return candidates.filter((candidate) => candidate.headword).map((candidate) => candidate.surface);
}

/** Step 3: a lemma headword one edit away, through its stored deletions. */
async function typoMatches(db: LookupDatabase, releaseId: string, key: string): Promise<Candidate[]> {
  const length = [...key].length;
  if (length < TYPO_MIN_LENGTH || length > TYPO_MAX_LENGTH) return [];
  const probes = deletionKeys(key);
  const rows = await db.all<{ surface_key: string; languages: number; richness: number }>(
    `SELECT DISTINCT surface_key, languages, richness FROM typo_key WHERE release_id IN (${servedBy("?1")}) AND deletion_key IN (${placeholders(probes.length, 2)})`,
    [releaseId, ...probes],
  );
  const keys = new Map<string, Found>(
    rows
      .filter((row) => row.surface_key !== key && withinOneEdit(key, row.surface_key))
      .map((row) => [row.surface_key, { edits: 1, languages: row.languages, richness: row.richness }]),
  );
  return candidatesFor(db, releaseId, keys);
}

/** `promise`, with a rejection nobody waits for kept from ending the process: a step whose answer is not needed may still fail. */
function handled<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => undefined);
  return promise;
}

/**
 * What to offer for a query the exact lookup did not find: accent, then one
 * edit, then the query corrected to read as an expression, then the words
 * that begin with it, then nothing. The first step that finds something is
 * the offer. The corrected queries also join an accent or a typo offer.
 *
 * Every step is sent before any is waited on (#646). Each is a read that needs
 * nothing from another, so on D1 they share calls instead of following one
 * another; the offer is still chosen in the order above, so a step that turns
 * out not to be needed changes nothing but the rows read.
 */
export async function findNearby({ db, releaseId, query }: { db: LookupDatabase; releaseId: string; query: string }): Promise<Nearby> {
  const key = normalizeItalianExact(query);
  if (key === "") return { kind: "none" };

  const accents = accentMatches(db, releaseId, key);
  const near = nearPhrases(db, releaseId, key, NEARBY_LIMIT);
  const typos = handled(typoMatches(db, releaseId, key));
  const prefixWords = handled(
    suggest({ db, releaseId, prefix: query }).then((answer) => (answer.outcome === "suggested" ? answer.suggestions : [])),
  );
  const [accent, phrases] = await Promise.all([accents, near]);
  const phrasesBesides = (shown: readonly string[]) => {
    const keys = new Set(shown.map(normalizeItalianExact));
    return phrases.filter((offer) => !keys.has(offer.phrase));
  };

  if (accent.length > 0) {
    const [best, ...rest] = accent;
    const others = [...new Set([...rest.map((c) => c.surface), ...(await prefixWords).filter((w) => w !== best.surface)])].slice(0, NEARBY_LIMIT);
    return { kind: "accent", best: best.surface, others, phrases: phrasesBesides([best.surface, ...others]) };
  }

  const typo = await typos;
  if (typo.length > 0) {
    const [best, ...rest] = typo;
    const others = rest.map((c) => c.surface).slice(0, NEARBY_LIMIT);
    return { kind: "typo", best: best.surface, others, phrases: phrasesBesides([best.surface, ...others]) };
  }

  const [phrase, ...morePhrases] = phrases;
  if (phrase !== undefined) return { kind: "phrase", best: phrase, others: morePhrases };

  const words = await prefixWords;
  return words.length > 0 ? { kind: "prefix", words } : { kind: "none" };
}
