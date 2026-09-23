// Raw pages read from an Italian Wiktionary database dump (#28).
//
// The dump is not newer data replacing the archive. It is the page source the
// archive itself was converted from: Wiktextract built `it-extract.jsonl.gz` on
// 2026-07-16 from the most recent dump, `itwiktionary-20260701`. Reading that
// same dump gives every entry the page its record was extracted from, so the
// recovered layer can pick up the definitions the conversion dropped. It is read
// once, at seed time, to match the archive; it is not a feed of new dumps
// (ADR 0012). The durable copy is `source/` in `hueypov/lexema-data`.
//
// The file is bz2-compressed MediaWiki export XML, about 830 MB unpacked. It is
// checked against its published size and SHA-1 before any page is read, then
// streamed through `bzip2 -dc` and read line by line; it is never loaded whole.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import type { Stats } from "node:fs";
import { access, type FileHandle, open } from "node:fs/promises";
import { resolve } from "node:path";
import type { Readable } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import { loadFixturePages, RAW_PAGE_WIKI, type RawPage, type RawPageSource } from "./rawPage.js";

/** The dump the archive was built from, as Wikimedia publishes it. */
export const ARCHIVE_DUMP: Readonly<DumpIdentity & { file: string; url: string }> = {
  file: "itwiktionary-20260701-pages-articles.xml.bz2",
  url: "https://dumps.wikimedia.org/itwiktionary/20260701/itwiktionary-20260701-pages-articles.xml.bz2",
  bytes: 70_997_844,
  sha1: "2bdd444236f7dcd26fee3652dbd641c31d0d9651",
};

/** The main namespace: dictionary entries. Every other namespace is skipped. */
const MAIN_NAMESPACE = 0;

/** Split a text stream on `\n` only; a lone `\r` inside wikitext stays in its line. */
async function* linesOf(stream: Readable): AsyncGenerator<string> {
  const decoder = new StringDecoder("utf8");
  let pending = "";
  for await (const chunk of stream) {
    pending += typeof chunk === "string" ? chunk : decoder.write(chunk as Buffer);
    let end = pending.indexOf("\n");
    while (end !== -1) {
      yield pending.slice(0, end);
      pending = pending.slice(end + 1);
      end = pending.indexOf("\n");
    }
  }
  pending += decoder.end();
  if (pending !== "") yield pending;
}

const ENTITIES: Readonly<Record<string, string>> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

/** XML character data as text: the five named entities and numeric references. */
function unescapeXml(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (entity, name: string) => {
    if (name.startsWith("#x")) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    const named = ENTITIES[name];
    if (named === undefined) throw new Error(`unknown XML entity ${entity}`);
    return named;
  });
}

/** `<tag>value</tag>` alone on a line, as the export writes every scalar. */
const element = (line: string, tag: string): string | undefined => {
  const open = `<${tag}>`;
  const trimmed = line.trim();
  if (!trimmed.startsWith(open) || !trimmed.endsWith(`</${tag}>`)) return undefined;
  return trimmed.slice(open.length, -(tag.length + 3));
};

/** What has been read of the current `<page>` so far. */
interface PageDraft {
  title?: string;
  ns?: number;
  inRevision: boolean;
  revisionId?: number;
  timestamp?: string;
  /** The `<text>` lines read so far, or the whole text once it closed. */
  text?: string[];
  textClosed: boolean;
}

function finished(draft: PageDraft, lineNo: number): RawPage {
  const { title, revisionId, timestamp, text } = draft;
  if (title === undefined || revisionId === undefined || timestamp === undefined || text === undefined || !draft.textClosed) {
    throw new Error(`dump line ${lineNo}: page ${JSON.stringify(title ?? "?")} ends without a title, revision id, timestamp and text`);
  }
  return { wiki: RAW_PAGE_WIKI, title, revisionId, timestamp, wikitext: text.join("\n") };
}

/**
 * Every main-namespace page in a MediaWiki export, in dump order: its title,
 * the revision's id and timestamp, and the revision's wikitext. A
 * `pages-articles` dump holds one revision per page, the latest at dump time.
 */
