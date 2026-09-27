"use client";

// The mood tabs over a conjugation: Indicativo, Congiuntivo, Condizionale,
// Imperativo. Base UI supplies the tab behaviour (ADR 0010); the server
// decides which mood opens — the searched form's, else the first — and every
// panel stays mounted, so every form is in the HTML the server sends.

import { Tabs } from "@base-ui/react/tabs";
import type { ReactNode } from "react";
import { TAB, TAB_LIST, TAB_PANEL, TABS } from "./styles.ts";

export interface MoodPanel {
  mood: string;
  panel: ReactNode;
}

export function MoodTabs({ label, open, panels }: { label: string; open: string; panels: MoodPanel[] }) {
  return (
    <Tabs.Root className={TABS} defaultValue={open}>
      <Tabs.List className={TAB_LIST} aria-label={label}>
        {panels.map(({ mood }) => (
          <Tabs.Tab key={mood} className={TAB} value={mood} lang="it">
            {mood}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {panels.map(({ mood, panel }) => (
        <Tabs.Panel key={mood} className={TAB_PANEL} value={mood} keepMounted data-mood={mood}>
          {panel}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
