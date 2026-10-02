// vinext's instrumentation hook (Next.js's `instrumentation.ts`), for one thing:
// logging an error thrown in a page or a route handler (#413).
//
// In a production build vinext catches an error thrown while a page renders,
// answers with its error page, and prints nothing; the only place the error
// goes is `onRequestError` (vinext/dist/server/app-rsc-errors.js). So without
// this file a broken page would leave no line in Workers Logs. The line names
// the route and the request id `log` adds, never the request's path or query,
// which is where a search string is.

import { log } from "@lexema/log/requestLog.ts";

/** What vinext says about where the error was thrown; the fields this file reads. */
interface RequestErrorContext {
  routePath: string;
  routeType: "render" | "route" | "action" | "middleware";
}

export function onRequestError(error: unknown, _request: unknown, context: RequestErrorContext): void {
  log.error("app request failed", { routePath: context.routePath, routeType: context.routeType }, error);
}
