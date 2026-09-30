// The Worker's entry: the host decides, then the API or the rate limits and vinext.
//
// wrangler.jsonc used to name `vinext/server/fetch-handler` as `main`, which is
// vinext's App Router entry and nothing else. This file puts two things in
// front of that entry. worker/hosts.ts reads each request's host: the API's
// host goes to the API (worker/api/handler.ts), against its key's own limits,
// and `lexema.fyi` and the developer site go to the App Router. On the way
// there, the per-visitor limits (worker/rateLimit.ts) count every request that
// could reach D1, in one place, before any route runs. Behind them, the
// developer site's sign-in routes (worker/signIn.ts), billing routes
// (worker/billing.ts) and dashboard actions (worker/dashboard.ts) are
// answered before vinext, since they set cookies,
// change data and redirect rather than render, and so is a Preview's test
// sign-in (worker/testSignIn.ts), which no other stage has. In front of the
// host routing, Stripe's webhook on the developer site (worker/stripeWebhook.ts)
// is answered outside the per-visitor limits. Around all of it,
// the stage (worker/stage.ts) adds what its responses carry: noindex on a
// Preview. A shared link's card (worker/card.ts) is answered in front of the
// per-visitor limits: one served from Cloudflare's cache reaches no database,
// and one it draws counts as a search itself. It also exports the account
// meter's Durable Object class (worker/api/accountMeterObject.ts), which
// wrangler.jsonc binds as ACCOUNT_METER.

import { env } from "cloudflare:workers";
import app from "vinext/server/app-router-entry";
import { answerApi, apiNotFound } from "./api/handler.ts";
import { withBilling } from "./billing.ts";
import { withCards } from "./card.ts";
import { workerDesk } from "./card/desk.ts";
import { withDashboard } from "./dashboard.ts";
import { byHost } from "./hosts.ts";
import { withRateLimits } from "./rateLimit.ts";
import { withSignIn } from "./signIn.ts";
import { parseStage, withStage } from "./stage.ts";
import { withStripeWebhook } from "./stripeWebhook.ts";
import { withTestSignIn } from "./testSignIn.ts";

export { AccountMeterObject } from "./api/accountMeterObject.ts";

// Read at startup, so an unknown stage refuses to boot rather than serve.
const stage = parseStage(env.LEXEMA_STAGE);

export default {
  fetch: withStage<Env>(
    stage,
    withStripeWebhook<Env>(
      byHost<Env>({
        app: withCards<Env>(
          workerDesk,
          withRateLimits<Env>(
            withTestSignIn<Env>(stage, withSignIn<Env>(withBilling<Env>(withDashboard<Env>((request, env, ctx) => app.fetch(request, env, ctx))))),
          ),
        ),
        api: answerApi,
        apiNotFound,
      }),
    ),
  ),
} satisfies ExportedHandler<Env>;
