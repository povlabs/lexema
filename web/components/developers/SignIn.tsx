// developers.lexema.fyi/sign-in (#169, board 27): Google and GitHub, nothing
// else. A provider whose client id and secret are not both set is a disabled
// button, so the page never offers a sign-in that answers 503. On a Preview's
// developer host, one more button signs in as the test developer (#245,
// worker/developers/testSignIn.ts); nowhere else does the page show it. The
// card ends on board 27's Terms line, linking the Terms of service (#162). The
// page's wiring, which reads the session and the providers, is
// `(developers)/developer-site/sign-in/page.tsx`.
//
// While sign-up is closed (#610, worker/developers/signUp.ts), the same card
// says sign-up opens soon and offers no provider. A Preview's test sign-in
// stays under it, with the Terms line, since it makes no account of its own.

import { Button } from "@base-ui/react/button";
import { PROVIDER_IDS, PROVIDER_NAME, type ProviderId } from "@lexema/accounts/providers.ts";
import type { SiteOrigins } from "@/worker/shared/hosts.ts";
import type { SignUp } from "@/worker/developers/signUp.ts";
import { TEST_SIGN_IN } from "@/worker/developers/testSignIn.ts";
import { DeveloperPage, TERMS_PATH } from "./DeveloperPage";
import { GitHubIcon } from "@/components/shared/icons";
import {
  SIGN_IN_CARD,
  SIGN_IN_G,
  SIGN_IN_HEADING,
  SIGN_IN_ICON,
  SIGN_IN_LEAD,
  SIGN_IN_PROVIDER,
  SIGN_IN_PROVIDERS,
  SIGN_IN_SHELL,
  SIGN_IN_TERMS,
  LINK,
} from "@/components/shared/styles.ts";

/** Where a provider's sign-in starts (worker/developers/signIn.ts). */
export const signInStart = (provider: ProviderId): string => `/sign-in/${provider}`;

/** What the card offers while sign-up is open or closed: its heading, its lead and its providers. */
const CARD: Readonly<Record<SignUp, { heading: string; lead: string; providers: readonly ProviderId[] }>> = {
  open: { heading: "Sign in", lead: "to create and manage your API keys", providers: PROVIDER_IDS },
  closed: { heading: "Sign-up opens soon", lead: "API keys are not available yet. The docs and pricing are open to read.", providers: [] },
};

function ProviderMark({ provider }: { provider: ProviderId }) {
  switch (provider) {
    case "google":
      return (
        <span className={SIGN_IN_G} aria-hidden="true">
          G
        </span>
      );
    case "github":
      return <GitHubIcon className={SIGN_IN_ICON} />;
  }
}

function ProviderButton({ provider, available }: { provider: ProviderId; available: boolean }) {
  return available ? (
    <a className={SIGN_IN_PROVIDER} href={signInStart(provider)}>
      <ProviderMark provider={provider} />
      Continue with {PROVIDER_NAME[provider]}
    </a>
  ) : (
    <button className={SIGN_IN_PROVIDER} type="button" disabled>
      <ProviderMark provider={provider} />
      Continue with {PROVIDER_NAME[provider]}
    </button>
  );
}

export function SignIn({
  available,
  testSignIn = false,
  signUp,
  origins,
}: {
  available: Readonly<Record<ProviderId, boolean>>;
  /** Whether this is a Preview's developer host, where the test developer can sign in. */
  testSignIn?: boolean;
  /** Closed, the card offers no provider. */
  signUp: SignUp;
  origins: SiteOrigins;
}) {
  const { heading, lead, providers } = CARD[signUp];
  return (
    <DeveloperPage signUp={signUp} origins={origins}>
      <main className={SIGN_IN_SHELL}>
        <div className={SIGN_IN_CARD}>
          <h1 className={SIGN_IN_HEADING}>{heading}</h1>
          <p className={SIGN_IN_LEAD}>{lead}</p>
          {providers.length > 0 || testSignIn ? (
            <>
              <ul className={SIGN_IN_PROVIDERS}>
                {providers.map((provider) => (
                  <li key={provider}>
                    <ProviderButton provider={provider} available={available[provider]} />
                  </li>
                ))}
                {testSignIn ? (
                  <li>
                    <form method="post" action={TEST_SIGN_IN}>
                      <Button className={SIGN_IN_PROVIDER} type="submit">
                        Sign in as test developer
                      </Button>
                    </form>
                  </li>
                ) : null}
              </ul>
              <p className={SIGN_IN_TERMS}>
                By continuing you agree to the{" "}
                <a className={LINK} href={TERMS_PATH}>
                  Terms
                </a>
                .
              </p>
            </>
          ) : null}
        </div>
      </main>
    </DeveloperPage>
  );
}
