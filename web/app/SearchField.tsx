"use client";

// The search field, and the list of suggestions that opens under it as a
// reader types (#15).
//
// The one client component on the search page. Everything else is decided by
// the URL on the server; this part cannot be, because it answers keystrokes.
// It is still a plain field in a plain GET form: the server renders the same
// `<input name="q">`, so the page searches before any JavaScript arrives, and
// what the script adds is the list.
//
// The form sits inside the Autocomplete root rather than around it, on
// purpose. The root always renders a second, visually hidden `<input>` after
// its children, and it has no `type`, so it is a text field. A form with two
// text fields and no submit button is one Enter cannot submit (the HTML
// standard's implicit submission rule), which silently broke Enter with no
// suggestion highlighted, with or without JavaScript. Inside the root, the
// form holds the one field and that input falls outside it.
//
// Base UI's Autocomplete owns the combobox: the ARIA roles and states, focus
// staying in the input while arrow keys move a highlight through the list,
// Enter on a highlighted row choosing it, Enter with nothing highlighted
// submitting the form as typed, and Escape closing the list. What this file
// owns is where the suggestions come from and when.

import { Autocomplete } from "@base-ui/react/autocomplete";
import { useEffect, useRef, useState } from "react";
import { isAskablePrefix } from "@lexema/lookup/suggest.ts";
import { SearchIcon } from "./icons";
import type { SuggestAnswer } from "./suggestAnswer.ts";
import {
  SEARCH_CLEAR,
  SEARCH_FIELD,
  SEARCH_FORM,
  SEARCH_HINT,
  SEARCH_ICON,
  SEARCH_INPUT,
  SUGGEST_ITEM,
  SUGGEST_ITEM_HINT,
  SUGGEST_LIST,
  SUGGEST_NOTE,
  SUGGEST_POPUP,
} from "./styles.ts";

/**
 * How long the field waits after a keystroke before asking. Shorter than the
 * gap between keys of someone typing a word in one go, so a word typed
 * steadily asks once rather than once a letter; short enough that the list
 * follows a pause without seeming to lag behind it.
 */
export const DEBOUNCE_MS = 150;

/** What the list is showing: suggestions for some prefix, or that none could be read. */
type Shown = { kind: "suggested"; suggestions: string[] } | { kind: "failed" };

/**
 * What a screen reader is told when the list changes. Base UI's `Status` is a
 * polite live region; it stays mounted outside the popup so the announcement
 * is not lost when the popup itself mounts.
 */
function statusOf(shown: Shown | null): string {
  if (shown === null) return "";
  if (shown.kind === "failed") return "Suggestions could not be loaded.";
  const count = shown.suggestions.length;
  if (count === 0) return "No suggestions.";
  return `${count} suggestion${count === 1 ? "" : "s"}. Use the up and down arrows to choose one.`;
}

/**
 * The one search field: a magnifier at the left, and at the right either a
 * `×` that clears a query or, before one, the `ENTER` hint. No label above it
 * and no button beside it — Enter submits — and its accessible name is on the
 * input itself, so a screen reader still hears what it is for.
 */
export function SearchField({ raw }: { raw: string }) {
  const asked = raw.trim() !== "";
  const [value, setValue] = useState(raw);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const field = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The one request whose answer may still be shown. A newer keystroke aborts
  // it, so an answer for `ca` that arrives after the reader typed `cas` is
  // dropped rather than drawn over the list for `cas`.
  const inFlight = useRef<AbortController | null>(null);

  const cancel = () => {
    clearTimeout(timer.current);
    inFlight.current?.abort();
    inFlight.current = null;
  };
  useEffect(() => cancel, []);

  const ask = (prefix: string) => {
    cancel();
    if (!isAskablePrefix(prefix)) {
      setShown(null);
      return;
    }
    const request = new AbortController();
    inFlight.current = request;
    timer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/suggest?q=${encodeURIComponent(prefix)}`, { signal: request.signal });
        const answer = (await response.json()) as SuggestAnswer;
        if (request.signal.aborted) return;
        setShown(
          answer.outcome === "suggested"
            ? { kind: "suggested", suggestions: answer.suggestions }
            : answer.outcome === "failed"
              ? { kind: "failed" }
              : null,
        );
      } catch {
        if (request.signal.aborted) return;
        setShown({ kind: "failed" });
      }
    }, DEBOUNCE_MS);
  };

  const suggestions = shown?.kind === "suggested" ? shown.suggestions : [];

  return (
    <Autocomplete.Root
      name="q"
      value={value}
      onValueChange={(next, details) => {
        setValue(next);
        // Choosing a suggestion writes it into the field and submits the form,
        // which opens that word's page; there is nothing left to suggest.
        if (details.reason === "item-press") {
          cancel();
          return;
        }
        ask(next);
      }}
      items={suggestions}
      // The server already ordered and bounded the list; filtering it again on
      // the client would drop spellings the prefix matches only after the
      // normalization the server applied.
      filter={null}
      open={open && shown !== null}
      onOpenChange={setOpen}
      submitOnItemClick
    >
      <form className={SEARCH_FORM} action="/" method="get" role="search">
        <Autocomplete.InputGroup ref={field} className={SEARCH_FIELD}>
          <SearchIcon className={SEARCH_ICON} />
          <Autocomplete.Input
            className={SEARCH_INPUT}
            id="q"
            type="search"
            aria-label="Search an Italian word"
            placeholder="Search an Italian word"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            lang="it"
            autoFocus={!asked}
            enterKeyHint="search"
          />
          {asked ? (
            <a className={SEARCH_CLEAR} href="/" aria-label="Clear search">
              ×
            </a>
          ) : (
            <kbd className={SEARCH_HINT} aria-hidden="true">
              ENTER
            </kbd>
          )}
        </Autocomplete.InputGroup>
      </form>
      <Autocomplete.Status className="sr-only">{statusOf(shown)}</Autocomplete.Status>
      <Autocomplete.Portal>
        <Autocomplete.Positioner anchor={field} side="bottom" align="start" sideOffset={6}>
          <Autocomplete.Popup className={SUGGEST_POPUP}>
            <Autocomplete.Empty>
              {shown !== null && (
                <p className={SUGGEST_NOTE}>
                  {shown.kind === "failed"
                    ? "Suggestions could not be loaded. Enter still searches."
                    : "No suggestions. Enter still searches."}
                </p>
              )}
            </Autocomplete.Empty>
            <Autocomplete.List className={SUGGEST_LIST}>
              {(suggestion: string) => (
                <Autocomplete.Item key={suggestion} value={suggestion} className={SUGGEST_ITEM}>
                  <span lang="it">{suggestion}</span>
                  <span className={SUGGEST_ITEM_HINT} aria-hidden="true">
                    ENTER
                  </span>
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
