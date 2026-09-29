// The small line icons the frames draw: the magnifier in the search field,
// the chevron on a "Show all" button, the out-arrow beside Source, and on the
// developer site GitHub's mark, Copy and a toast's alert.
// Drawn in `currentColor`, so each takes the role colour of the text it sits
// in and none carries a colour of its own. Decorative: the text beside each
// says what it means.

export function SearchIcon({ className }: { className: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="7" cy="7" r="4.75" />
      <path d="m10.5 10.5 3.5 3.5" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronIcon({ className }: { className: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ExternalIcon({ className }: { className: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5V13a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 3 13V5a.5.5 0 0 1 .5-.5H7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** GitHub's mark, as a line icon (board 27). */
export function GitHubIcon({ className }: { className: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 18c-4.51 2-5-2-7-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Two overlapping sheets: Copy (board 28e). */
export function CopyIcon({ className }: { className: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.25" />
      <path d="M10.5 3.5v-.25A1.25 1.25 0 0 0 9.25 2h-6A1.25 1.25 0 0 0 2 3.25v6A1.25 1.25 0 0 0 3.25 10.5h.25" strokeLinecap="round" />
    </svg>
  );
}

/** An exclamation mark in a circle: a toast's error (board 28f). */
export function AlertIcon({ className }: { className: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="8" r="6.75" />
      <path d="M8 4.75v3.75" strokeLinecap="round" />
      <circle cx="8" cy="11.25" r=".5" fill="currentColor" stroke="none" />
    </svg>
  );
}
