// `POST /report`: a reader's report of a mistake on a word page (#51), as JSON.
//
// The Worker has already counted it against the per-minute report limit
// (worker/rateLimit.ts). What a report must carry, the hourly allowance, the
// honeypot, the timing check and the store are lib/dictionary/report.ts; this file is the
// wiring to the request and the Worker's bindings.

import { visitorKey } from "@/worker/rateLimit.ts";
import { servedRelease, turnstile } from "@/lib/dictionary/db";
import { appDatabase, database } from "@/lib/shared/database.ts";
import { readSubmission, receiveReport, REPORT_STATUS, verifyTurnstile, type ReportAnswer } from "@/lib/dictionary/report.ts";

const answer = (body: ReportAnswer): Response =>
  Response.json(body, { status: REPORT_STATUS[body.outcome], headers: { "cache-control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return answer({ outcome: "rejected", reason: "malformed" });
  }
  const submission = readSubmission(body);
  if ("reason" in submission) return answer({ outcome: "rejected", reason: submission.reason });

  const ip = request.headers.get("cf-connecting-ip");
  const secret = turnstile()?.secretKey;
  try {
    return answer(
      await receiveReport(submission, {
        db: database(),
        appDb: appDatabase(),
        release: servedRelease(),
        now: Date.now(),
        visitor: visitorKey(ip),
        verifyChallenge: secret === undefined ? undefined : (token) => verifyTurnstile(secret, token, ip),
      }),
    );
  } catch (error) {
    // The reason stays in the Worker's log, as for a failed lookup.
    console.error("report failed", error);
    return answer({ outcome: "failed" });
  }
}
