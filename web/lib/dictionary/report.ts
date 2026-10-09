// A reader's report of a mistake on a word page, or of a word a search did not
// find (#441), from the moment it arrives until it is stored for review (#51,
// ruled on 2026-09-27; #12 reviews it).
//
// Nothing here acts on a report. It is checked, counted and stored, and waits
// for a person. The four spam layers Huey chose are all here or at the edge:
//
// 1. A per-visitor limit. The Worker binding (web/worker/shared/rateLimit.ts) stops a
//    burst before the database is touched; it only knows 10 s and 60 s
//    windows, so the hourly allowance is counted here, over the stored reports.
//    The visitor code a report is counted by is an HMAC-SHA-256 of the
//    visitor's rate-limit key under the Worker secret `REPORT_VISITOR_KEY`
//    (`visitorHash`), so without that secret no address can be tried against
//    it (#621). Each report keeps it only while that count needs it: one
//    hour, then `forgetVisitors` erases it (#570).
// 2. A hidden honeypot field and a minimum time between opening the box and
//    sending it, measured on the server's clock alone: the box asks for a
//    token when it opens (`openReport`), and the send is timed against it. A
//    report that trips either is dropped and answered as sent, so a bot learns
//    nothing from the reply.
// 3. Cloudflare Turnstile, verified before storing when both its keys are
//    configured (`turnstileConfig`), its pass bound to the request's
//    hostname. On a local or Preview Worker with either key missing it is
//    off; on production a missing key closes the box instead, so bot
//    protection never switches off unseen (#621).
// 4. Nothing automatic: a stored report changes nothing on the page.
//
// Reports and openings live in the app database (`APP_DB`); the dictionary is
// only read, to check the reading a report names (ADR 0018).
//
// A secret the box needs and lacks closes it: `POST /report`, and for a
// Turnstile key `POST /report/open` too, answers `failed` and the Worker logs
// which secret is unset (`reportKeys`, `closedLine`). Nothing else reads these
// secrets, so every other route keeps serving.

import { and, count, eq, gt, isNotNull, lt, lte } from "drizzle-orm";
import type { AppTables } from "@lexema/db/app/database.ts";
import { readerReport, reportOpening } from "@lexema/db/app/schema.ts";
import type { LookupDatabase } from "@lexema/lookup/database.ts";
import type { EntryIdentity } from "@lexema/lookup/types.ts";
import type { Stage } from "@/worker/shared/stage.ts";
import type { PageReading } from "./wordPage.ts";

/** What a word page's box asks the reader to pick: what is wrong on the page. */
export const REPORT_CHOICES = ["meaning", "example", "form", "synonym", "other"] as const;
export type ReportChoice = (typeof REPORT_CHOICES)[number];

/**
 * What a box reports on. A word page's box asks what is wrong and may name one
 * of its readings; the not-found page's box reports a missing word, which has
 * no reading, and asks nothing about it (Huey's ruling on #441).
 */
export type ReportSubject = { kind: "mistake"; readings: readonly ReportReading[] } | { kind: "missing" };

/** The box's link and title, the same words for both, as the page names what it reports. */
export const REPORT_SUBJECT_LABEL: Readonly<Record<ReportSubject["kind"], string>> = {
  mistake: "Segnala un errore",
  missing: "Segnala una parola mancante",
};

/**
 * The hint in the box's details field. A missing word needs no details: the
 * query is the report (Huey's ruling on #441, 2026-10-03).
 */
export const REPORT_DETAILS_HINT: Readonly<Record<ReportSubject["kind"], string>> = {
  mistake: "Cosa dovrebbe dire invece?",
  missing: "Qualcosa da aggiungere? (facoltativo)",
};

/**
 * What a report is about, as `reader_report.choice` stores it, and the reading
 * it names: one of a word page's choices, or `missing`, which names no reading.
 */
export type ReportTarget =
  | { choice: ReportChoice; /** The reading the reader picked; absent for none or "Non so". */ recordId: number | undefined }
  | { choice: "missing"; recordId: undefined };

/**
 * A reading a report can name: a source record, which `receiveReport` checks
 * against `source_record`. A page-only entry (#403) has no record, so it is
 * not offered; a report on it is about the word.
 */
