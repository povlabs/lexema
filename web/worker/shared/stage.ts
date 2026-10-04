// Where this Worker runs: its stage (ADR 0018).
//
// `LEXEMA_STAGE` names it in web/wrangler.jsonc: `local` at the top level,
// `preview` in the `previews` block, `production` in `env.production`. It is
// read once, when the Worker starts (worker/index.ts), and any other value
// throws there, so a Worker with no stage or a misspelt one never serves a
// request. Preview-only behaviour keys on the parsed stage, never on the string.

import type { FetchHandler } from "./fetchHandler.ts";

/** Every stage a Worker can run on. */
const STAGES = ["local", "preview", "production"] as const;

export type Stage = (typeof STAGES)[number];

/** The stage `LEXEMA_STAGE` names, or a throw for any value that names none. */
export function parseStage(value: unknown): Stage {
  const stage = STAGES.find((candidate) => candidate === value);
  if (stage === undefined) {
    throw new Error(`LEXEMA_STAGE must be one of ${STAGES.join(", ")}; got ${JSON.stringify(value)}`);
  }
  return stage;
}

/**
 * The `X-Robots-Tag` a stage's responses carry, or none. Previews are public,
 * and Cloudflare adds no noindex on a custom-domain Preview URL, so every
 * response on the `preview` stage says it itself (ADR 0018). Static assets
 * never reach the Worker; web/public/_headers gives them the same tag.
 */
export function robotsTagOf(stage: Stage): string | undefined {
  return stage === "preview" ? "noindex" : undefined;
}

/** Every response `handler` gives, with the headers `stage` adds to it. */
export function withStage<E>(stage: Stage, handler: FetchHandler<E>): FetchHandler<E> {
  const robotsTag = robotsTagOf(stage);
  if (robotsTag === undefined) return handler;
  return async (request, env, ctx) => {
    const response = await handler(request, env, ctx);
    // A fetched or asset response has immutable headers, so this is a copy.
    const headers = new Headers(response.headers);
    headers.set("x-robots-tag", robotsTag);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
}
