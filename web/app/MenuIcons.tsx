// The developer site's two bar icons (the ☰ menu on a phone, and the × that
// closes it), drawn as the phone boards draw them. In `currentColor`, like
// icons.tsx, and decorative: the control they sit in is named.

export function MenuIcon({ className }: { className: string }) {
  return (
    <svg className={className} width="17" height="15" viewBox="0 0 17 15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M.25 1h16.5M.25 7.5h16.5M.25 14h16.5" />
    </svg>
  );
}

export function CloseIcon({ className }: { className: string }) {
  return (
    <svg className={className} width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="m.75.75 11.5 11.5M12.25.75.75 12.25" strokeLinecap="round" />
    </svg>
  );
}

/** The tick before each of a plan's features (board 26). */
export function CheckIcon({ className }: { className: string }) {
  return (
    <svg className={className} width="12" height="9" viewBox="0 0 12 9" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="m.75 4.5 3.5 3.5L11.25 1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
