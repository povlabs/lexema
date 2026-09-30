// The dashboard's per-form CSRF token (#168): the one value a dashboard form
// must carry for its action to run. It stays Lexema's under better-auth (ADR
// 0017, #225 R1.5), and better-auth's own Origin check has nothing to do with it.
//
// It is derived from the session cookie's value, the token and better-auth's
// signature of it, so it needs no column, changes with every sign-in, and
// cannot be worked out by anyone who does not hold the cookie: not even from
// the session table, which stores the token but never the signature.
//
// Web Crypto only, so the same code runs in the Worker and under Node's tests.

/** The CSRF token of the session this cookie value carries: 43 base64url characters. */
export async function csrfToken(sessionCookie: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`csrf:${sessionCookie}`)));
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Whether a form's submitted token is this session's CSRF token. */
export async function csrfMatches(sessionCookie: string, submitted: string | undefined): Promise<boolean> {
  return submitted !== undefined && sameString(submitted, await csrfToken(sessionCookie));
}

/** Compare two strings without an early exit, so the time taken says nothing about where they differ. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
