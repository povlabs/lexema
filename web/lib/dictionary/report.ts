// A reader's report of a mistake on a word page, from the moment it arrives
// until it is stored for review (#51, ruled on 2026-09-27; #12 reviews it).
//
// Nothing here acts on a report. It is checked, counted and stored, and waits
// for a person. The four spam layers Huey chose are all here or at the edge:
//
// 1. A per-visitor limit. The Worker binding (web/worker/rateLimit.ts) stops a
//    burst before the database is touched; it only knows 10 s and 60 s
//    windows, so the hourly allowance is counted here, over the stored reports.
// 2. A hidden honeypot field and a minimum time between opening the box and
//    sending it, measured on the server's clock alone: the box asks for a
//    token when it opens (`openReport`), and the send is timed against it. A
//    report that trips either is dropped and answered as sent, so a bot learns
//    nothing from the reply.
// 3. Cloudflare Turnstile, verified before storing when both its keys are
//    configured (`turnstileConfig`); with either missing it is off.
// 4. Nothing automatic: a stored report changes nothing on the page.
//
// Reports and openings live in the app database (`APP_DB`); the dictionary is
// only read, to check the reading a report names (ADR 0018).

import { and, count, eq, gt, lt } from "drizzle-orm";
import type { AppTables } from "@lexema/db/app/database.ts";
import { readerReport, reportOpening } from "@lexema/db/app/schema.ts";
import type { LookupDatabase } from "@lexema/lookup/database.ts";

export const REPORT_CHOICES = ["meaning", "example", "form", "synonym", "other"] as const;
export type ReportChoice = (typeof REPORT_CHOICES)[number];

/** What each choice is called in the box. */
export const REPORT_CHOICE_LABEL: Readonly<Record<ReportChoice, string>> = {
  meaning: "A meaning",
  example: "An example",
  form: "A form",
  synonym: "A synonym",
  other: "Something else",
};

/** The longest details a report may carry, in characters. */
export const REPORT_DETAILS_LIMIT = 2000;
/** The least time, in milliseconds, between opening the box and sending it. */
export const REPORT_MIN_OPEN_MS = 3000;
/** How many reports one visitor may send in an hour. */
export const REPORTS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
const WORD_LIMIT = 200;

/** What the box sends, as JSON. */
export interface ReportSubmission {
  word: string;
  choice: ReportChoice;
  /** The reading the reader picked; absent for none or "Not sure". */
  recordId: number | undefined;
  details: string;
  /** The token `openReport` issued when the box opened. */
  openToken: string;
  /** The honeypot: a field no reader sees, so any value in it is a bot's. */
  website: string;
  /** The Turnstile token, when the page carried the widget. */
  challenge: string | undefined;
}

/** `expired`: the box's opening token is unknown, e.g. the box was open across a new release. */
export type ReportRejection = "malformed" | "choice" | "details" | "details-too-long" | "reading" | "challenge" | "expired";

/** The answer the box gets. */
export type ReportAnswer =
  | { outcome: "sent" }
  | { outcome: "rejected"; reason: ReportRejection }
  | { outcome: "limited" }
  | { outcome: "failed" };

