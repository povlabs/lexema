// `POST /report/open`: the report box asks for its opening token when it opens
// (#51). The token and the server's time are stored, and a report is timed
// against them, so the 3 s minimum is measured on the server's clock alone
// (lib/dictionary/report.ts). Counted by the REPORT_OPEN_LIMIT binding (worker/shared/rateLimit.ts).
// On production without both Turnstile keys the box is closed: nothing is
// stored, and the Worker logs which key is unset (#621).

import { log } from "@lexema/log/requestLog.ts";
import { turnstile } from "@/lib/dictionary/db";
import { appDatabase } from "@/lib/shared/database.ts";
import { closedLine, openReport } from "@/lib/dictionary/report.ts";

const failed = (): Response => Response.json({ outcome: "failed" }, { status: 503, headers: { "cache-control": "no-store" } });

export async function POST(): Promise<Response> {
  const challenge = turnstile();
  if (challenge.state === "unset") {
    log.error(closedLine(challenge.missing));
    return failed();
  }
  try {
    const token = await openReport(appDatabase(), Date.now());
    return Response.json({ outcome: "opened", token }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    log.error("report open failed", {}, error);
    return failed();
  }
}