export async function* readDumpPages(xml: Readable): AsyncGenerator<RawPage> {
  let draft: PageDraft | undefined;
  let lineNo = 0;
  for await (const line of linesOf(xml)) {
    lineNo += 1;
    if (draft === undefined) {
      if (line.trim() === "<page>") draft = { inRevision: false, textClosed: false };
      continue;
    }
    if (draft.text !== undefined && !draft.textClosed) {
      const close = line.indexOf("</text>");
      draft.text.push(unescapeXml(close === -1 ? line : line.slice(0, close)));
      draft.textClosed = close !== -1;
      continue;
    }
    const trimmed = line.trim();
    if (trimmed === "</page>") {
      if (draft.ns === undefined) throw new Error(`dump line ${lineNo}: page without a namespace`);
      if (draft.ns === MAIN_NAMESPACE) yield finished(draft, lineNo);
      draft = undefined;
      continue;
    }
    if (trimmed === "<revision>") {
      if (draft.revisionId !== undefined) throw new Error(`dump line ${lineNo}: more than one revision of a page; expected a pages-articles dump`);
      draft.inRevision = true;
      continue;
    }
    if (trimmed === "</revision>") {
      draft.inRevision = false;
      continue;
    }
    const title = element(line, "title");
    if (title !== undefined) {
      draft.title = unescapeXml(title);
      continue;
    }
    const ns = element(line, "ns");
    if (ns !== undefined) {
      draft.ns = Number(ns);
      continue;
    }
    if (!draft.inRevision) continue;
    // The revision's own `<id>` comes first; the contributor's `<id>` sits later.
    const id = element(line, "id");
    if (id !== undefined && draft.revisionId === undefined) {
      draft.revisionId = Number(id);
      continue;
    }
    const timestamp = element(line, "timestamp");
    if (timestamp !== undefined) {
      draft.timestamp = timestamp;
      continue;
    }
    const text = /^\s*<text\b[^>]*?(\/?)>(.*)$/s.exec(line);
    if (text !== null) {
      if (text[1] === "/") {
        draft.text = [];
        draft.textClosed = true;
        continue;
      }
      const rest = text[2];
      const close = rest.indexOf("</text>");
      draft.text = [unescapeXml(close === -1 ? rest : rest.slice(0, close))];
      draft.textClosed = close !== -1;
    }
  }
  if (draft !== undefined) throw new Error("dump ends inside a page");
}

/** The bytes a dump must be: its size and its SHA-1, as Wikimedia publishes them. */
export interface DumpIdentity {
  bytes: number;
  sha1: string;
}

/**
 * A dump file whose bytes were checked against the dump they must be, opened
 * once and read from that one handle. Only a `VerifiedDump` gives pages, so no
 * page is read from a file that was not checked: a wrong or altered file with
 * the right name is refused before its first page. The pages come from the
 * handle the digest was taken from, not by re-opening the path, and the handle
 * is re-checked after the read, so a file swapped or rewritten meanwhile is
 * refused too (the archive's `Archive` does the same).
 */
export class VerifiedDump {
  private constructor(
    readonly path: string,
    private readonly handle: FileHandle,
    private readonly stamp: string,
  ) {}

