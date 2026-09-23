"use client";

// Expand all, over a set of folding groups (frame 08, #101).
//
// Each group is a native `<details>` the server renders, so on a phone a group
// opens and closes with no script, and the one holding the searched form is
// open in the HTML the server sends. What cannot work without a script is one
// control opening every group at once: setting `open` on many elements is a
// script's job. So the button is rendered hidden and shown once this component
// has hydrated; before then, and with no script at all, each group still opens
// on its own.
//
// On a wide screen every group is drawn open by `::details-content` in
// `styles.ts`, whatever its `open` state. A browser too old to know that
// pseudo-element would leave closed groups closed with no row to tap, so there
// this opens them all instead.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronIcon } from "./icons";
import { FOLD_ALL, FOLD_ALL_CHEVRON, FOLD_ALL_CHEVRON_OPEN, FOLD_BAR, FOLD_BAR_COUNT } from "./styles.ts";

/** Tailwind's `sm` breakpoint, where a set of groups stops folding. */
const WIDE = "(min-width: 40rem)";

export function Folds({ groups, children }: { groups: number; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [allOpen, setAllOpen] = useState(false);

  const folds = (): HTMLDetailsElement[] => [...(root.current?.querySelectorAll<HTMLDetailsElement>("details[data-fold]") ?? [])];

  useEffect(() => {
    const element = root.current;
    if (element === null) return;
    if (!CSS.supports("selector(::details-content)") && matchMedia(WIDE).matches) {
      for (const fold of folds()) fold.open = true;
    }
    // `toggle` does not bubble, so it is heard on the way down instead.
    const sync = () => setAllOpen(folds().every((fold) => fold.open));
    sync();
    setReady(true);
    element.addEventListener("toggle", sync, true);
    return () => element.removeEventListener("toggle", sync, true);
  }, []);

  const toggleAll = () => {
    for (const fold of folds()) fold.open = !allOpen;
  };

  return (
    <>
      <div className={FOLD_BAR}>
        <span className={FOLD_BAR_COUNT}>{groups} groups</span>
        <button type="button" className={FOLD_ALL} hidden={!ready} onClick={toggleAll}>
          {allOpen ? "Collapse all" : "Expand all"}
          <ChevronIcon className={allOpen ? FOLD_ALL_CHEVRON_OPEN : FOLD_ALL_CHEVRON} />
        </button>
      </div>
      <div ref={root}>{children}</div>
    </>
  );
}
