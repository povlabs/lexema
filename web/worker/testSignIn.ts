// The test sign-in on a Preview's developer site (#245, ADR 0018).
//
//   POST /sign-in/test-developer   sign in as the test developer, then /dashboard,
//                                  or on to Checkout for a plan chosen before it
//
// A reviewer's capture of a Preview clicks one button on the sign-in page and
// reaches the dashboard with no credential of its own. It signs in one fixed
// account, the test developer (src/accounts/testDeveloper.ts), in that
// Preview's own `APP_DB`, which no other Preview and not production binds.
//
// The route exists only where `offersTestSignIn` says: the `preview` stage and
// a Preview's developer host. On any other stage `withTestSignIn` adds nothing
// to the Worker at all, and on any other host the path is not this route, so
// the request goes on to the App Router, which answers it as a missing page.
// Like the provider sign-in (worker/signIn.ts), it is answered before vinext,
// since it sets a cookie and redirects rather than renders.

import { authSecret } from "@lexema/accounts/auth.ts";
import { signInTestDeveloper } from "@lexema/accounts/testDeveloper.ts";
import { DEVELOPERS_SEGMENT, isDeveloperPreviewHost } from "./hosts.ts";
import type { FetchHandler } from "./rateLimit.ts";
import { afterSignIn, liveContext, redirect, text, type SignInBindings, type SignInContext } from "./signIn.ts";
import type { Stage } from "./stage.ts";

/** Where the test sign-in is posted, on a Preview's developer host. */
export const TEST_SIGN_IN = "/sign-in/test-developer";

/** Whether the test sign-in exists on this stage and host. */
export const offersTestSignIn = (stage: Stage, hostname: string): boolean => stage === "preview" && isDeveloperPreviewHost(hostname);

/** Whether a URL, as the App Router would see it, is the test sign-in on a Preview's developer host. */
export const isTestSignIn = (url: URL): boolean =>
  isDeveloperPreviewHost(url.hostname) && url.pathname === `/${DEVELOPERS_SEGMENT}${TEST_SIGN_IN}`;

/** What the test sign-in runs against: the app database, and the time. */
export type TestSignInContext = Pick<SignInContext, "appDb" | "now">;

/** Answer the test sign-in. */
export async function answerTestSignIn(request: Request, context: TestSignInContext): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "POST") return text(405, "POST only.", new Headers({ allow: "POST" }));
  // Only this site's own sign-in page may sign a browser in as the test developer.
  if (request.headers.get("origin") !== url.origin) return text(403, "Sign-in must come from this site.");
  const secret = authSecret();
  if (secret === undefined || context.appDb === undefined) return text(503, "The test sign-in is not available.");
  try {
    const cookies = await signInTestDeveloper(context.appDb, secret, url.origin, request.headers, context.now);
    return redirect(afterSignIn(request.headers.get("cookie")), cookies);
  } catch (failure) {
    console.error("test sign-in failed", failure);
    return text(503, "Sign-in could not be finished. Try again later.");
  }
}

/**
 * On the `preview` stage, answer the test sign-in here and hand every other
 * request to the app. On any other stage, the app as it is.
 */
export function withTestSignIn<E extends SignInBindings>(
  stage: Stage,
  app: FetchHandler<E>,
  contextOf: (env: E) => TestSignInContext = liveContext,
): FetchHandler<E> {
  if (stage !== "preview") return app;
  return (request, env, ctx) =>
    isTestSignIn(new URL(request.url)) ? answerTestSignIn(request, contextOf(env)) : app(request, env, ctx);
}
