// The `/licence` route: the full credit ADR 0009 keeps off the search page (#139).
//
// The wiring, as `../page.tsx` is for the search page: it hands the markup in
// `@/components/dictionary/Licence.tsx` the release the dictionary serves. That
// release is read from the change declarations when the site is built
// (web/vite.config.ts, src/update/readServedRelease.ts), not from D1, so the
// page always shows it and follows each new release with no edit here.
import type { ServedRelease } from "@lexema/source/servedRelease.ts";
import { Licence } from "@/components/dictionary/Licence";

/** Put in place by Vite's `define` at build time. */
declare const __LEXEMA_SERVED_RELEASE__: ServedRelease;

export const metadata = { title: "Licence — Lexema" };

export default function Page() {
  return <Licence release={__LEXEMA_SERVED_RELEASE__} />;
}
