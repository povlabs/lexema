// What a page render has to be able to show: a lookup, or the fact that the
// lookup did not happen.
//
// Its own module, and types only, so the page's components can be rendered by a
// test in plain Node. `db.ts` reaches the Workers runtime through
// `cloudflare:workers`, which exists only inside workerd; importing this
// instead keeps the rendering half free of it.

import type { Nearby } from "@lexema/lookup/nearby.ts";
import type { FoundResult, NotFoundResult, RejectedResult } from "@lexema/lookup/types.ts";

/**
 * A lookup that reached the database, or the fact that it did not.
 *
 * A search that found nothing carries what the page offers instead
 * (src/lookup/nearby.ts): an accent, a spelling one edit away, the words that
 * begin with it, or nothing.
 *
 * The failure is a value rather than a thrown error so the page has to render
 * it. It carries no detail on purpose: the reason is a database message meant
 * for whoever runs the Worker, and it goes to the log, not to the reader.
 */
export type Attempt =
  | FoundResult
  | RejectedResult
  | (NotFoundResult & { nearby: Nearby })
  | { outcome: "failed" };
