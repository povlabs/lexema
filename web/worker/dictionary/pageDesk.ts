// What the shared page cache works with inside the Worker: the served version
// and Cloudflare's cache. worker/dictionary/pageCache.ts decides what to
// answer; this file only supplies it, as card/desk.ts does for a card.

import { servedVersionOnce } from "@/lib/dictionary/db.ts";
import type { PageDesk } from "./pageCache.ts";

export function workerPageDesk(_env: unknown, _request: Request, ctx: ExecutionContext): PageDesk {
  return {
    version: servedVersionOnce,
    // The DOM library's CacheStorage type, which tsconfig also loads, hides
    // the Workers runtime's own `caches.default`.
    cache: (caches as unknown as { default: Cache }).default,
    waitUntil: (work) => ctx.waitUntil(work),
  };
}
