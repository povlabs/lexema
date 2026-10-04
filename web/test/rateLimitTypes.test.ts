// Each counted limit carries only its own kind of answer once spent, and the
// dictionary's JSON answers only their own body (#564). The assertions here are
// the compiler's: `pnpm --dir web typecheck` fails if a wrong pairing type-checks.

import assert from "node:assert/strict";
import test from "node:test";
import type { DictionaryCounted } from "@/worker/dictionary/limits.ts";
import type { Counted, DeveloperLimit } from "@/worker/shared/rateLimit.ts";

test("a developer-site limit is answered only by a sentence", () => {
  const pairings = [
    // @ts-expect-error a developer-site limit is never handed to the dictionary's page
    { limit: "sign-in", blocked: { by: "page" } } satisfies Counted<DeveloperLimit>,
    // @ts-expect-error a developer-site limit is never answered with JSON
    { limit: "key-create", blocked: { by: "json", body: { outcome: "limited" } } } satisfies Counted<DeveloperLimit>,
    // @ts-expect-error a developer-site limit is never answered with JSON
    { limit: "billing", blocked: { by: "json", body: "limited" } } satisfies Counted<DeveloperLimit>,
    { limit: "billing", blocked: { by: "text", sentence: "Too many." } } satisfies Counted<DeveloperLimit>,
  ];
  assert.equal(pairings.length, 4);
});

test("a search is answered only by the page, and the dictionary's other limits only with JSON", () => {
  const pairings = [
    // @ts-expect-error a search is never answered with JSON
    { limit: "search", blocked: { by: "json", body: { outcome: "limited" } } } satisfies DictionaryCounted,
    // @ts-expect-error a search is never answered with a sentence
    { limit: "search", blocked: { by: "text", sentence: "Too many." } } satisfies DictionaryCounted,
    // @ts-expect-error a suggestion is never handed to the page
    { limit: "suggest", blocked: { by: "page" } } satisfies DictionaryCounted,
    // @ts-expect-error a report is never answered with a sentence
    { limit: "report", blocked: { by: "text", sentence: "Too many." } } satisfies DictionaryCounted,
    // @ts-expect-error opening the report box is never handed to the page
    { limit: "report-open", blocked: { by: "page" } } satisfies DictionaryCounted,
    { limit: "search", blocked: { by: "page" } } satisfies DictionaryCounted,
  ];
  assert.equal(pairings.length, 6);
});

test("a suggestion is answered with a SuggestAnswer, a report with a ReportAnswer", () => {
  const pairings = [
    // @ts-expect-error "sent" is a ReportAnswer, not a SuggestAnswer
    { limit: "suggest", blocked: { by: "json", body: { outcome: "sent" } } } satisfies DictionaryCounted,
    // @ts-expect-error "suggested" is a SuggestAnswer, not a ReportAnswer
    { limit: "report", blocked: { by: "json", body: { outcome: "suggested", suggestions: [] } } } satisfies DictionaryCounted,
    // @ts-expect-error a bare string is not a ReportAnswer
    { limit: "report-open", blocked: { by: "json", body: "limited" } } satisfies DictionaryCounted,
    // @ts-expect-error a JSON answer needs its site's bodies, so none can be written without them
    { limit: "suggest", blocked: { by: "json", body: { outcome: "limited" } } } satisfies Counted<"suggest">,
    { limit: "suggest", blocked: { by: "json", body: { outcome: "suggested", suggestions: ["casa"] } } } satisfies DictionaryCounted,
    { limit: "report-open", blocked: { by: "json", body: { outcome: "limited" } } } satisfies DictionaryCounted,
  ];
  assert.equal(pairings.length, 6);
});
