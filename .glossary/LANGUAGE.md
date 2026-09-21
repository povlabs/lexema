# lexema architecture vocabulary (LANGUAGE)

The repo-owned architecture vocabulary. One row per term: the canonical definition, and where a name
has drifted, what the term is **not**. When the code and this file disagree, the code is
authoritative and this file is the doc to fix.

## Structure
| Term | Definition | Not |
|---|---|---|
| adapter | The per-language module that turns admitted source records into candidates: `src/italian/` today. Adding a language means a new adapter and a data release, never a change to the common response shape. | a generic service, or the reader in `src/source/`, which is language-agnostic |
| normalizer | The versioned function that makes an exact-lookup key: trim, NFC, apostrophe folding, then Italian lower-casing, accents kept (`normalizeItalianExact`, `IT_NORMALIZER_VERSION = "it-normalize/v1"` in `src/italian/normalize.ts`). Accent-insensitive lookup would be a separate, labelled mode. | a stemmer or a lemmatizer |
| projection | The read-optimized D1 copy of a release the Worker serves, built offline by the importer and never inside a request (ADR 0004). Decided, not built. | the source file, which stays immutable in R2 |