  /** Open `path` and refuse it unless its size and SHA-1 are `expected`'s. */
  static async open(path: string, expected: DumpIdentity): Promise<VerifiedDump> {
    const handle = await open(path, "r");
    try {
      const stats = await handle.stat();
      const hash = createHash("sha1");
      for await (const chunk of handle.createReadStream({ start: 0, autoClose: false })) hash.update(chunk as Buffer);
      const sha1 = hash.digest("hex");
      if (stats.size !== expected.bytes || sha1 !== expected.sha1) {
        throw new Error(
          `${path} is not the expected dump: expected SHA-1 ${expected.sha1} (${expected.bytes} bytes), ` +
            `got SHA-1 ${sha1} (${stats.size} bytes). Nothing was read from it.`,
        );
      }
      return new VerifiedDump(path, handle, stampOf(stats));
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  /** Every main-namespace page, a `.bz2` dump decompressed as it is read. */
  async *pages(): AsyncGenerator<RawPage> {
    const bytes = this.handle.createReadStream({ start: 0, autoClose: false });
    if (this.path.endsWith(".bz2")) yield* decompressed(bytes, this.path);
    else yield* readDumpPages(bytes);
    if (stampOf(await this.handle.stat()) !== this.stamp) {
      throw new Error(`${this.path} changed while it was being read; its pages are not the checked dump's. Re-run it.`);
    }
  }

  close(): Promise<void> {
    return this.handle.close();
  }
}

/** Size and modification time: a rewrite in place moves one of them. */
const stampOf = (stats: Stats): string => `${stats.size}:${stats.mtimeMs}`;

/** The pages of a bz2 byte stream, decompressed through `bzip2 -dc`. */
async function* decompressed(bytes: Readable, path: string): AsyncGenerator<RawPage> {
  const bzip2 = spawn("bzip2", ["-dc"], { stdio: ["pipe", "pipe", "pipe"] });
  const stderr: Buffer[] = [];
  bzip2.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
  const exited = new Promise<void>((done, fail) => {
    bytes.on("error", fail);
    bzip2.on("error", fail);
    bzip2.on("close", (code) =>
      code === 0 ? done() : fail(new Error(`bzip2 -dc ${path} exited ${code}: ${Buffer.concat(stderr).toString().trim()}`)),
    );
  });
  // A reader stopped early kills bzip2; neither the exit nor the write it cuts
  // off is an error then. A reader that finishes still awaits the exit below.
  exited.catch(() => {});
  bzip2.stdin.on("error", () => {});
  bytes.pipe(bzip2.stdin);
  try {
    yield* readDumpPages(bzip2.stdout);
    await exited;
  } finally {
    bytes.unpipe(bzip2.stdin);
    bzip2.kill();
  }
}

/**
 * Every main-namespace page of a dump, by title, once its bytes are checked
 * against `expected`. Each page's wikitext is held as UTF-8 bytes outside the
 * JavaScript heap and decoded when asked for: the 2026-07-01 dump's 758,429
 * pages take about 370 MB that way.
 */
export async function loadDumpPages(path: string, expected: DumpIdentity): Promise<RawPageSource> {
  const dump = await VerifiedDump.open(path, expected);
  const held = new Map<string, { revisionId: number; timestamp: string; wikitext: Buffer }>();
  try {
    for await (const page of dump.pages()) {
      if (held.has(page.title)) throw new Error(`${path}: the page ${JSON.stringify(page.title)} appears twice`);
      held.set(page.title, { revisionId: page.revisionId, timestamp: page.timestamp, wikitext: Buffer.from(page.wikitext, "utf8") });
    }
  } finally {
    await dump.close();
  }
  return {
    size: held.size,
    page(title) {
      const page = held.get(title);
      if (page === undefined) return undefined;
      return { wiki: RAW_PAGE_WIKI, title, revisionId: page.revisionId, timestamp: page.timestamp, wikitext: page.wikitext.toString("utf8") };
    },
  };
}

/** Which raw pages a run reads, and a line naming them for its log. */
export interface RawPageInput {
  pages: RawPageSource;
  /** `dump <path>` or `fixtures <dir>`. */
  described: string;
}

/**
 * The raw pages a seed or measurement reads: the dump `RAW_PAGES` names, else
 * the archive's dump at `dump` (the repository root) when it is there, else the
 * pages committed under `fixtures/`, which is what a fresh clone and CI read.
 * `RAW_PAGES=fixtures` asks for the committed pages even when the dump is there.
 * Either dump file is read only if its bytes are `expected`'s.
 */
export async function openRawPages(
  env: NodeJS.ProcessEnv = process.env,
  dump: string = resolve(ARCHIVE_DUMP.file),
  fixtures: string = resolve("fixtures"),
  expected: DumpIdentity = ARCHIVE_DUMP,
): Promise<RawPageInput> {
  const fromFixtures = async (): Promise<RawPageInput> => ({ pages: await loadFixturePages(fixtures), described: `fixtures ${fixtures}` });
  const asked = env.RAW_PAGES;
  if (asked === "fixtures") return fromFixtures();
  if (asked !== undefined) {
    const named = resolve(asked);
    if (!(await exists(named))) throw new Error(`RAW_PAGES names ${named}, which does not exist`);
    return { pages: await loadDumpPages(named, expected), described: `dump ${named}` };
  }
  if (!(await exists(dump))) return fromFixtures();
  return { pages: await loadDumpPages(dump, expected), described: `dump ${dump}` };
}

const exists = (path: string): Promise<boolean> => access(path).then(() => true, () => false);
