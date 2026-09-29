// The `/attribution` route: the full credit ADR 0009 keeps off the search page.
//
// This file is the wiring, exactly as `../page.tsx` is for the search page: it
// hands where Lexema's data came from to the markup in
// `@/components/dictionary/Attribution.tsx`.
// That is read from the repository's record of the published archive, not from
// D1, so the page always shows it.
import { PUBLISHED_ARCHIVE_SHA256, sourceOf } from "@lexema/source/archiveFacts.ts";
import { Attribution } from "@/components/dictionary/Attribution";

export const metadata = { title: "Sources and licences — Lexema" };

export default function Page() {
  return <Attribution source={sourceOf(PUBLISHED_ARCHIVE_SHA256)} />;
}
