# The error-copy law

How Lexema words what a person reads when something fails or is not there; applies
to the dictionary page, the developer site, the JSON API's `message` fields and the
Worker's plain-text refusals.

Adapted from phoenix's [error-copy-law](https://github.com/kamp-us/phoenix/blob/main/.patterns/error-copy-law.md).

## The shape

The site calls itself *a simple dictionary* (`SITE_TAGLINE` in
[`web/lib/dictionary/params.ts`](../web/lib/dictionary/params.ts)), and its error
copy is written to match: short sentences, everyday words, no filler. Five rules,
each visible in the source:

1. **Say what happened, then what to do.** One sentence each, and the second only
   when the reader can act:

   ```ts
   return refuse(403, "This form has expired. Reload the page and try again.");
   ```

   ([`web/worker/developers/dashboard.ts`](../web/worker/developers/dashboard.ts)). The same shape runs
   through the limits in [`web/worker/developers/limits.ts`](../web/worker/developers/limits.ts):
   "Too many sign-in attempts. Try again in a minute."
2. **A failure the reader cannot fix gets one fixed line; the cause goes to the
   log.** The database's or Stripe's message never reaches the reader:

   ```ts
   } catch (failure) {
     // The database's message names tables and releases: it goes to the log.
     console.error("api request failed", failure);
     return json(503, error("unavailable", "The request could not be answered. Try again later."), headers);
   }
   ```

   ([`web/worker/api/handler.ts`](../web/worker/api/handler.ts)). The developer
   site's line is `UNREACHABLE` in
   [`web/lib/developers/dashboardActions.ts`](../web/lib/developers/dashboardActions.ts),
   and an answer the page cannot read falls back to it too.
3. **The machine code and the sentence are separate fields.** The API answers
   `{ error: { code, message } }`
   ([`web/worker/api/answer.ts`](../web/worker/api/answer.ts)): `code` is for
   programs, and `message` never repeats it or carries a status number.
4. **Each outcome's words are written once, keyed by the outcome.** A `Record`
   over the union makes a new outcome without copy a type error:

   ```ts
   export const OPENING_TROUBLE: Readonly<Record<OpeningTrouble, string>> = {
     "open-limited": "Hai aperto questa finestra troppe volte nell’ultimo minuto. Aspetta un momento, poi riprova.",
     "open-failed": "La finestra non è riuscita a prepararsi per l’invio. Riprova tra un momento.",
   };
   ```

   ([`web/lib/dictionary/report.ts`](../web/lib/dictionary/report.ts)).
5. **The dictionary page states the result, never a note about the data.** A miss
   is "Nessuna voce per" the query, then what is near it
   ([`web/components/dictionary/NotFound.tsx`](../web/components/dictionary/NotFound.tsx)).
   No line says a fact was missing, recovered, derived or hidden
   ([ADR 0016](../.decisions/0016-page-shows-no-origin-marks.md),
   [ADR 0023](../.decisions/0023-foreign-records-are-hidden-not-deleted.md)).

The tests pin the fixed line rather than a copy of it: when Stripe is down,
deleting an account answers `{ outcome: "refused", message: UNREACHABLE }`
([`web/test/dashboard.test.ts`](../web/test/dashboard.test.ts)).

## When this applies

Any string a reader sees because something failed, was refused or was not found.
Copy for a page's normal content is the
[design manifest](../design-system-manifest.md)'s. Text a model writes is outside
this law and is labelled as generated
([ADR 0008](../.decisions/0008-generated-explanations-are-labelled-and-reportable.md)).
Log lines are for Lexema, not readers, and may name tables and causes.

## Why it is not obvious

The easy version passes the caught error's message through: it is already a
string, and it feels honest. But that message names tables, releases and
third-party services, and changes with every dependency. The other easy version
explains the data ("this definition was recovered", "some forms are missing"),
which reads as care but turns a dictionary page into notes about Lexema.
