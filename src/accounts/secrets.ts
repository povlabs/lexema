// Random tokens and their digests, for sign-in (#165).
//
// Web Crypto only, so the same code runs in the Worker and under Node's tests.

/** 32 random bytes as base64url: 43 characters, no padding. */
export function randomToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/** A token as `randomToken` writes it; anything else is not one of ours. */
export const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** SHA-256 of a string, as 64 hex digits. */
export async function sha256Hex(value: string): Promise<string> {
  return [...(await sha256(value))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 of a string, as base64url: PKCE's S256 challenge (RFC 7636 §4.2). */
export async function sha256Base64Url(value: string): Promise<string> {
  return base64Url(await sha256(value));
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Compare two strings without an early exit, so the time taken says nothing about where they differ. */
export function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
