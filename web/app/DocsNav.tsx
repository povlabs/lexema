"use client";

// The docs' sidebar (board 31): a search field over the topics, then the
// topics in their groups. Typing keeps only the topics whose name holds what
// was typed; ⌘K (Ctrl K) puts the cursor in the field, as it does in the
// dictionary's search bar (searchShortcut.ts). Without a script every topic
// shows and the field does nothing.

import { useEffect, useRef, useState } from "react";
import { isApple, isSearchShortcut, shortcutApplies, shortcutLabel } from "./searchShortcut.ts";
import {
  DOCS_NAV_ENDPOINT,
  DOCS_NAV_GROUP,
  DOCS_NAV_LABEL,
  DOCS_NAV_LINK,
  DOCS_NAV_LIST,
  DOCS_NAV_METHOD,
  DOCS_SEARCH,
  DOCS_SEARCH_HINT,
  DOCS_SEARCH_INPUT,
} from "./styles.ts";

export interface DocsTopic {
  id: string;
  label: string;
  /** An endpoint's method, drawn before its name. */
  method?: string;
}

export interface DocsGroup {
  label: string;
  topics: readonly DocsTopic[];
}

const matches = (topic: DocsTopic, query: string) =>
  `${topic.method ?? ""} ${topic.label}`.toLowerCase().includes(query.trim().toLowerCase());

export function DocsNav({ groups }: { groups: readonly DocsGroup[] }) {
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
    <nav aria-label="Docs">
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
      {groups.map((group) => {
        const topics = group.topics.filter((topic) => matches(topic, query));
        if (topics.length === 0) return null;
        return (
          <div key={group.label} className={DOCS_NAV_GROUP}>
            <h2 className={DOCS_NAV_LABEL}>{group.label}</h2>
            <ul className={DOCS_NAV_LIST}>
              {topics.map((topic) => (
                <li key={topic.id}>
                  <a className={DOCS_NAV_LINK} href={`#${topic.id}`}>
                    {topic.method === undefined ? (
                      topic.label
                    ) : (
                      <>
                        <span className={DOCS_NAV_METHOD}>{topic.method}</span>
                        <span className={DOCS_NAV_ENDPOINT}>{topic.label}</span>
                      </>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
