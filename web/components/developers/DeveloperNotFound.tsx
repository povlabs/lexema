// A developer-site address with no page (#171): the bar and footer every other
// developer page carries, and one plain line in the column. No board draws it,
// so it takes the pricing page's column and heading and nothing more.

import type { SignUp } from "@/worker/developers/signUp.ts";
import type { SiteOrigins } from "@/worker/shared/hosts.ts";
import { DeveloperPage } from "./DeveloperPage";
import type { SignedIn } from "@/lib/developers/signedIn.ts";
import { DEV_HEADING, DEV_SHELL } from "@/components/shared/styles.ts";

export function DeveloperNotFound({ signedIn, signUp, origins }: { signedIn?: SignedIn; signUp: SignUp; origins: SiteOrigins }) {
  return (
    <DeveloperPage signedIn={signedIn} signUp={signUp} origins={origins}>
      <main className={DEV_SHELL}>
        <h1 className={DEV_HEADING}>Page not found</h1>
      </main>
    </DeveloperPage>
  );
}