/** The HTTP status each answer is sent with. */
export const REPORT_STATUS: Readonly<Record<ReportAnswer["outcome"], number>> = {
  sent: 200,
  rejected: 400,
  limited: 429,
  failed: 503,
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A submission read from the request body, or why it cannot be one. */
export function readSubmission(body: unknown): ReportSubmission | { reason: ReportRejection } {
  if (!isObject(body)) return { reason: "malformed" };
  const { word, choice, recordId, details, openToken, website, challenge } = body;
  if (typeof word !== "string") return { reason: "malformed" };
  if (word.trim() === "" || word.length > WORD_LIMIT) return { reason: "malformed" };
  if (typeof openToken !== "string" || openToken === "" || openToken.length > 100) return { reason: "malformed" };
  if (!REPORT_CHOICES.includes(choice as ReportChoice)) return { reason: "choice" };
  if (typeof details !== "string" || details.trim() === "") return { reason: "details" };
  if (details.length > REPORT_DETAILS_LIMIT) return { reason: "details-too-long" };
  if (recordId !== undefined && recordId !== null && !(typeof recordId === "number" && Number.isInteger(recordId))) {
    return { reason: "reading" };
  }
  return {
    word,
    choice: choice as ReportChoice,
    recordId: typeof recordId === "number" ? recordId : undefined,
    details: details.trim(),
    openToken,
    website: typeof website === "string" ? website : "",
    challenge: typeof challenge === "string" && challenge !== "" ? challenge : undefined,
  };
}

/** What receiving a report needs from the Worker around it. */
export interface ReportContext {
  /** The dictionary, read to check the reading a report names. */
  db: LookupDatabase;
  /** The app database, where reports and openings are stored. */
  appDb: AppTables;
  /** The release the Worker serves; the page's own, never the client's word for it. */
  release: string;
  /** The server's clock, milliseconds since the epoch. */
  now: number;
  /** Whose report this is: `visitorKey` of the request, never stored as it is. */
  visitor: string;
  /** Turnstile's verdict on a token, or undefined when no secret key is configured. */
  verifyChallenge: ((token: string | undefined) => Promise<boolean>) | undefined;
}

/** A visitor key as stored: its SHA-256, so the table never holds an address. */
export async function visitorHash(visitor: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`lexema-report:${visitor}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Check, count and store one report. The only writer of `reader_report`. */
export async function receiveReport(submission: ReportSubmission, context: ReportContext): Promise<ReportAnswer> {
  const { db, now } = context;
  const { app } = context.appDb;
  // Dropped quietly: a filled honeypot.
  if (submission.website !== "") return { outcome: "sent" };
  const [opening] = await app
    .select({ openedAt: reportOpening.openedAt })
    .from(reportOpening)
    .where(eq(reportOpening.token, submission.openToken));
  if (opening === undefined) return { outcome: "rejected", reason: "expired" };
  // Dropped quietly: a box sent faster than a person can, on the server's clock.
  if (now - Date.parse(opening.openedAt) < REPORT_MIN_OPEN_MS) return { outcome: "sent" };

  if (context.verifyChallenge !== undefined && !(await context.verifyChallenge(submission.challenge))) {
    return { outcome: "rejected", reason: "challenge" };
  }

  const visitor = await visitorHash(context.visitor);
  const since = new Date(now - HOUR_MS).toISOString();
  const [{ sent }] = await app
    .select({ sent: count() })
    .from(readerReport)
    .where(and(eq(readerReport.visitorHash, visitor), gt(readerReport.receivedAt, since)));
  if (sent >= REPORTS_PER_HOUR) return { outcome: "limited" };

  if (submission.recordId !== undefined) {
    const found = await db.all<{ found: number }>(
      "SELECT 1 AS found FROM source_record WHERE record_id = ? AND release_id = ?",
      [submission.recordId, context.release],
    );
    if (found.length === 0) return { outcome: "rejected", reason: "reading" };
  }

  // Stored and its opening used up together, so a token opens one report.
  await app.batch([
    app.insert(readerReport).values({
      releaseId: context.release,
      word: submission.word,
      recordId: submission.recordId ?? null,
      choice: submission.choice,
      details: submission.details,
      visitorHash: visitor,
      receivedAt: new Date(now).toISOString(),
    }),
    app.delete(reportOpening).where(eq(reportOpening.token, submission.openToken)),
  ]);
  return { outcome: "sent" };
}

const DAY_MS = 24 * HOUR_MS;

/**
 * Issue the token a box carries when it sends: a random value and the server's
 * time, stored until its report is stored. Openings older than a day are swept.
 */
export async function openReport({ app }: AppTables, now: number): Promise<string> {
  const token = crypto.randomUUID();
  await app.batch([
    app.delete(reportOpening).where(lt(reportOpening.openedAt, new Date(now - DAY_MS).toISOString())),
    app.insert(reportOpening).values({ token, openedAt: new Date(now).toISOString() }),
  ]);
  return token;
}

/** Turnstile's two keys, both set or neither. */
export interface TurnstileConfig {
  siteKey: string;
  secretKey: string;
}

/**
 * Turnstile is on only when both keys are set. With one alone the widget and
 * the check could not agree — a secret with no site key would refuse every
 * report — so it is off, and `warn` says which key is missing.
 */
export function turnstileConfig(
  siteKey: string | undefined,
  secretKey: string | undefined,
  warn: (message: string) => void,
): TurnstileConfig | undefined {
  const site = siteKey?.trim() ?? "";
  const secret = secretKey?.trim() ?? "";
  if (site !== "" && secret !== "") return { siteKey: site, secretKey: secret };
  if (site !== "" || secret !== "") {
    warn(`Turnstile is off: ${site === "" ? "TURNSTILE_SITE_KEY" : "TURNSTILE_SECRET_KEY"} is not set, and both are needed`);
  }
  return undefined;
}

/**
 * What the box shows after an answer, and whether its Turnstile token may be
 * kept. A token is single-use, so after any answer that did not store the
 * report the widget is reset and asked for a fresh one before a retry.
 */
export function afterAnswer(answer: ReportAnswer): {
  status: "sent" | "limited" | "challenge" | "expired" | "failed";
  keepChallenge: boolean;
} {
  switch (answer.outcome) {
    case "sent":
      return { status: "sent", keepChallenge: true };
    case "limited":
      return { status: "limited", keepChallenge: false };
    case "rejected":
      return {
        status: answer.reason === "challenge" ? "challenge" : answer.reason === "expired" ? "expired" : "failed",
        keepChallenge: false,
      };
    case "failed":
      return { status: "failed", keepChallenge: false };
  }
}

/** Turnstile's server-side check of a token, with the Worker's `fetch`. */
export async function verifyTurnstile(secret: string, token: string | undefined, remoteIp: string | null): Promise<boolean> {
  if (token === undefined) return false;
  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp !== null) form.set("remoteip", remoteIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  if (!response.ok) return false;
  const verdict = (await response.json()) as { success?: boolean };
  return verdict.success === true;
}

/** Why the box could not get its opening token: opened too often, or anything else. */
export type OpeningTrouble = "open-limited" | "open-failed";

/** What the box says when it could not open, above a Try again button. */
export const OPENING_TROUBLE: Readonly<Record<OpeningTrouble, string>> = {
  "open-limited": "You have opened this box too often in the last minute. Wait a moment, then try again.",
  "open-failed": "The box could not get ready to send. Try again in a moment.",
};

/**
 * Ask the server for this opening's token (`POST /report/open`). The box calls
 * it when it opens and again from its Try again button, so a failed opening is
 * never final. A 429 is the opening limit, told apart from the hourly report
 * limit.
 */
export async function requestOpening(send: typeof fetch): Promise<{ token: string } | { trouble: OpeningTrouble }> {
  try {
    const response = await send("/report/open", { method: "POST" });
    if (response.status === 429) return { trouble: "open-limited" };
    const opened = (await response.json()) as { outcome?: string; token?: unknown };
    return opened.outcome === "opened" && typeof opened.token === "string" && opened.token !== ""
      ? { token: opened.token }
      : { trouble: "open-failed" };
  } catch {
    return { trouble: "open-failed" };
  }
}
