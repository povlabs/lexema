"use client";

import { useEffect, useState } from "react";

// Only here to prove client components hydrate on the Workers runtime.
// A real search box needs this. data-hydrated flips to "yes" once the effect
// runs, so a headless DOM dump can tell hydration from plain server HTML.
export function Counter() {
  const [n, setN] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  return (
    <button
      type="button"
      data-testid="counter"
      data-hydrated={hydrated ? "yes" : "no"}
      onClick={() => setN(n + 1)}
    >
      client island clicked {n}x
    </button>
  );
}