export interface ReportReading {
  recordId: number;
  /** The reading's number on the page; none for a page's lone bare reading, which shows none (#696). */
  number: PageReading["number"] | undefined;
  posTitle: string;
}

/**
 * The page's readings a report can name, in page order: every one backed by a
 * source record. Here, not in the client dialog, because server components
 * call it, and a function exported from a "use client" file is not callable there.
 */
export function reportReadings(readings: readonly { number: ReportReading["number"]; reading: EntryIdentity & { posTitle: string } }[]): ReportReading[] {
  return readings.flatMap(({ number, reading }) => (reading.recordId === undefined ? [] : [{ number, recordId: reading.recordId, posTitle: reading.posTitle }]));
}

/** What each choice is called in the box. */
export const REPORT_CHOICE_LABEL: Readonly<Record<ReportChoice, string>> = {
  meaning: "Un significato",
  example: "Un esempio",
  form: "Una forma",
  synonym: "Un sinonimo",
  other: "Altro",
};

/**
 * The box's other words, in Italian as the whole word page is (Huey's ruling
 * of 2026-10-09 on #789).
 */
export const REPORT_BOX = {
  close: "Chiudi",
  subjectLead: "su",
  choiceQuestion: "Cosa c’è di sbagliato?",
  readingQuestion: "Quale sezione?",
  optional: "facoltativo",
  unsure: "Non so",
  details: "Dettagli",
  honeypot: "Sito web",
  retry: "Riprova",
  noAccount: "Nessun account richiesto.",
  cancel: "Annulla",
  send: "Invia segnalazione",
  sentTitle: "Segnalazione inviata",
  /** The thanks around the word: `Grazie. La tua segnalazione su casa è stata inviata.` */
  sentBefore: "Grazie. La tua segnalazione su",
  sentAfter: "è stata inviata.",
} as const;

/** What the box says when a send did not go through. */
export const SEND_TROUBLE = {
  limited: "Troppe segnalazioni da parte tua nell’ultima ora. Riprova più tardi.",
  challenge: "La verifica che tu sia una persona non è riuscita. Riprova.",
  expired: "Questa finestra è aperta da troppo tempo. Chiudila e riaprila.",
  failed: "Non è stato possibile inviare la segnalazione. Riprova tra un momento.",
} as const;

/** Whether a report must carry details: every one but a missing word, whose query says it all. */
export const needsDetails = (target: ReportTarget): boolean => target.choice !== "missing";

/** The longest details a report may carry, in characters. */
export const REPORT_DETAILS_LIMIT = 2000;
/** The least time, in milliseconds, between opening the box and sending it. */
export const REPORT_MIN_OPEN_MS = 3000;
/** How many reports one visitor may send in an hour. */
export const REPORTS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
const WORD_LIMIT = 200;

/** What the box sends, as JSON. */
export type ReportSubmission = ReportTarget & {
  word: string;
  details: string;
  /** The token `openReport` issued when the box opened. */
  openToken: string;
  /** The honeypot: a field no reader sees, so any value in it is a bot's. */
  website: string;
  /** The Turnstile token, when the page carried the widget. */
  challenge: string | undefined;
};

const isChoice = (value: unknown): value is ReportChoice => REPORT_CHOICES.includes(value as ReportChoice);

