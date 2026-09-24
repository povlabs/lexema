// The Worker's entry: the rate limits, then vinext.
//
// wrangler.jsonc used to name `vinext/server/fetch-handler` as `main`, which is
// vinext's App Router entry and nothing else. This file puts the per-visitor
// limits (worker/rateLimit.ts) in front of that same entry, so every request
// that could reach D1 is counted in one place before any route runs.

import app from "vinext/server/app-router-entry";
import { withRateLimits } from "./rateLimit.ts";

export default {
  fetch: withRateLimits<Env>((request, env, ctx) => app.fetch(request, env, ctx)),
} satisfies ExportedHandler<Env>;
