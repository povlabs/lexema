// The dump reader (#28): a MediaWiki export read page by page, main namespace
// only, into the same `RawPage` the committed fixtures give. The export here
// is a hand-made miniature of the real one's layout; no case needs the dump.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { RAW_PAGE_WIKI, type RawPage } from "../src/source/rawPage.js";
import { loadDumpPages, openRawPages, readDumpFile, readDumpPages } from "../src/source/wiktionaryDump.js";

/** One `<page>` as `pages-articles` writes it, contributor id and all. */
const page = (title: string, ns: number, revisionId: number, text: string): string => `  <page>
    <title>${title}</title>
    <ns>${ns}</ns>
    <id>${revisionId + 7}</id>
    <revision>
      <id>${revisionId}</id>
      <parentid>${revisionId - 1}</parentid>
      <timestamp>2026-06-30T12:00:00Z</timestamp>
      <contributor>
        <username>Someone</username>
        <id>99</id>
      </contributor>
      <model>wikitext</model>
      <format>text/x-wiki</format>
      ${text}
      <sha1>x</sha1>
    </revision>
  </page>`;

const EXPORT = `<mediawiki xmlns="http://www.mediawiki.org/xml/export-0.11/" version="0.11" xml:lang="it">
  <siteinfo>
    <sitename>Wikizionario</sitename>
  </siteinfo>
${page("MediaWiki:Category", 8, 11248, `<text bytes="9" xml:space="preserve">categoria</text>`)}
${page("casa", 0, 4051358, `<text bytes="80" xml:space="preserve">== {{-it-}} ==
{{-sost-|it}}
# {{Pn|w}} ''f sing'' {{Linkp|case}}
#* [[dimora]] &amp; &lt;ref&gt;x&lt;/ref&gt; &quot;casa&quot; &#233; &#x2014; fine</text>`)}
${page("vuota", 0, 12, `<text bytes="0" xml:space="preserve" />`)}
${page("riga", 0, 13, `<text bytes="5" xml:space="preserve">riga\r</text>`)}
</mediawiki>
`;

async function all(pages: AsyncIterable<RawPage>): Promise<RawPage[]> {
  const read: RawPage[] = [];
  for await (const page of pages) read.push(page);
  return read;
}

test("reads each main-namespace page's title, revision, timestamp and wikitext, and skips every other namespace", async () => {
  const pages = await all(readDumpPages(Readable.from([EXPORT])));
  assert.deepEqual(pages.map((page) => [page.title, page.revisionId, page.timestamp]), [
    ["casa", 4051358, "2026-06-30T12:00:00Z"],
    ["vuota", 12, "2026-06-30T12:00:00Z"],
    ["riga", 13, "2026-06-30T12:00:00Z"],
  ]);
  assert.equal(pages[0].wiki, RAW_PAGE_WIKI);
  // Entities are text again, and line 4 of the wikitext is line 4 of the page.
  assert.deepEqual(pages[0].wikitext.split("\n"), [
    "== {{-it-}} ==",
    "{{-sost-|it}}",
    "# {{Pn|w}} ''f sing'' {{Linkp|case}}",
    "#* [[dimora]] & <ref>x</ref> \"casa\" é — fine",
  ]);
  assert.equal(pages[1].wikitext, "");
  // A lone carriage return is part of the text, not a line break.
  assert.equal(pages[2].wikitext, "riga\r");
});

test("a page split across stream chunks mid-line reads the same", async () => {
  const chunks = EXPORT.match(/[\s\S]{1,7}/g) ?? [];
  const whole = await all(readDumpPages(Readable.from([EXPORT])));
  assert.deepEqual(await all(readDumpPages(Readable.from(chunks))), whole);
});

test("an export cut off inside a page is refused, not read as a shorter page", async () => {
  const cut = EXPORT.slice(0, EXPORT.indexOf("fine</text>"));
  await assert.rejects(all(readDumpPages(Readable.from([cut]))), /ends inside a page/);
});

test("a bz2 dump is streamed through bzip2 and gives the same pages; the source finds each by title", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-dump-"));
  try {
    const xml = join(dir, "mini.xml");
    await writeFile(xml, EXPORT);
    execFileSync("bzip2", ["-k", xml]);
    const plain = await all(readDumpFile(xml));
    assert.deepEqual(await all(readDumpFile(`${xml}.bz2`)), plain);
    const source = await loadDumpPages(`${xml}.bz2`);
    assert.equal(source.size, 3);
    assert.deepEqual(source.page("casa"), plain[0]);
    assert.equal(source.page("MediaWiki:Category"), undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("without the dump, the committed fixture pages are read; RAW_PAGES picks either one", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-dump-"));
  try {
    const absent = join(dir, "absent.xml.bz2");
    const fallback = await openRawPages({}, absent);
    assert.match(fallback.described, /^fixtures /);
    assert.ok(fallback.pages.page("casa"));

    const xml = join(dir, "mini.xml");
    await writeFile(xml, EXPORT);
    const present = await openRawPages({}, xml);
    assert.equal(present.described, `dump ${xml}`);
    assert.equal(present.pages.page("casa")?.revisionId, 4051358);

    assert.match((await openRawPages({ RAW_PAGES: "fixtures" }, xml)).described, /^fixtures /);
    assert.equal((await openRawPages({ RAW_PAGES: xml }, absent)).described, `dump ${xml}`);
    await assert.rejects(openRawPages({ RAW_PAGES: absent }, xml), /does not exist/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
