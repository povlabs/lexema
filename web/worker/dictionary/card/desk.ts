// What a card is drawn with inside the Worker: the faces and colours, bundled
// once per isolate, Cloudflare's cache, the search limit, the served version
// and the page's lookup.
// worker/dictionary/card.ts decides what to answer; this file only supplies it.

// The workerd builds by name: the bare package names resolve to the Node
// builds here, which inline their wasm as base64 and grow the Worker by a
// third. These import the `.wasm` files as compiled modules instead.
import { Resvg } from "@cf-wasm/resvg/workerd";
import { satori, type Font } from "@cf-wasm/satori/workerd";
import stylesheet from "../../../app/globals.css?raw";
import { searchOnce, servedVersionOnce } from "@/lib/dictionary/db.ts";
import { visitorKey, type LimitBindings } from "../../shared/rateLimit.ts";
import type { CardDesk } from "../card.ts";
import { drawCard } from "./draw.tsx";
import { paletteOf } from "./palette.ts";
import interRegular from "../../../fonts/card/Inter-400-normal.woff.bin";
import interSemibold from "../../../fonts/card/Inter-600-normal.woff.bin";
import plexMono from "../../../fonts/card/IBMPlexMono-400-normal.woff.bin";
import spectralItalic from "../../../fonts/card/Spectral-400-italic.woff.bin";
import spectralRegular from "../../../fonts/card/Spectral-400-normal.woff.bin";

/** The three families, in the weights and styles a card sets (web/fonts/README.md § "The card's faces, in `card/`"). */
const FONTS: Font[] = [
  { name: "Spectral", data: spectralRegular, weight: 400, style: "normal" },
  { name: "Spectral", data: spectralItalic, weight: 400, style: "italic" },
  { name: "Inter", data: interRegular, weight: 400, style: "normal" },
  { name: "Inter", data: interSemibold, weight: 600, style: "normal" },
  { name: "IBM Plex Mono", data: plexMono, weight: 400, style: "normal" },
];

const PALETTE = paletteOf(stylesheet);

export type CardEnv = Pick<LimitBindings, "SEARCH_LIMIT">;

export function workerDesk(env: CardEnv, request: Request, ctx: ExecutionContext): CardDesk {
  return {
    version: servedVersionOnce,
    // The DOM library's CacheStorage type, which tsconfig also loads, hides
    // the Workers runtime's own `caches.default`.
    cache: (caches as unknown as { default: Cache }).default,
    admit: async () =>
      (await env.SEARCH_LIMIT.limit({ key: visitorKey(request.headers.get("cf-connecting-ip")) })).success,
    lookup: searchOnce,
    draw: (card) => drawCard(card, { engine: { satori, Resvg }, fonts: FONTS, palette: PALETTE }),
    waitUntil: (work) => ctx.waitUntil(work),
  };
}
