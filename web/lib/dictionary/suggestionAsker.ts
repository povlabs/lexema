// When the search field asks `GET /suggest`, and when it answers itself
// (#387). Apart from the field, so the requests a reader's typing sends can be
// counted without a browser.
//
// Four things keep requests down: a prefix the server would refuse is never
// sent; a keystroke waits `debounceMs` for the next one; a newer keystroke
// aborts the older request; and a prefix that extends one whose whole answer
// is already here is answered from that answer, as the server would answer it
// (`CompleteSuggestions` in src/lookup/suggest.ts). The browser's cache of
// `/suggest` answers (its route) is a fifth, outside this file.

import { CompleteSuggestions, isAskablePrefix } from "@lexema/lookup/suggest.ts";
import type { SuggestAnswer } from "@/lib/dictionary/suggestAnswer.ts";

/** One request for a prefix's suggestions. */
export type SuggestRequest = (prefix: string, signal: AbortSignal) => Promise<SuggestAnswer>;

/**
 * `/suggest?q=ca&v=it-0c432803.0`: a prefix's suggestions, as the served
 * version `version` answers them. The route reads only `q`; `v` is there so a
 * browser keeps each version's answers apart (#368).
 */
export const suggestPath = (prefix: string, version: string): string =>
  `/suggest?${new URLSearchParams({ q: prefix, v: version })}`;

/** `GET /suggest`, as a page of the served version `version` sends it. */
export const suggestionsAt =
  (version: string): SuggestRequest =>
  async (prefix, signal) => {
    const response = await fetch(suggestPath(prefix, version), { signal });
    return (await response.json()) as SuggestAnswer;
  };

export class SuggestionAsker {
  private timer: ReturnType<typeof setTimeout> | undefined;
  /**
   * The one request whose answer may still be shown. A newer keystroke aborts
   * it, so an answer for `ca` that arrives after the reader typed `cas` is
   * dropped rather than drawn over the list for `cas`.
   */
  private inFlight: AbortController | null = null;
  /**
   * The last suggestions the server gave, when they were every suggestion for
   * their prefix. A refusal or a failure leaves it as it was: it still holds.
   */
  private complete: CompleteSuggestions | undefined;

  /**
   * @param answer told what to show for the latest prefix: an answer, or
   *   `null` for a prefix too short or too long to ask about.
   */
  constructor(
    private readonly request: SuggestRequest,
    private readonly answer: (answer: SuggestAnswer | null) => void,
    private readonly debounceMs: number,
  ) {}

  /** The reader typed `prefix`. */
  ask(prefix: string): void {
    this.cancel();
    if (!isAskablePrefix(prefix)) {
      this.answer(null);
      return;
    }
    const narrowed = this.complete?.narrow(prefix);
    if (narrowed !== undefined) {
      this.answer({ outcome: "suggested", suggestions: narrowed });
      return;
    }
    const request = new AbortController();
    this.inFlight = request;
    this.timer = setTimeout(async () => {
      try {
        const answer = await this.request(prefix, request.signal);
        if (request.signal.aborted) return;
        if (answer.outcome === "suggested") this.complete = CompleteSuggestions.of(prefix, answer.suggestions);
        this.answer(answer);
      } catch {
        if (request.signal.aborted) return;
        this.answer({ outcome: "failed" });
      }
    }, this.debounceMs);
  }

  /** Drop the waiting keystroke and the request in flight, if any. */
  cancel(): void {
    clearTimeout(this.timer);
    this.inFlight?.abort();
    this.inFlight = null;
  }
}
