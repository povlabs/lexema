// The `/developers` route: the JSON API's reference (#153).
//
// The wiring only, as `../attribution/page.tsx` is for its page; the markup is
// `../Developers.tsx`. It reads nothing from D1, and a request for it carries
// no `q`, so no per-visitor limit counts it (worker/rateLimit.ts).
import { Developers } from "../Developers";

export const metadata = { title: "API — Lexema" };

export default function Page() {
  return <Developers />;
}
