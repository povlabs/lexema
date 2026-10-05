// Cloudflare Turnstile, the one third-party code a page runs (the report
// dialog, components/dictionary/ReportDialog.tsx). Its script and its widget's
// frame both come from this origin, which is why the pages' Content Security
// Policy names it (worker/shared/securityHeaders.ts).

/** Where Turnstile's script and widget frame are served from. */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/** Turnstile's script, loaded on demand and rendering only when asked. */
export const TURNSTILE_SCRIPT = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;
