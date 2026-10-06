// A word page as the Worker sends it, through the real React Server Components
// path (#647): the server render to a flight stream, the server-side render of
// that stream to HTML, and the stream inlined into the page as vinext inlines
// it, one `<script>` per chunk.
//
// Each half runs in its own Node process under production React, as the Worker
// runs it. The flight half (rscFlight.tsx) takes the `react-server` export
// condition, which a process takes once for every import; the SSR half
// (rscHtml.ts) takes the ordinary one. Neither loads React into the test.
//
// What is not here is the document around the page: the layout's `<html>`,
// head, styles and footer, the same few kilobytes on every page. Their size is
// the layout's, not the word's.

import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { text } from "node:stream/consumers";

const WEB = fileURLToPath(new URL("..", import.meta.url));
const REPO = join(WEB, "..");

/** One page's weight, in UTF-8 bytes. */
export interface PageWeight {
  /** The whole page: the server-rendered markup and the scripts that carry the payload. */
  html: number;
  /** The inline payload: the scripts that carry the flight stream, tags included. */
  payload: number;
}

/** A rendered page: its markup, its flight stream, and the inline payload that carries the stream. */
export interface RenderedPage {
  markup: string;
  flight: string;
  payload: string;
  /** How many scripts carry the payload. */
  scripts: number;
}

export const weightOf = ({ markup, payload }: RenderedPage): PageWeight => ({
  html: Buffer.byteLength(markup) + Buffer.byteLength(payload),
  payload: Buffer.byteLength(payload),
});

/** Each client component the stream renders, by its export name, with the props the server gave it. */
export function clientElements(flight: string): { component: string; props: Record<string, unknown> }[] {
  const names = new Map([...flight.matchAll(/^([0-9a-f]+):I\["[^"]*",\[[^\]]*\],"(\w+)"\]$/gm)].map(([, row, name]) => [row, name]));
  const elements: { component: string; props: Record<string, unknown> }[] = [];
  for (const start of flight.matchAll(/\["\$","\$L([0-9a-f]+)",/g)) {
    const component = names.get(start[1]);
    if (component === undefined) continue;
    // The element is a JSON array; read to the bracket that closes it.
    let depth = 0;
    let end = start.index;
    for (let inString = false; end < flight.length; end += 1) {
      const c = flight[end];
      if (inString) {
        if (c === "\\") end += 1;
        else if (c === '"') inString = false;
      } else if (c === '"') inString = true;
      else if (c === "[" || c === "{") depth += 1;
      else if ((c === "]" || c === "}") && --depth === 0) break;
    }
    const [, , , props] = JSON.parse(flight.slice(start.index, end + 1)) as [string, string, unknown, Record<string, unknown>];
    elements.push({ component, props });
  }
  return elements;
}

/**
 * Run a script of `web/test` under tsx in its own production Node process,
 * `flags` after tsx's, with `input` on its stdin; its stdout.
 */
async function run(flags: readonly string[], script: string, args: readonly string[], input = ""): Promise<string> {
  const child = spawn(process.execPath, ["--import", "tsx", ...flags, join(WEB, "test", script), ...args], {
    cwd: REPO,
    env: { ...process.env, NODE_ENV: "production", TSX_TSCONFIG_PATH: join(WEB, "tsconfig.json") },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.end(input);
  const [stdout, stderr, code] = await Promise.all([
    text(child.stdout),
    text(child.stderr),
    new Promise<number | null>((resolve) => child.on("close", resolve)),
  ]);
  if (code !== 0) throw new Error(`${script} exited ${code}: ${stderr}`);
  return stdout;
}

/** Render each word's page, through the flight stream, to what the Worker sends. */
export async function renderWordPages(words: readonly string[]): Promise<Record<string, RenderedPage>> {
  const flights = await run(["--conditions", "react-server", "--import", join(WEB, "test/rscRegister.mjs")], "rscFlight.tsx", words);
  return JSON.parse(await run([], "rscHtml.ts", [], flights)) as Record<string, RenderedPage>;
}
