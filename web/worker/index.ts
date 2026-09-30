// The Worker's entry: the host decides, then the API or the rate limits and vinext.
//
// wrangler.jsonc used to name `vinext/server/fetch-handler` as `main`, which is
// vinext's App Router entry and nothing else. This file puts two things in
// front of that entry. worker/hosts.ts reads each request's host: the API's
// host goes to the API (worker/api/handler.ts), against its key's own limits,
// and `lexema.fyi` and the developer site go to the App Router. On the way
// there, the per-visitor limits (worker/rateLimit.ts) count every request that
// could reach D1, in one place, before any route runs. Behind them, the
// developer site's sign-in routes (worker/signIn.ts) and dashboard actions
// (worker/dashboard.ts) are answered before vinext, since they set cookies,
// change data and redirect rather than render. Around all of it, the stage
// (worker/stage.ts) adds what its responses carry: noindex on a Preview.

import { env } from "cloudflare:workers";
import app from "vinext/server/app-router-entry";
import { answerApi, apiNotFound } from "./api/handler.ts";
import { withDashboard } from "./dashboard.ts";
import { byHost } from "./hosts.ts";
import { withRateLimits } from "./rateLimit.ts";
import { withSignIn } from "./signIn.ts";
import { parseStage, withStage } from "./stage.ts";

// Read at startup, so an unknown stage refuses to boot rather than serve.
const stage = parseStage(env.LEXEMA_STAGE);

export default {
  fetch: withStage<Env>(
    stage,
    byHost<Env>({
      app: withRateLimits<Env>(withSignIn<Env>(withDashboard<Env>((request, env, ctx) => app.fetch(request, env, ctx)))),
      api: answerApi,
      apiNotFound,
    }),
  ),
} satisfies ExportedHandler<Env>;
