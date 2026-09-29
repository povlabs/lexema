// The `sm` breakpoint as a live media query, for code that has to act when it
// starts to match, such as the ☰ menu closing itself (#196). The width lives
// once, as `--breakpoint-sm` in web/app/globals.css; this reads it off the page
// rather than typing a second copy that could drift from Tailwind's.

/** The query Tailwind's `sm:` variant writes for a width: `(width >= 40rem)`. */
export function smQuery(width: string): string {
  const value = width.trim();
  if (value === "") throw new Error("--breakpoint-sm is not on :root; web/app/globals.css declares it in `@theme static`");
  return `(width >= ${value})`;
}

/** The `sm` query in this document, matching exactly when `sm:` classes apply. */
export function smMedia(): MediaQueryList {
  return matchMedia(smQuery(getComputedStyle(document.documentElement).getPropertyValue("--breakpoint-sm")));
}
