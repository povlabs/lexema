// `pnpm run wikidata-words:snapshot`: take the snapshot of Wikidata words
// (ADR 0033, #812) from the pinned lexeme dump. It fetches the dump into
// `.data/wikidata/` on first use, checks it against its pinned size and
// SHA-256, and writes `wikidata-words/wikidata-words.jsonl`: every Italian
// lexeme of a mapped category with a spelling, lemma or form, among the words
// of `wikidata-words/words.txt`. It writes the file and nothing else: the
// dictionary changes only through a change declaration of
// `load:wikidata-words`, which reads the committed snapshot.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { finish, flags, isMain, usageError, type CommandResult } from "../commandLine.js";
import { fetchedDump, PINNED_LEXEME_DUMP, wikidataWordsOf } from "./lexemeDump.js";
import { askedKeysOf, ASKED_WORDS_PATH, isAsked, snapshotOf, snapshotText, WORD_SNAPSHOT_PATH } from "./wordSnapshot.js";
import type { WikidataWord } from "./wikidataWord.js";

const USAGE = "usage: pnpm run wikidata-words:snapshot";

const log = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

export async function main(args: readonly string[] = [], root: string = process.cwd(), fetchImpl: typeof fetch = fetch): Promise<CommandResult> {
  const options = flags(args, []);
  if (typeof options === "string") return usageError(options, USAGE);
  const asked = askedKeysOf(await readFile(resolve(root, ASKED_WORDS_PATH), "utf8"));
  const path = await fetchedDump(PINNED_LEXEME_DUMP, root, fetchImpl, log);
  log(`reading the Italian lexemes of ${path}`);
  const kept: WikidataWord[] = [];
  for await (const word of wikidataWordsOf(path, PINNED_LEXEME_DUMP)) if (isAsked(word, asked)) kept.push(word);
  const words = snapshotOf(kept);
  await writeFile(resolve(root, WORD_SNAPSHOT_PATH), snapshotText(words));
  return { out: `${words.length} Wikidata word(s) of the dump of ${PINNED_LEXEME_DUMP.date} written to ${WORD_SNAPSHOT_PATH}`, status: 0 };
}

if (isMain(import.meta.url)) finish(await main(process.argv.slice(2)));
