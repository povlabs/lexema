// The Worker's cron trigger (wrangler.jsonc `triggers`, every five minutes):
// it erases the visitor code of each reader's report older than an hour
// (`forgetVisitors` in lib/dictionary/report.ts, Huey's ruling on #570). A
// sweep run when a report arrives could not keep that promise while none
// arrives, so the schedule runs it. worker/index.ts exports it as `scheduled`.

import { appTablesOverD1 } from "@lexema/db/app/database.ts";
import { forgetVisitors } from "@/lib/dictionary/report.ts";

/** What the sweep needs from the Worker's bindings. */
export interface SweepBindings {
  APP_DB?: D1Database;
}

/**
 * Run the sweep at the trigger's scheduled time. A Worker with no `APP_DB`, as
 * production has none until #19, stores no report, so there is nothing to erase.
 */
export async function sweepReports(controller: Pick<ScheduledController, "scheduledTime">, env: SweepBindings): Promise<void> {
  if (env.APP_DB === undefined) return;
  await forgetVisitors(appTablesOverD1(env.APP_DB), controller.scheduledTime);
}
