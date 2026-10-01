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
import { log } from "../log/requestLog.js";
import { composeEmail, type AccountEmail, type EmailLinks } from "./accountEmail.js";

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

/**
 * The Worker's `EMAIL` binding as account email sends through it. Where
 * `onlyTo` names an address, every message goes there, whoever it is about:
 * that is a Preview, whose binding's `destination_address` allows Huey's
 * verified address alone (web/wrangler.jsonc, `EMAIL_ONLY_TO`). A Preview's
 * one account is the test developer, on `example.com`, so without this its
 * deletion email would be refused instead of reaching him. Empty or absent, as
 * in local development and production, each message goes to its account.
 */
export function workerEmailOf(binding: EmailBinding | undefined, onlyTo: string | undefined): EmailBinding | undefined {
  if (binding === undefined || onlyTo === undefined || onlyTo === "") return binding;
  return { send: (message) => binding.send({ ...message, to: onlyTo }) };
}

/** Where account emails go out, and the URLs they carry. */
export interface AccountMail {
  readonly binding: EmailBinding;
  readonly links: EmailLinks;
}

/** The path of the dashboard's settings page on the developer site (web/lib/developers/dashboardActions.ts). */
const SETTINGS_PATH = "/dashboard/settings";

/**
 * The site icon the header shows: the 192px one, drawn at 32px so it stays
 * sharp on a dense screen. It is a static asset of the web app
 * (web/lib/shared/siteIcons.ts, `ICON_PATH.icon192`), served on every host.
 */
export const EMAIL_ICON_PATH = "/icon-192.png";

/** The sites an email's links point at, as the request that sends it names them. */
export interface MailOrigins {
  /** The developer site, where settings is: the host the request came to. */
  readonly developers: string;
  /** The dictionary's site, which serves the icon: https://lexema.fyi live, a Preview's own on a Preview. */
  readonly lexema: string;
}

/** Account email over this binding, linking to settings and the icon on `origins`; `undefined` while the Worker has no binding. */
export const accountMailOf = (binding: EmailBinding | undefined, origins: MailOrigins): AccountMail | undefined =>
  binding === undefined
    ? undefined
    : { binding, links: { settings: `${origins.developers}${SETTINGS_PATH}`, icon: `${origins.lexema}${EMAIL_ICON_PATH}` } };

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
    log.info("account email not sent: no EMAIL binding", { kind: email.kind });
    return "mail-off";
  }
  try {
    await mail.binding.send({ to, from: SENDER, ...composeEmail(email, mail.links) });
    return "sent";
  } catch (failure) {
    log.error("account email failed", { kind: email.kind, code: codeOf(failure) }, failure);
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
    log.error("account email failed: its address could not be read", { kinds: emails.map((email) => email.kind) }, failure);
    return emails.map(() => "failed");
  }
  if (to === undefined) return [];
  const sent: Sent[] = [];
  for (const email of emails) sent.push(await sendAccountEmail(mail, to, email));
  return sent;
}
