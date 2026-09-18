import { env } from "cloudflare:workers";
import { findByLemma } from "../../db";

// JSON twin of the page. Lets the proof script assert on real D1 rows
// without parsing HTML.
//
// The response echoes SPIKE_PROOF_RUN, a uuid `proof.sh` mints per run and
// passes with `--var`. Without it the proof could pass against a Worker left
// over from an earlier run: curl only proves *something* answers the port.
// Echoing the token proves *this* build answered.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const rows = q ? await findByLemma(q) : [];
  return Response.json(
    { q, count: rows.length, rows },
    { headers: { "x-spike-proof-run": env.SPIKE_PROOF_RUN ?? "unset" } },
  );
}
