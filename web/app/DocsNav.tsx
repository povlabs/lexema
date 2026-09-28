"use client";

// The docs' sidebar (board 31): a search field over the pages, then the
// pages in their groups (DocsLinks.tsx). On a phone the same list opens from
// the contents bar (board 31m), so it takes the name its place gives it. Typing keeps only the pages whose
// name holds what was typed; ⌘K (Ctrl K) puts the cursor in the field, as it
// does in the dictionary's search bar (searchShortcut.ts). Without a script
// every page shows and the field does nothing.

import { useEffect, useRef, useState } from "react";
import { isApple, isSearchShortcut, shortcutApplies, shortcutLabel } from "./searchShortcut.ts";
import { DocsLinks, type DocsGroup, type DocsLink } from "./DocsLinks";
import { DOCS_SEARCH, DOCS_SEARCH_HINT, DOCS_SEARCH_INPUT } from "./styles.ts";

const matches = (link: DocsLink, query: string) =>
  `${link.method ?? ""} ${link.label}`.toLowerCase().includes(query.trim().toLowerCase());

export function DocsNav({ groups, label }: { groups: readonly DocsGroup[]; label: string }) {
  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<string | undefined>(undefined);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const apple = isApple(navigator.platform);
    setHint(shortcutLabel(apple));
    const onKey = (event: KeyboardEvent) => {
      if (!isSearchShortcut(event, apple)) return;
      const active = document.activeElement;
      const typingElsewhere =
        active !== field.current && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement);
      if (!shortcutApplies({ dialogOpen: false, typingElsewhere })) return;
      event.preventDefault();
      field.current?.focus();
      field.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <nav aria-label={label}>
      <div className={DOCS_SEARCH}>
        <input
          ref={field}
          className={DOCS_SEARCH_INPUT}
          type="search"
          placeholder="Search docs"
          aria-label="Search docs"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {hint !== undefined && query === "" ? (
          <span className={DOCS_SEARCH_HINT} aria-hidden="true">
            {hint}
          </span>
        ) : null}
      </div>
      <DocsLinks
        groups={groups
          .map((group) => ({ ...group, links: group.links.filter((link) => matches(link, query)) }))
          .filter((group) => group.links.length > 0)}
      />
    </nav>
  );
}
