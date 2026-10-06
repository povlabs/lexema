// The Worker's entry: the host decides, then the API or the rate limits and vinext.
//
// wrangler.jsonc used to name `vinext/server/fetch-handler` as `main`, which is
// vinext's App Router entry and nothing else. This file puts two things in
// front of that entry. worker/shared/hosts.ts reads each request's host: the API's
// host goes to the API (worker/api/handler.ts), against its key's own limits,
// and `lexema.fyi` and the developer site go to the App Router. On the way
// there, the per-visitor limits (worker/shared/rateLimit.ts) count, in one place and
// before any route runs, the requests each site lists (worker/dictionary/limits.ts,
// worker/developers/limits.ts): searches, suggestions and reports, and on the
// developer site sign-in starts, key creations and the billing routes. Other requests that read or write D1, such as a dashboard
// page or revoking a key, are not counted. Behind them, the
// developer site's sign-in routes (worker/developers/signIn.ts), billing routes
// (worker/developers/billing.ts) and dashboard actions (worker/developers/dashboard.ts) are
// answered before vinext, since they set cookies,
// change data and redirect rather than render, and so is a Preview's test
// sign-in (worker/developers/testSignIn.ts), which no other stage has. While
// sign-up is closed (worker/developers/signUp.ts), the sign-in and Checkout
// routes answer with the sign-in page before they run. In front of the
// host routing, Stripe's webhook on the developer site (worker/developers/stripeWebhook.ts)
// is answered outside the per-visitor limits. Around all of it,
// the stage (worker/shared/stage.ts) adds what its responses carry: noindex on a
// Preview. Inside the stage, every response gets the browser security headers,
// and every HTML page a Content Security Policy with a fresh script nonce
// (worker/shared/securityHeaders.ts). Inside those, every request runs under its own id, and anything
// thrown past the handlers is logged and answered 500 (worker/shared/requestLog.ts).
// The health check (worker/shared/health.ts) is answered next, on every host and in
// front of the per-visitor limits, so a monitor is never counted as a visitor. Around
// the host routing, a word page or the home page that may stay in the reader's
// browser for an hour is marked so (worker/dictionary/pageCache.ts). A shared link's card (worker/dictionary/card.ts) is answered in front of the
// per-visitor limits: one served from Cloudflare's cache reaches no database,
// and one it draws counts as a search itself. It also exports the account
// meter's Durable Object class (worker/api/accountMeterObject.ts), which
// wrangler.jsonc binds as ACCOUNT_METER. Beside `fetch`, `scheduled` answers
// wrangler.jsonc's cron trigger: it erases reports' visitor codes once their
// hour is past (worker/dictionary/reportSweep.ts).
//
// Every other file under worker/ sits in one site's folder, and this is the one
// file that imports from all of them (web/test/layout.test.ts).

import { env } from "cloudflare:workers";
import app from "vinext/server/app-router-entry";
import { answerApi, apiNotFound } from "./api/handler.ts";
import { withBilling } from "./developers/billing.ts";
import { withDashboard } from "./developers/dashboard.ts";
import { developerLimitOf } from "./developers/limits.ts";
import { withSignIn } from "./developers/signIn.ts";
import { parseSignUp, withSignUp } from "./developers/signUp.ts";
import { withStripeWebhook } from "./developers/stripeWebhook.ts";
import { withTestSignIn } from "./developers/testSignIn.ts";
import { withCards } from "./dictionary/card.ts";
import { workerDesk } from "./dictionary/card/desk.ts";
import { dictionaryLimitOf } from "./dictionary/limits.ts";
import { withPageCache } from "./dictionary/pageCache.ts";
import { sweepReports } from "./dictionary/reportSweep.ts";
import { withHealth } from "./shared/health.ts";
import { byHost } from "./shared/hosts.ts";
import { withRateLimits } from "./shared/rateLimit.ts";
import { withRequestLog } from "./shared/requestLog.ts";
import { withSecurityHeaders } from "./shared/securityHeaders.ts";
import { parseStage, withStage } from "./shared/stage.ts";

export { AccountMeterObject } from "./api/accountMeterObject.ts";

// Read at startup, so an unknown stage or sign-up state refuses to boot rather than serve.
const stage = parseStage(env.LEXEMA_STAGE);
const signUp = parseSignUp(env.DEVELOPER_SIGN_UP);

export default {
  fetch: withStage<Env>(
    stage,
    withSecurityHeaders<Env>(
      withRequestLog<Env>(
        withHealth<Env>(
          withStripeWebhook<Env>(
            withPageCache<Env>(
              byHost<Env>({
                app: withCards<Env>(
                  workerDesk,
                  withRateLimits<Env>(
                    { developers: developerLimitOf, dictionary: dictionaryLimitOf },
                    withTestSignIn<Env>(
                      stage,
                      withSignUp<Env>(signUp, withSignIn<Env>(withBilling<Env>(withDashboard<Env>((request, env, ctx) => app.fetch(request, env, ctx))))),
                    ),
                  ),
                ),
                api: answerApi,
                apiNotFound,
              }),
            ),
          ),
        ),
      ),
    ),
  ),
  scheduled: sweepReports,
} satisfies ExportedHandler<Env>;