/** The target a body names, or why it cannot be one: a missing word names no reading. */
function readTarget(choice: unknown, recordId: number | undefined): ReportTarget | { reason: ReportRejection } {
  if (choice === "missing") return recordId === undefined ? { choice, recordId } : { reason: "reading" };
  return isChoice(choice) ? { choice, recordId } : { reason: "choice" };
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
  if (choice !== "missing" && !isChoice(choice)) return { reason: "choice" };
  if (typeof details !== "string") return { reason: "details" };
  if (details.length > REPORT_DETAILS_LIMIT) return { reason: "details-too-long" };
  if (recordId !== undefined && recordId !== null && !(typeof recordId === "number" && Number.isInteger(recordId))) {
    return { reason: "reading" };
  }
  const target = readTarget(choice, typeof recordId === "number" ? recordId : undefined);
  if ("reason" in target) return target;
  if (needsDetails(target) && details.trim() === "") return { reason: "details" };
  return {
    word,
    ...target,
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
  /** The key `visitor` is stored under (`visitorHash`). */
  visitorCodeKey: VisitorCodeKey;
  /** Turnstile's verdict on a token, or undefined where Turnstile is off (`turnstileConfig`). */
  verifyChallenge: ((token: string | undefined) => Promise<boolean>) | undefined;
}

/** The Worker secret a visitor code is keyed by. */
export const VISITOR_CODE_SECRET = "REPORT_VISITOR_KEY";

/**
 * `REPORT_VISITOR_KEY`, imported for HMAC-SHA-256. Only `of` makes one, and
 * only from a secret that is set, so no report is stored without it.
 */
export class VisitorCodeKey {
  private constructor(readonly hmac: CryptoKey) {}

  /** The key `secret` names, or `missing` when it is unset or blank. */
  static async of(secret: string | undefined): Promise<VisitorCodeKey | "missing"> {
    const value = secret?.trim() ?? "";
    if (value === "") return "missing";
    const encoded = new TextEncoder().encode(value);
    return new VisitorCodeKey(await crypto.subtle.importKey("raw", encoded, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]));
  }
}

/**
 * A visitor key as stored: its HMAC-SHA-256 under `key`, as 64 lowercase hex
 * characters. The table never holds an address, and without the secret no
 * address can be tried against a code.
 */
export async function visitorHash(visitor: string, key: VisitorCodeKey): Promise<string> {
  const digest = await crypto.subtle.sign("HMAC", key.hmac, new TextEncoder().encode(visitor));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * When the hourly allowance opens at `now`: the reports received after it are
 * the ones counted, and the only ones that still need their visitor code.
 */
const allowanceOpens = (now: number): string => new Date(now - HOUR_MS).toISOString();

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

  const visitor = await visitorHash(context.visitor, context.visitorCodeKey);
  const [{ sent }] = await app
    .select({ sent: count() })
    .from(readerReport)
    .where(and(eq(readerReport.visitorHash, visitor), gt(readerReport.receivedAt, allowanceOpens(now))));
  if (sent >= REPORTS_PER_HOUR) return { outcome: "limited" };

  // The reading is kept by its source line, which a re-seed cannot renumber
  // (#12), in the release that line counts in: the master's own, or the later
  // one a change brought the record from (#18).
  let line: { releaseId: string; lineNo: number; lineSha256: string } | undefined;
  if (submission.recordId !== undefined) {
    [line] = await db.all<{ releaseId: string; lineNo: number; lineSha256: string }>(
      `SELECT release_id AS releaseId, line_no AS lineNo, line_sha256 AS lineSha256 FROM served_record
        WHERE record_id = ?1 AND master_release_id = ?2`,
      [submission.recordId, context.release],
    );
    if (line === undefined) return { outcome: "rejected", reason: "reading" };
  }

  // Stored and its opening used up together, so a token opens one report.
  await app.batch([
    app.insert(readerReport).values({
      releaseId: line?.releaseId ?? context.release,
      word: submission.word,
      recordId: submission.recordId ?? null,
      lineNo: line?.lineNo ?? null,
      lineSha256: line?.lineSha256 ?? null,
      choice: submission.choice,
      details: submission.details,
      visitorHash: visitor,
      receivedAt: new Date(now).toISOString(),
    }),
    app.delete(reportOpening).where(eq(reportOpening.token, submission.openToken)),
  ]);
  return { outcome: "sent" };
}

/**
 * Erase the visitor code of every report the hourly allowance no longer
 * counts: each one received an hour or more before `now` (Huey's ruling on
 * #570). The code is kept only for that count, so the allowance holds as it
 * did; the report itself stays. The Worker's cron trigger runs this every five
 * minutes (worker/dictionary/reportSweep.ts).
 */
