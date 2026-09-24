// The `/attribution` route: the full credit ADR 0009 keeps off the search page.
//
// This file is the wiring, exactly as `../page.tsx` is for the search page: it
// names the release the site serves and hands where it came from to the markup
// in `../Attribution.tsx`. That comes from the repository's own record of the
// archive, not from D1, so the page shows it whether or not D1 is attached.
import { env } from "cloudflare:workers";
import { releaseSource } from "@lexema/source/archiveFacts.ts";
import { Attribution } from "../Attribution";

export const metadata = { title: "Sources and licences — Lexema" };

export default function Page() {
  return <Attribution source={releaseSource(env.LEXEMA_RELEASE)} />;
}
