import { findByLemma } from "../../db";

// JSON twin of the page. Lets the proof script assert on real D1 rows
// without parsing HTML.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const rows = q ? await findByLemma(q) : [];
  return Response.json({ q, count: rows.length, rows });
}
