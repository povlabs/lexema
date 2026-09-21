// The `/attribution` route: the full credit ADR 0009 keeps off the search page.
//
// This file is the wiring, exactly as `../page.tsx` is for the search page: it
// reads the serving release from D1 and hands it to the markup, which lives in
// `../Attribution.tsx` and knows nothing about D1.

import { Attribution } from "../Attribution";
import { release } from "../db";

export const metadata = { title: "Sources and licences — Lexema" };

export default async function Page() {
  return <Attribution release={await release()} />;
}
