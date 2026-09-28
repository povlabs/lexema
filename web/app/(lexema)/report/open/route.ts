// `POST /report/open`: the report box asks for its opening token when it opens
// (#51). The token and the server's time are stored, and a report is timed
// against them, so the 3 s minimum is measured on the server's clock alone
// (app/report.ts). Counted by the REPORT_OPEN_LIMIT binding (worker/rateLimit.ts).

import { database } from "../../../db";
import { openReport } from "../../../report.ts";

export async function POST(): Promise<Response> {
  try {
    const token = await openReport(database(), Date.now());
    return Response.json({ outcome: "opened", token }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("report open failed", error);
    return Response.json({ outcome: "failed" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
