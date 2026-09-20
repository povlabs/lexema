# Lexema patterns

This is the task-to-pattern map for the source adapter, the resolver and the
tooling around them. Read the rows that match the change. A row routes you to its
owning guide; it does not copy that guide's rules. Read representative code and
tests alongside the guide.

## Source adapter

For `src/source/` and `src/italian/`, the code that reads the Kaikki file and turns
records into candidates.

| Pattern | Topic / scope | Read when |
|---|---|---|
| [source-record-admission-and-provenance.md](./source-record-admission-and-provenance.md) | Admitting a record from the Kaikki file and attaching provenance to every derived value | Reading the source file, adding a derived field to a candidate, or deciding what a provenance ref must carry |

## When to add a new pattern doc here

A pattern may enter through either source-backed path:

- **Current shape:** in-repo source and tests demonstrate a reusable shape that
  future agents need. Cite representative paths and state where the shape stops
  applying; no fixed call-site count is an admission prerequisite.
- **Prospective shape:** a cited binding decision names the technology or shape
  before its first implementation, and authoritative dependency source or docs
  ground every rule. State the intended scope without inventing current call
  sites.

Both paths must also clear the same two bars:

- The pattern is **non-obvious** — it codifies a choice rather than narrating code
  or generic framework guidance.
- A future agent would otherwise **invent a foreseeable worse version**.

Do not add obvious descriptions, generic framework advice, speculative or
undocumented conventions, intuition-only rules, one-off implementation details, or
migration steps. Every claim must trace to the cited current source and tests or to
authoritative dependency source; if that evidence is unusable, decline rather than
fall back to intuition. The *why* behind a shape belongs in `.decisions/`, a term's
meaning in `.glossary/`, and a dated measurement in `reports/`.
