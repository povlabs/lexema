"use client";

// On a phone the docs' sidebar is this bar under the header (board 31m): the
// page's group and name, opening onto the sidebar's search and pages. Base
// UI's collapsible (ADR 0010): the bar is its trigger, which Enter and Space
// toggle, and the list is its panel, in the HTML while closed.

import { Collapsible } from "@base-ui/react/collapsible";
import type { ReactNode } from "react";
import { ChevronIcon } from "@/components/shared/icons";
import { DOCS_CONTENTS, DOCS_CONTENTS_ICON, DOCS_CONTENTS_PAGE, DOCS_CONTENTS_PANEL, DOCS_CONTENTS_TRIGGER } from "@/components/shared/styles.ts";

export function DocsContents({ group, page, children }: { group: string; page: string; children: ReactNode }) {
  return (
    <Collapsible.Root className={DOCS_CONTENTS}>
      <Collapsible.Trigger className={DOCS_CONTENTS_TRIGGER}>
        {group}
        <span aria-hidden="true">/</span>
        <span className={DOCS_CONTENTS_PAGE}>{page}</span>
        <ChevronIcon className={DOCS_CONTENTS_ICON} />
      </Collapsible.Trigger>
      <Collapsible.Panel className={DOCS_CONTENTS_PANEL} keepMounted>
        {children}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
