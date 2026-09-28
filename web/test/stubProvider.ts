// A sign-in provider for tests (#165): it plays Google or GitHub without a
// network, and checks what the real ones check. A code is issued for one
// challenge and one redirect URI, is redeemed once, and only with the verifier
// whose S256 digest is that challenge (RFC 7636 §4.6).

import { createHash } from "node:crypto";
import type { AuthorizationRequest, CodeGrant, Exchange, OAuthProvider, ProviderId, ProviderProfile } from "../../src/accounts/providers.js";

interface Issued {
  challenge: string;
  redirectUri: string;
  profile: ProviderProfile;
}

export class StubProvider implements OAuthProvider {
  private readonly issued = new Map<string, Issued>();
  private next = 0;

  constructor(readonly id: ProviderId) {}

  authorizationUrl({ state, codeChallenge, redirectUri }: AuthorizationRequest): URL {
    const url = new URL(`https://${this.id}.stub.test/authorize`);
    url.search = new URLSearchParams({
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      redirect_uri: redirectUri,
    }).toString();
    return url;
  }

  /** The person consents at `location`: the callback URL the provider sends them to. */
  consent(location: string, profile: ProviderProfile): URL {
    const at = new URL(location);
    const code = `code-${this.id}-${++this.next}`;
    const redirectUri = at.searchParams.get("redirect_uri") ?? "";
    this.issued.set(code, { challenge: at.searchParams.get("code_challenge") ?? "", redirectUri, profile });
    const callback = new URL(redirectUri);
    callback.search = new URLSearchParams({ code, state: at.searchParams.get("state") ?? "" }).toString();
    return callback;
  }

  async exchange({ code, codeVerifier, redirectUri }: CodeGrant): Promise<Exchange> {
    const issued = this.issued.get(code);
    this.issued.delete(code);
    const challenge = createHash("sha256").update(codeVerifier).digest("base64url");
    if (issued === undefined || issued.redirectUri !== redirectUri || issued.challenge !== challenge) {
      return { outcome: "refused" };
    }
    return { outcome: "profile", profile: issued.profile };
  }
}
