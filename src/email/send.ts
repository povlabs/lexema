// Sending an account email (./accountEmail.ts) through Cloudflare Email
// Service (#215): the Worker's `send_email` binding `EMAIL`, whose `send()`
// takes a structured message
// (https://developers.cloudflare.com/email-service/api/send-emails/workers-api/).
// Every email is from `noreply@lexema.fyi`, a domain onboarded to Email Sending
// (docs/DEPLOY.md).
//
// An email is sent at most once. What claims it is the caller's write
// (src/billing/planNotice.ts, src/accounts/accounts.ts); a send that then
// fails is logged and not tried again, so a failed email never fails the
// webhook or the deletion that owed it. Without the binding nothing is sent:
// tests hand in a stub, and `wrangler dev` simulates the binding, logging
// each email instead of sending it.

import { and, eq, isNull } from "drizzle-orm";
import type { AppDatabase } from "../db/app/database.js";
import { developerAccount } from "../db/app/schema.js";
import { composeEmail, type AccountEmail } from "./accountEmail.js";

/** The address every account email is from. */
export const SENDER = { email: "noreply@lexema.fyi", name: "Lexema" } as const;

/** A message as the binding's `send()` takes it: the fields Lexema sets. */
export interface EmailMessage {
  readonly to: string;
  readonly from: { readonly email: string; readonly name: string };
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** The part of a `send_email` binding Lexema calls: the Worker's `EMAIL`, or a test's stub. */
export interface EmailBinding {
  send(message: EmailMessage): Promise<unknown>;
}

/** Where account emails go out, and the settings page their one link opens. */
export interface AccountMail {
  readonly binding: EmailBinding;
  /** The developer site's /dashboard/settings, on the host the request came to. */
  readonly settingsUrl: string;
}

/** The path of the dashboard's settings page on the developer site (web/lib/developers/dashboardActions.ts). */
const SETTINGS_PATH = "/dashboard/settings";

/** Account email over this binding, linking to settings on `origin`; `undefined` while the Worker has no binding. */
export const accountMailOf = (binding: EmailBinding | undefined, origin: string): AccountMail | undefined =>
  binding === undefined ? undefined : { binding, settingsUrl: `${origin}${SETTINGS_PATH}` };

/** What sending one email did. */
export type Sent = "sent" | "mail-off" | "failed";

/** The code Email Service puts on a failed send, such as `E_SENDER_NOT_VERIFIED`, if it has one. */
const codeOf = (failure: unknown): string | undefined =>
  typeof failure === "object" && failure !== null && "code" in failure && typeof failure.code === "string" ? failure.code : undefined;

/**
 * Send one account email to `to`. Never throws: a failure is logged with its
 * code, never with the address, and answered `failed`.
 */
export async function sendAccountEmail(mail: AccountMail | undefined, to: string, email: AccountEmail): Promise<Sent> {
  if (mail === undefined) {
    console.info("account email not sent: no EMAIL binding", { kind: email.kind });
    return "mail-off";
  }
  try {
    await mail.binding.send({ to, from: SENDER, ...composeEmail(email, mail.settingsUrl) });
    return "sent";
  } catch (failure) {
    console.error("account email failed", { kind: email.kind, code: codeOf(failure) }, failure);
    return "failed";
  }
}

/** The email of an account that is not deleted: a deleted one's says nothing about the person. */
export const liveAccountEmailQuery = (db: AppDatabase, accountId: number) =>
  db
    .select({ email: developerAccount.email })
    .from(developerAccount)
    .where(and(eq(developerAccount.id, accountId), isNull(developerAccount.deletedAt)));

/**
 * Send each email to the account, in order. A deleted account is sent none:
 * its address is gone, and its plan ending is its deletion's doing. Never
 * throws, like `sendAccountEmail`.
 */
export async function emailAccount(db: AppDatabase, mail: AccountMail | undefined, accountId: number, emails: readonly AccountEmail[]): Promise<Sent[]> {
  if (emails.length === 0) return [];
  let to: string | undefined;
  try {
    to = (await liveAccountEmailQuery(db, accountId))[0]?.email;
  } catch (failure) {
    console.error("account email failed: its address could not be read", { kinds: emails.map((email) => email.kind) }, failure);
    return emails.map(() => "failed");
  }
  if (to === undefined) return [];
  const sent: Sent[] = [];
  for (const email of emails) sent.push(await sendAccountEmail(mail, to, email));
  return sent;
}