export async function forgetVisitors({ app }: AppTables, now: number): Promise<void> {
  await app
    .update(readerReport)
    .set({ visitorHash: null })
    .where(and(isNotNull(readerReport.visitorHash), lte(readerReport.receivedAt, allowanceOpens(now))));
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

/** Turnstile's two keys, by their Worker names. */
export type TurnstileKeyName = "TURNSTILE_SITE_KEY" | "TURNSTILE_SECRET_KEY";

/** A secret the report box cannot take reports without, by its Worker name. */
export type ReportSecret = typeof VISITOR_CODE_SECRET | TurnstileKeyName;

/** One or more of `S`. */
type Some<S> = readonly [S, ...S[]];

/**
 * Turnstile on this Worker: on, with both keys; off, on a stage that may run
 * without it; or `unset` on production, which may not, with the keys it lacks.
 */
export type TurnstileConfig =
  | { state: "on"; siteKey: string; secretKey: string }
  | { state: "off" }
  | { state: "unset"; missing: Some<TurnstileKeyName> };

/**
 * Turnstile is on only when both keys are set. With one alone the widget and
 * the check could not agree — a secret with no site key would refuse every
 * report — so on a local or Preview Worker it is off, and `warn` says which key
 * is missing. Production never takes reports without it: a missing key there
 * is `unset`, and the report routes close the box (#621).
 */
export function turnstileConfig(
  stage: Stage,
  siteKey: string | undefined,
  secretKey: string | undefined,
  warn: (message: string) => void,
): TurnstileConfig {
  const site = siteKey?.trim() ?? "";
  const secret = secretKey?.trim() ?? "";
  if (site !== "" && secret !== "") return { state: "on", siteKey: site, secretKey: secret };
  const missing: TurnstileKeyName[] = [];
  if (site === "") missing.push("TURNSTILE_SITE_KEY");
  if (secret === "") missing.push("TURNSTILE_SECRET_KEY");
  if (stage === "production") return { state: "unset", missing: [missing[0], ...missing.slice(1)] };
  if (missing.length === 1) warn(`Turnstile is off: ${missing[0]} is not set, and both are needed`);
  return { state: "off" };
}

/** The site key the page's widget renders with, or none where Turnstile is not on. */
export const turnstileSiteKey = (config: TurnstileConfig): string | undefined => (config.state === "on" ? config.siteKey : undefined);

/** What `POST /report` needs before it reads a report, or every secret it lacks. */
export type ReportKeys =
  | { state: "ready"; visitorCodeKey: VisitorCodeKey; turnstile: Exclude<TurnstileConfig, { state: "unset" }> }
  | { state: "closed"; missing: Some<ReportSecret> };

/** The report box's keys, from what this Worker has set. */
export function reportKeys(turnstile: TurnstileConfig, visitorCodeKey: VisitorCodeKey | "missing"): ReportKeys {
  if (turnstile.state !== "unset" && visitorCodeKey !== "missing") return { state: "ready", visitorCodeKey, turnstile };
  const missing: ReportSecret[] = turnstile.state === "unset" ? [...turnstile.missing] : [];
  if (visitorCodeKey === "missing") missing.push(VISITOR_CODE_SECRET);
  return { state: "closed", missing: [missing[0], ...missing.slice(1)] };
}

/** The error line a closed box logs, naming every secret it lacks. */
export const closedLine = (missing: Some<ReportSecret>): string => `report box closed: ${missing.join(" and ")} not set`;

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

/**
 * Turnstile's server-side check of a token, with the Worker's `fetch`. A pass
 * counts only on the site it was solved on: siteverify names that hostname,
 * and it must be the request's own.
 */
export async function verifyTurnstile(secret: string, token: string | undefined, remoteIp: string | null, hostname: string): Promise<boolean> {
  if (token === undefined) return false;
  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp !== null) form.set("remoteip", remoteIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  if (!response.ok) return false;
  const verdict = (await response.json()) as { success?: boolean; hostname?: string };
  return verdict.success === true && verdict.hostname === hostname;
}

/** Why the box could not get its opening token: opened too often, or anything else. */
export type OpeningTrouble = "open-limited" | "open-failed";

/** What the box says when it could not open, above a *Riprova* button. */
export const OPENING_TROUBLE: Readonly<Record<OpeningTrouble, string>> = {
  "open-limited": "Hai aperto questa finestra troppe volte nell’ultimo minuto. Aspetta un momento, poi riprova.",
  "open-failed": "La finestra non è riuscita a prepararsi per l’invio. Riprova tra un momento.",
};

/**
 * Ask the server for this opening's token (`POST /report/open`). The box calls
 * it when it opens and again from its *Riprova* button, so a failed opening is
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
