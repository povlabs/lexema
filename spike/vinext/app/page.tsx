import { Counter } from "./Counter";
import { findByLemma } from "./db";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: Props) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  return { title: q ? `${q} — Lexema spike` : "Lexema spike" };
}

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const raw = params.q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  const rows = q ? await findByLemma(q) : [];

  return (
    <main>
      <h1>Lexema vinext spike</h1>
      <p>
        Throwaway. Fake seed data, throwaway table, no real schema. Proves only
        that a server component on the Workers runtime can query D1.
      </p>

      <p><Counter /></p>

      <form method="get" action="/">
        <label htmlFor="q">Italian word</label>{" "}
        <input id="q" name="q" defaultValue={q} placeholder="casa" />{" "}
        <button type="submit">Search</button>
      </form>

      {q === "" ? (
        <p data-testid="state">Type a word. Try casa, gatto, perché.</p>
      ) : rows.length === 0 ? (
        <p data-testid="state">No rows in D1 for &quot;{q}&quot;.</p>
      ) : (
        <>
          <p data-testid="state">
            {rows.length} row(s) from D1 for &quot;{q}&quot;.
          </p>
          <ul data-testid="results">
            {rows.map((row) => (
              <li key={row.id} data-row-id={row.id}>
                <strong>{row.lemma}</strong> <em>({row.pos})</em> — {row.gloss}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
