// The developer site's two bar icons (the ☰ menu on a phone, and the × that
// closes it), drawn as the phone boards draw them. In `currentColor`, like
// icons.tsx, and decorative: the control they sit in is named.

import type { ReactNode } from "react";

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

// The account menu's three icons (board 28h), lucide's `layout-dashboard`,
// `settings` and `log-out` (https://lucide.dev, ISC licence), drawn on their
// 24-unit grid.

function LucideIcon({ className, children }: { className: string; children: ReactNode }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function DashboardIcon({ className }: { className: string }) {
  return (
    <LucideIcon className={className}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </LucideIcon>
  );
}

export function SettingsIcon({ className }: { className: string }) {
  return (
    <LucideIcon className={className}>
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <circle cx="12" cy="12" r="3" />
    </LucideIcon>
  );
}

export function SignOutIcon({ className }: { className: string }) {
  return (
    <LucideIcon className={className}>
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </LucideIcon>
  );
}
