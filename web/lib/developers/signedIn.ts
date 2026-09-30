// Who a signed-in page is for, as the bar and the account menu name them
// (#169, #190): the account's name when a provider gave one, and its email.
// Pure, so the browser loads it and the tests read it without a page.

import type { AccountProfile } from "@lexema/accounts/accounts.ts";

/** The person a signed-in page is for. */
export interface SignedIn {
  readonly email: string;
  /** The name a provider gave them, or `undefined` when none did: the menu then shows the email alone. */
  readonly name: string | undefined;
}

/** A signed-in visitor on a page whose forms post (pricing, #208): who they are, and their session's CSRF token. */
export interface PostingVisitor {
  readonly signedIn: SignedIn;
  readonly csrf: string;
}

/** Who an account's profile names. */
export const signedInOf = (profile: AccountProfile): SignedIn => ({ email: profile.email, name: profile.name });

/** The letter on the avatar (board 28h): the name's first, else the email's, as a capital. */
export function avatarInitial(who: SignedIn): string {
  const [first = ""] = who.name ?? who.email;
  return first.toLocaleUpperCase("en");
}
