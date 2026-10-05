// `POST /report`: a reader's report of a mistake on a word page (#51), as JSON.
//
// The Worker has already counted it against the per-minute report limit
// (worker/shared/rateLimit.ts). What a report must carry, the hourly allowance, the
// honeypot, the timing check and the store are lib/dictionary/report.ts; this file is the
// wiring to the request and the Worker's bindings. Without a secret the box
// needs, it answers `failed` and logs which one is unset (#621).

import { log } from "@lexema/log/requestLog.ts";
import { visitorKey } from "@/worker/shared/rateLimit.ts";
import { reportKeysOfWorker, servedRelease } from "@/lib/dictionary/db";
import { appDatabase, database } from "@/lib/shared/database.ts";
import { closedLine, readSubmission, receiveReport, REPORT_STATUS, verifyTurnstile, type ReportAnswer } from "@/lib/dictionary/report.ts";

const answer = (body: ReportAnswer): Response =>
  Response.json(body, { status: REPORT_STATUS[body.outcome], headers: { "cache-control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  const keys = await reportKeysOfWorker();
  if (keys.state === "closed") {
    log.error(closedLine(keys.missing));
    return answer({ outcome: "failed" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return answer({ outcome: "rejected", reason: "malformed" });
  }
  const submission = readSubmission(body);
  if ("reason" in submission) return answer({ outcome: "rejected", reason: submission.reason });

  const ip = request.headers.get("cf-connecting-ip");
  const { turnstile } = keys;
  const { hostname } = new URL(request.url);
  try {
    return answer(
      await receiveReport(submission, {
        db: database(),
        appDb: appDatabase(),
        release: servedRelease(),
        now: Date.now(),
        visitor: visitorKey(ip),
        visitorCodeKey: keys.visitorCodeKey,
        verifyChallenge: turnstile.state === "on" ? (token) => verifyTurnstile(turnstile.secretKey, token, ip, hostname) : undefined,
      }),
    );
  } catch (error) {
    // The reason stays in the Worker's log, as for a failed lookup.
    log.error("report failed", {}, error);
    return answer({ outcome: "failed" });
  }
}
