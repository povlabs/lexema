// developers.lexema.fyi/sign-in (#169, board 27): Google and GitHub, nothing
// else. A provider whose client id and secret are not both set is a disabled
// button, so the page never offers a sign-in that answers 503. No Terms line
// until the terms exist (#162, #163 R1.7). The page's wiring, which reads the
// session and the providers, is `(developers)/developer-site/sign-in/page.tsx`.

import { PROVIDER_IDS, PROVIDER_NAME, type ProviderId } from "@lexema/accounts/providers.ts";
import { DeveloperPage } from "./DeveloperPage";
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
} from "@/components/shared/styles.ts";

/** Where a provider's sign-in starts (worker/signIn.ts). */
export const signInStart = (provider: ProviderId): string => `/sign-in/${provider}`;

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

export function SignIn({ available }: { available: Readonly<Record<ProviderId, boolean>> }) {
  return (
    <DeveloperPage>
      <main className={SIGN_IN_SHELL}>
        <div className={SIGN_IN_CARD}>
          <h1 className={SIGN_IN_HEADING}>Sign in</h1>
          <p className={SIGN_IN_LEAD}>to create and manage your API keys</p>
          <ul className={SIGN_IN_PROVIDERS}>
            {PROVIDER_IDS.map((provider) => (
              <li key={provider}>
                {available[provider] ? (
                  <a className={SIGN_IN_PROVIDER} href={signInStart(provider)}>
                    <ProviderMark provider={provider} />
                    Continue with {PROVIDER_NAME[provider]}
                  </a>
                ) : (
                  <button className={SIGN_IN_PROVIDER} type="button" disabled>
                    <ProviderMark provider={provider} />
                    Continue with {PROVIDER_NAME[provider]}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </DeveloperPage>
  );
}
