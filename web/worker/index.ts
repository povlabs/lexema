// The Worker's entry: the JSON API, then the rate limits, then vinext.
//
// wrangler.jsonc used to name `vinext/server/fetch-handler` as `main`, which is
// vinext's App Router entry and nothing else. This file puts the per-visitor
// limits (worker/rateLimit.ts) in front of that same entry, so every request
// that could reach D1 is counted in one place before any route runs. The API
// (worker/api/handler.ts) is in front of both: a request under /api/ is
// answered there, against its key's own limits, and never reaches the site.

import app from "vinext/server/app-router-entry";
import { withApi } from "./api/handler.ts";
import { withRateLimits } from "./rateLimit.ts";

export default {
  fetch: withApi<Env>(withRateLimits<Env>((request, env, ctx) => app.fetch(request, env, ctx))),
} satisfies ExportedHandler<Env>;
