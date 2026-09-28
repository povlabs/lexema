// The Worker's entry: the host decides, then the API or the rate limits and vinext.
//
// wrangler.jsonc used to name `vinext/server/fetch-handler` as `main`, which is
// vinext's App Router entry and nothing else. This file puts two things in
// front of that entry. worker/hosts.ts reads each request's host: the API's
// host goes to the API (worker/api/handler.ts), against its key's own limits,
// and `lexema.fyi` and the developer site go to the App Router. On the way
// there, the per-visitor limits (worker/rateLimit.ts) count every request that
// could reach D1, in one place, before any route runs. Behind them, the
// developer site's sign-in routes (worker/signIn.ts) are answered before
// vinext, since they set cookies and redirect rather than render.

import app from "vinext/server/app-router-entry";
import { answerApi, apiNotFound } from "./api/handler.ts";
import { byHost } from "./hosts.ts";
import { withRateLimits } from "./rateLimit.ts";
import { withSignIn } from "./signIn.ts";

export default {
  fetch: byHost<Env>({
    app: withRateLimits<Env>(withSignIn<Env>((request, env, ctx) => app.fetch(request, env, ctx))),
    api: answerApi,
    apiNotFound,
  }),
} satisfies ExportedHandler<Env>;
