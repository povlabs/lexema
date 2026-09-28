// Developer sessions (#165): which account a browser is signed in to.
//
// The browser holds a random token; the table holds only its SHA-256, so a
// read of the table signs nobody in. A session lasts `SESSION_LIFETIME_MS`
// and ends early when its developer signs out.

import type { LookupDatabase } from "../lookup/database.js";
import { randomToken, sha256Hex, TOKEN_SHAPE } from "./secrets.js";

/** How long a sign-in lasts: 30 days. */
export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export const INSERT_SESSION_SQL = `INSERT INTO developer_session (session_hash, account_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`;
export const SWEEP_SESSIONS_SQL = `DELETE FROM developer_session WHERE expires_at <= ?`;
export const SESSION_ACCOUNT_SQL = `SELECT account_id FROM developer_session
       WHERE session_hash = ? AND expires_at > ?`;
export const DELETE_SESSION_SQL = `DELETE FROM developer_session WHERE session_hash = ?`;

/** A new session: the token for the browser, once, and when it expires. */
export interface NewSession {
  token: string;
  expiresAt: number;
}

/** Start a session for an account, sweeping the ones that have expired. */
export async function createSession(db: LookupDatabase, accountId: number, now: number): Promise<NewSession> {
  await db.all(SWEEP_SESSIONS_SQL, [new Date(now).toISOString()]);
  const token = randomToken();
  const expiresAt = now + SESSION_LIFETIME_MS;
  await db.all(INSERT_SESSION_SQL, [
    await sha256Hex(token),
    accountId,
    new Date(now).toISOString(),
    new Date(expiresAt).toISOString(),
  ]);
  return { token, expiresAt };
}

/** The account a live session's token belongs to, or `undefined`. */
export async function sessionAccount(db: LookupDatabase, token: string | undefined, now: number): Promise<number | undefined> {
  if (token === undefined || !TOKEN_SHAPE.test(token)) return undefined;
  const [row] = await db.all<{ account_id: number }>(SESSION_ACCOUNT_SQL, [await sha256Hex(token), new Date(now).toISOString()]);
  return row?.account_id;
}

/** End the session this token names, if there is one. */
export async function endSession(db: LookupDatabase, token: string | undefined): Promise<void> {
  if (token === undefined || !TOKEN_SHAPE.test(token)) return;
  await db.all(DELETE_SESSION_SQL, [await sha256Hex(token)]);
}
