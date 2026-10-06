// The SSR half of a word page's render (#647, rscPage.ts): the flight stream
// read back with React's flight client, each client component it names loaded
// by its path, the tree rendered with React DOM's streaming renderer, and the
// stream inlined after it by vinext's own embed, one `<script>` per chunk.
//
// Its own Node process, under production React, as the Worker runs: it reads
// each word's flight chunks as JSON on stdin and writes each page as JSON on
// stdout.

import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { text } from "node:stream/consumers";
import { createElement, use, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { createFromReadableStream } from "react-server-dom-webpack/client.edge";
import type { RenderedPage } from "./rscPage.ts";

const WEB = fileURLToPath(new URL("..", import.meta.url));

/** A CSP nonce of the length the Worker writes on each script (base64 of 16 bytes). */
const NONCE = "AAAAAAAAAAAAAAAAAAAAAA==";

interface RscEmbed {
  finalize(): Promise<string>;
}

// vinext's embed is not one of its exports: it is read beside its entry, `dist/index.js`.
const { createRscEmbedTransform } = (await import(new URL("./server/app-ssr-stream.js", import.meta.resolve("vinext")).href)) as {
  createRscEmbedTransform: (stream: ReadableStream<Uint8Array>, options: { scriptNonce: string }) => RscEmbed;
};

/** A stream that sends `chunks` as they were sent, chunk for chunk. */
function streamOf(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

// The flight client loads a client component with webpack's globals; each one
// the stream names is imported by its path under `web/` before it is read.
const loaded = new Map<string, unknown>();
Object.assign(globalThis, {
  __webpack_require__: (id: string) => loaded.get(id),
  __webpack_chunk_load__: () => Promise.resolve(),
});
const moduleMap = new Proxy({} as Record<string, unknown>, {
  get: (_target, id) => (typeof id !== "string" ? undefined : new Proxy({}, { get: (_entry, name) => ({ id, chunks: [], name }) })),
});

async function pageOf(word: string, base64: readonly string[]): Promise<RenderedPage> {
  const chunks = base64.map((chunk) => new Uint8Array(Buffer.from(chunk, "base64")));
  const flight = Buffer.concat(chunks).toString("utf8");
  for (const [, id] of flight.matchAll(/^[0-9a-f]+:"([^"]+\.tsx?)"$/gm)) {
    if (!loaded.has(id)) loaded.set(id, await import(pathToFileURL(join(WEB, id)).href));
  }
  const root = createFromReadableStream<ReactNode>(streamOf(chunks), {
    serverConsumerManifest: { moduleMap, serverModuleMap: null, moduleLoading: null },
  });
  const errors: unknown[] = [];
  const html = await renderToReadableStream(createElement(() => use(root)), { onError: (error: unknown) => void errors.push(error) });
  await html.allReady;
  if (errors.length > 0) throw new Error(`rendering ${word} failed`, { cause: errors[0] });
  const markup = await text(html as unknown as AsyncIterable<Uint8Array>);
  const payload = await createRscEmbedTransform(streamOf(chunks), { scriptNonce: NONCE }).finalize();
  return { markup, flight, payload, scripts: payload.split("<script").length - 1 };
}

const flights = JSON.parse(await text(process.stdin)) as Record<string, string[]>;
const pages: Record<string, RenderedPage> = {};
for (const [word, chunks] of Object.entries(flights)) pages[word] = await pageOf(word, chunks);
process.stdout.write(JSON.stringify(pages));
