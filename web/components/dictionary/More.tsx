"use client";

// The one expand control on a result (design-system-manifest.md § "Layout"):
// a small accent `+ more` right after what shows, and, once open, `less` at the
// very end of everything. No count.
//
// Base UI's Collapsible supplies the behaviour (ADR 0010): the control is its
// trigger, a button that Enter and Space toggle and that says whether it is
// open. The block around what it reveals is the collapsible's root, which
// carries `data-open` while open; the parts that wait for `+ more` are hidden by
// class until then, so the whole content is in the HTML the server sends. The
// control sits after all of them, so closed, with the rest hidden, it follows
// the last thing that shows; open, it follows the last thing of all.
//
// Callers name where each part sits by a key, and the classes are read here
// (styles.ts, `MORE_BLOCK` and `MORE_PLACE`), so no class string is carried in
// the page's inline payload (#647).

import { Collapsible } from "@base-ui/react/collapsible";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  COMPOUND_TABLES,
  MORE_BLOCK,
  MORE_CLOSED,
  MORE_OPEN,
  MORE_PLACE,
  MORE_TRIGGER,
  type MoreBlockKind,
  type MorePlace,
} from "@/components/shared/styles.ts";

/** The block the control opens. `open` starts it open, as when the search hit something it reveals. */
export function MoreBlock({ kind, open, children }: { kind: Exclude<MoreBlockKind, "mood">; open?: boolean; children: ReactNode }) {
  return (
    <Collapsible.Root className={MORE_BLOCK[kind]} defaultOpen={open}>
      {children}
    </Collapsible.Root>
  );
}

interface SharedOpen {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const MoodsOpen = createContext<SharedOpen | undefined>(undefined);

/**
 * One open state for a conjugation's compound tenses, shared by every mood
 * tab: `+ more` on one tab opens them on all, and `less` on any closes them on
 * all (#683). `open` starts it open, as when the search hit a compound form.
 */
export function MoodsMore({ open, children }: { open: boolean; children: ReactNode }) {
  const [shown, setShown] = useState(open);
  const value = useMemo(() => ({ open: shown, setOpen: setShown }), [shown]);
  return <MoodsOpen.Provider value={value}>{children}</MoodsOpen.Provider>;
}

/** A mood's block the control opens, open exactly when its conjugation's `MoodsMore` is. */
export function MoodMoreBlock({ children }: { children: ReactNode }) {
  const shared = useContext(MoodsOpen);
  if (shared === undefined) throw new Error("MoodMoreBlock sits outside a MoodsMore");
  return (
    <Collapsible.Root className={MORE_BLOCK.mood} open={shared.open} onOpenChange={shared.setOpen}>
      {children}
    </Collapsible.Root>
  );
}

/** A mood's compound tenses, which wait for `+ more` as one run: Base UI's panel, in the HTML while closed. */
export function MorePanel({ children }: { children: ReactNode }) {
  return (
    <Collapsible.Panel className={COMPOUND_TABLES} keepMounted>
      {children}
    </Collapsible.Panel>
  );
}

/**
 * The control, placed by `place`. Where what it reveals is spread through the
 * block rather than one panel, `controls` names the element it opens.
 */
export function More({ place, controls }: { place: MorePlace; controls?: string }) {
  return (
    <div className={MORE_PLACE[place]}>
      <Collapsible.Trigger className={MORE_TRIGGER} aria-controls={controls}>
        <span className={MORE_CLOSED}>+ more</span>
        <span className={MORE_OPEN}>less</span>
      </Collapsible.Trigger>
    </div>
  );
}
