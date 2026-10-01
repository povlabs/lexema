// The site icon (#383, web/lib/shared/siteIcons.ts): the files in web/public
// are the sizes the metadata says they are, the touch icon is a full square,
// both sites' layouts carry the tags, and the email header names a file that
// is there. Whether each host serves them, and with which content type, is the
// preview smoke's (web/builds/previewSmokeCommand.ts).

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderMetadataToHtml } from "vinext/shims/metadata";
import { EMAIL_ICON_PATH } from "@lexema/email/send.ts";
import { ICON_PATH, SITE_ICON_METADATA } from "@/lib/shared/siteIcons.ts";

const WEB = fileURLToPath(new URL("..", import.meta.url));
const asset = (path: string) => readFile(join(WEB, "public", path));

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** A PNG's size, colour type and chunk names, read off its bytes. */
function pngOf(bytes: Buffer): { width: number; height: number; colourType: number; chunks: string[] } {
  assert.ok(bytes.subarray(0, 8).equals(PNG_SIGNATURE), "not a PNG");
  const chunks: string[] = [];
  for (let at = 8; at < bytes.length; at += 12 + bytes.readUInt32BE(at)) chunks.push(bytes.toString("latin1", at + 4, at + 8));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colourType: bytes[25], chunks };
}

test("each icon is a PNG of the size its name says", async () => {
  for (const [path, size] of [
    [ICON_PATH.icon, 32],
    [ICON_PATH.appleTouch, 180],
    [ICON_PATH.icon192, 192],
    [ICON_PATH.icon512, 512],
  ] as const) {
    const { width, height } = pngOf(await asset(path));
    assert.deepEqual([width, height], [size, size], path);
  }
});

test("the touch icon is a full square: no alpha channel and no transparent colour, since iOS rounds it", async () => {
  const { colourType, chunks } = pngOf(await asset(ICON_PATH.appleTouch));
  // Colour type 2 is RGB; 4 and 6 carry alpha, and tRNS would mark a colour transparent.
  assert.equal(colourType, 2);
  assert.ok(!chunks.includes("tRNS"));
});

test("favicon.ico holds 16, 32 and 48 px, each a whole PNG of that size", async () => {
  const ico = await asset(ICON_PATH.favicon);
  assert.deepEqual([ico.readUInt16LE(0), ico.readUInt16LE(2)], [0, 1], "an ICO header");
  const sizes: number[] = [];
  for (let i = 0; i < ico.readUInt16LE(4); i++) {
    const entry = 6 + 16 * i;
    const [length, offset] = [ico.readUInt32LE(entry + 8), ico.readUInt32LE(entry + 12)];
    const png = pngOf(ico.subarray(offset, offset + length));
    assert.deepEqual([png.width, png.height], [ico[entry], ico[entry + 1]], `entry ${i}`);
    sizes.push(png.width);
  }
  assert.deepEqual(sizes, [16, 32, 48]);
});

test("the web manifest names the 192 and 512 px icons on the surface colour", async () => {
  const manifest = JSON.parse((await asset(ICON_PATH.manifest)).toString("utf8"));
  assert.equal(manifest.name, "Lexema");
  assert.deepEqual(manifest.icons, [
    { src: ICON_PATH.icon192, sizes: "192x192", type: "image/png" },
    { src: ICON_PATH.icon512, sizes: "512x512", type: "image/png" },
  ]);
  assert.equal(manifest.background_color, "#121110");
});

test("the metadata writes the tab icons, the touch icon and the manifest link", () => {
  const head = renderMetadataToHtml(SITE_ICON_METADATA);
  for (const tag of [
    '<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">',
    '<link rel="icon" href="/icon.png" type="image/png" sizes="32x32">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">',
    '<link rel="manifest" href="/site.webmanifest">',
  ]) {
    assert.ok(head.includes(tag), `${tag} in ${head}`);
  }
});

test("both sites' layouts carry the icon metadata", async () => {
  // A layout imports globals.css, which Node cannot load, so its source is read.
  for (const layout of ["app/(lexema)/layout.tsx", "app/(developers)/developer-site/layout.tsx"]) {
    assert.match(await readFile(join(WEB, layout), "utf8"), /export const metadata = \{ title: "[^"]+", \.\.\.SITE_ICON_METADATA \};/, layout);
  }
});

test("the email header's icon is one of these files", () => {
  assert.equal(EMAIL_ICON_PATH, ICON_PATH.icon192);
});
