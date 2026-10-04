// A shared link's card (#304): `GET /card/<drawing>/<version>.png?word=casa`
// on lexema.fyi answers the 1200×630 PNG a result page names as its
// `og:image` (app/(lexema)/page.tsx).
//
// A card is drawn about once per served version. The address carries the
// drawing and the served version (lib/dictionary/card.ts): the release, last
// applied change, live-hide revision and Worker version id. Data updates and
// serving-code deploys give it a new address (docs/DEPLOY.md). That is why a
// drawn card may be kept in Cloudflare's cache, and in any browser or crawler,
// for a year: the next request for it is answered from there, marked
// `x-lexema-card: hit`, with no lookup and no drawing.
//
// Every request reads the served version first (src/lookup/served.ts). A
// request for another version's or drawing's card, or for an address from
// before the version was in it, is sent on to the current one, so a card kept
// under an old address is never answered for the current one. An apply moves
// every card's address, not only the changed words': whether a word's card
// changed is known only from its lookup, since a new record can put another
// reading first, and the point of the cache is to skip that lookup. When the
// version cannot be read the answer is the home card, never cached.
//
// Drawing a word's card runs the lookup its page runs (searchAttempt.ts), once,
// and counts against the visitor's search limit as that page does
// (worker/shared/rateLimit.ts). Over the limit, or when the lookup fails, the answer
// is the home card, never cached, so the next request draws the word's.
// Everything else that is not a word Lexema has gets the home card too.

import { cardAddressOf, cardOf, cardPath, CARD_DRAWING, HOME_CARD, type Card } from "@/lib/dictionary/card.ts";
import type { Attempt } from "@/lib/dictionary/attempt.ts";
import type { FetchHandler } from "../shared/fetchHandler.ts";

/** How long a drawn card is kept: a year, since its address changes whenever the card could. */
const KEPT_SECONDS = 365 * 24 * 60 * 60;

/** Says where a card came from: `hit` (cache), `miss` (drawn and kept), `unkept` (drawn, not kept). */
export const CARD_SOURCE_HEADER = "x-lexema-card";

/** What answering a card needs; the Worker's own, or a test's. */
export interface CardDesk {
  /** The served version's token, read now; undefined when it could not be read. */
  version: () => Promise<string | undefined>;
  /** Where drawn cards are kept: Cloudflare's cache in the Worker. */
  cache: Pick<Cache, "match" | "put">;
  /** Whether this visitor may run one more search now. */
  admit: () => Promise<boolean>;
  /** The page's own lookup for the word. */
  lookup: (word: string) => Promise<Attempt>;
  draw: (card: Card) => Promise<Uint8Array<ArrayBuffer>>;
  /** Keeps work going after the response has left. */
  waitUntil: (work: Promise<unknown>) => void;
}

function png(bytes: Uint8Array<ArrayBuffer>, kept: boolean): Response {
  return new Response(bytes, {
    headers: {
      "content-type": "image/png",
      "cache-control": kept ? `public, max-age=${KEPT_SECONDS}, immutable` : "no-store",
      [CARD_SOURCE_HEADER]: kept ? "miss" : "unkept",
    },
  });
}

/** The answer to a card's address, or undefined when `request` is not for a card. */
export async function answerCard(request: Request, desk: CardDesk): Promise<Response | undefined> {
  const url = new URL(request.url);
  const address = cardAddressOf(url);
  if (address === undefined) return undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  }

  const version = await desk.version();
  if (version === undefined) return png(await desk.draw(HOME_CARD), false);
  const current = cardPath({ version, word: address.word });
  if (address.drawing !== CARD_DRAWING || address.version !== version) {
    return new Response(null, { status: 302, headers: { location: current, "cache-control": "no-store" } });
  }

  // One key per card, whatever else the URL carried.
  const key = new Request(new URL(current, url.origin));
  const cached = await desk.cache.match(key);
  if (cached !== undefined) {
    const hit = new Response(cached.body, cached);
    hit.headers.set(CARD_SOURCE_HEADER, "hit");
    return hit;
  }

  if (address.word === undefined) return keep(await desk.draw(HOME_CARD), key, desk);
  if (!(await desk.admit())) return png(await desk.draw(HOME_CARD), false);
  const attempt = await desk.lookup(address.word);
  const card = cardOf(attempt);
  if (attempt.outcome === "failed") return png(await desk.draw(card), false);
  return keep(await desk.draw(card), key, desk);
}

function keep(bytes: Uint8Array<ArrayBuffer>, key: Request, desk: CardDesk): Response {
  const response = png(bytes, true);
  desk.waitUntil(desk.cache.put(key, response.clone()));
  return response;
}

/** Answer every card's address here; everything else goes on to `app`. */
export function withCards<E>(desk: (env: E, request: Request, ctx: ExecutionContext) => CardDesk, app: FetchHandler<E>): FetchHandler<E> {
  return async (request, env, ctx) => (await answerCard(request, desk(env, request, ctx))) ?? app(request, env, ctx);
}
