// The Wikidata lexeme dump a snapshot of Wikidata words is taken from (ADR
// 0033, #812), pinned by its date, size and SHA-256 as a Wiktionary release
// pins its archive. Commands fetch it into the ignored `.data/wikidata/` on
// first use and check it there. A refresh pins a newer dump here and takes the
// snapshot again; the snapshot's rows carry the dump's date.

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { createGunzip } from "node:zlib";
import { ITALIAN, wikidataWordOfDump, type WikidataWord } from "./wikidataWord.js";

/** A dump of every lexeme, as Wikimedia publishes it weekly. */
export interface LexemeDump {
  /** The dump's date, `YYYY-MM-DD`: the snapshot every row taken from it names. */
  date: string;
  url: string;
  bytes: number;
  sha256: string;
}

/** The dump the committed snapshot was taken from. */
export const PINNED_LEXEME_DUMP: LexemeDump = {
  date: "2026-10-07",
  url: "https://dumps.wikimedia.org/wikidatawiki/entities/20261007/wikidata-20261007-lexemes.json.gz",
  bytes: 653_077_837,
  sha256: "0623b19c27672b434f8600ce8331f6bc670168d268123550f5d2f8549c691d5f",
};

/** Where a dump is kept once fetched, under `root`. */
export const dumpPath = (dump: LexemeDump, root: string): string => join(root, ".data/wikidata", new URL(dump.url).pathname.split("/").pop() ?? "lexemes.json.gz");

/** Why a dump cannot be read as the pinned one. */
export class LexemeDumpRefused extends Error {
  override readonly name = "LexemeDumpRefused";
}

/** The dump at its path, fetched first when it is not there. */
export async function fetchedDump(dump: LexemeDump, root: string, fetchImpl: typeof fetch = fetch, log: (line: string) => void = () => {}): Promise<string> {
  const path = dumpPath(dump, root);
  if (await stat(path).then(() => true, () => false)) return path;
  await mkdir(dirname(path), { recursive: true });
  log(`fetching ${dump.url} (${dump.bytes} bytes)`);
  const response = await fetchImpl(dump.url);
  if (!response.ok || response.body === null) throw new LexemeDumpRefused(`${dump.url}: HTTP ${response.status}`);
  const partial = `${path}.partial`;
  await pipeline(Readable.fromWeb(response.body as WebReadableStream<Uint8Array>), createWriteStream(partial));
  await rename(partial, path);
  return path;
}

/**
 * Every Wikidata word of the dump at `path`, in dump order, then a check that
 * the file is the pinned one: its size and SHA-256 are read as it streams, and
 * a file that is not the dump refuses after the last word, so no caller writes
 * a snapshot of it. The dump is one JSON array, one lexeme to a line.
 */
export async function* wikidataWordsOf(path: string, dump: LexemeDump): AsyncGenerator<WikidataWord> {
  const hash = createHash("sha256");
  let bytes = 0;
  const file = createReadStream(path);
  file.on("data", (chunk: Buffer | string) => {
    hash.update(chunk);
    bytes += Buffer.byteLength(chunk);
  });
  for await (const raw of createInterface({ input: file.pipe(createGunzip()), crlfDelay: Infinity })) {
    const line = raw.trim().replace(/,$/, "");
    // Only an Italian lexeme is parsed; the dump holds about 1.7 million.
    if (line === "[" || line === "]" || line === "" || !line.includes(`"language":"${ITALIAN}"`)) continue;
    const word = wikidataWordOfDump(JSON.parse(line));
    if (word !== undefined) yield word;
  }
  const sha256 = hash.digest("hex");
  if (bytes !== dump.bytes || sha256 !== dump.sha256) {
    throw new LexemeDumpRefused(`${path} is ${bytes} bytes with SHA-256 ${sha256}, not the dump of ${dump.date} (${dump.bytes} bytes, ${dump.sha256})`);
  }
}
