# Unconditional test assertions

How a test under `test/` or `web/test/` makes sure its assertions run; applies to
every `node:test` file, and above all to tests over a union answer or a loop.

Adapted from phoenix's [unconditional-test-assertions](https://github.com/kamp-us/phoenix/blob/main/.patterns/unconditional-test-assertions.md).

## The shape

An assertion inside an `if` or a loop proves nothing when the branch is never
taken: the test goes green over nothing. Lexema's tests use three shapes instead.

**Assert the case, then read it.** `assert.ok` from `node:assert/strict` is
declared `asserts value`, so asserting a union's tag also narrows its type. No
`if` is needed to reach the fields
([`test/lookup.test.ts`](../test/lookup.test.ts)):

```ts
const link = readings[0].lemmaLinks[0];
assert.ok(link.kind === "candidates");
const studente = link.candidates.find((c) => c.pos === "noun");
```

**Put the condition inside the asserted value.** When a test only needs one
field, `&&` keeps the assertion unconditional: a wrong tag gives `false`, which
fails against the expected value ([`test/phrase.test.ts`](../test/phrase.test.ts)):

```ts
assert.equal(result.outcome === "found" && result.route.kind, "surface");
```

**Prove the loop reached its case.** A loop that asserts only for some items ends
with a check that at least one item got there
([`web/test/page.test.tsx`](../web/test/page.test.tsx)):

```ts
const listed: string[] = [];
for (const query of ["andavano", "sale", "bello", "casa", "belli"]) {
  if ((await readingsFor(db, query)).some((reading) => !reading.isAboutQuery)) listed.push(query);
  assert.doesNotMatch(textOf(await render(db, query)), /among its forms/, query);
}
assert.ok(listed.length > 0, "some query here is listed by a record that is not about it");
```

The same check guards a filter: `assert.ok(hits.length > 0, text)` in
[`test/glossGrammarStamp.test.ts`](../test/glossGrammarStamp.test.ts) fails when no
pattern matched, rather than passing over an empty list.

## When this applies

Every test that reads a discriminated union (`outcome`, `kind`), asserts inside a
loop, or asserts over a filtered list. No lint rule enforces it here; the shapes
above are the review standard. A test whose `if` only picks between two
assertions that both run on their own branch (`if (gender === undefined) assert…
else assert…` in [`web/test/card.test.tsx`](../web/test/card.test.tsx)) already
asserts on every path and needs none of this.

## Why it is not obvious

A guarded assertion reads as careful: it checks the case before reading its
fields. But when the code under test stops returning that case, the guard skips
the assertion and the test stays green, which is the one change the test was
written to catch. Writing `if (x.kind === "found") { assert… }` is also what
TypeScript seems to ask for; `assert.ok` narrows the same way and fails loudly.
