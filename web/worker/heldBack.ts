// The hosts a production deploy leaves out until the developer site is ready
// (#159, #164).
//
// Epic #159's ruling: nothing on developers.lexema.fyi or api.lexema.fyi is
// published before the whole developer site is ready. `env.production` in
// wrangler.jsonc lists all three custom domains, as the site will run, and a
// deploy creates every custom domain it lists. So the build drops these from
// the routes it writes (vite.config.ts), and a deploy from `main` goes to
// lexema.fyi alone. Launching the developer site is emptying this list, then
// deleting this file and its use in vite.config.ts.
//
// Imported by vite.config.ts, which Vite loads before its aliases apply, so
// this file imports nothing.

/** The custom domains a production deploy does not create yet. */
export const HELD_BACK: readonly string[] = ["developers.lexema.fyi", "api.lexema.fyi"];

/** A Wrangler route: a bare pattern, or an object naming one. */
type Route = string | { pattern: string };

/** `routes` without the held-back hosts, in the same order. */
export function withoutHeldBack<R extends Route>(routes: readonly R[]): R[] {
  return routes.filter((route) => !HELD_BACK.includes(typeof route === "string" ? route : route.pattern));
}
