# lexema domain vocabulary (TERMS)

The repo-owned vocabulary spine. One row per term: the canonical definition, and where a name has
drifted, what the term is **not**. When the code and this file disagree, the code is authoritative
and this file is the doc to fix.

## Source data
| Term | Definition | Not |
|---|---|---|
| embedded form | One entry of a record's `forms[]`, indexed as `embedded-form` evidence with its own tags and a `/forms/<i>` pointer (`src/core/candidateResolver.ts`). The same surface can also exist as a separate record; a lookup keeps both as evidence. | a separate record |
| form-of record | A source record tagged `form-of` whose sense carries `form_of[].word` naming the lemma it inflects. The target resolves only when exactly one record matches; otherwise the relation is counted as unresolved or ambiguous (`resolveCandidates` in `src/core/candidateResolver.ts`). | a resolved lemma — the pointer is evidence, not the answer |
| headword | A source record's `word`. Every Italian record is indexed under it as `headword` evidence, whether the record is a lemma or itself a form-of record (`SourceEvidence.kind` in `src/core/types.ts`; `src/core/candidateResolver.ts`). | a lemma — a headword can be an inflected form with its own record |
| release | One immutable import of a source file, identified by `releaseId` and carrying source, licence, retrieval time and compressed SHA-256 (`ReleaseMetadata` in `src/core/types.ts`). A provenance ref's `r` names it. | a Git release or tag |
| source example | A `senses[].examples[].text` string returned on a candidate only when it contains the exact searched surface after Italian normalization (`containsExactItalianSurface` in `src/italian/normalize.ts`); any other example is counted as rejected. | a generated sentence |

## Lookup
| Term | Definition | Not |
|---|---|---|
| candidate | One result of a lookup: a target record plus every piece of evidence that led to it, with its definitions, forms, articles, examples and provenance (`Candidate` in `src/core/types.ts`). A lookup returns every candidate the source supports; `sale` yields the salt noun, the plural of `sala` and the form of `salire`. | the chosen answer — ranking is a later, advisory step |
| provenance ref | The compact pointer every derived value carries: `r` the release id, `i` the 1-based physical line of the source record, `p` a JSON Pointer inside that record, and optional `h` the record's SHA-256 (`ProvenanceRef` in `src/core/types.ts`; `src/source/provenance.ts`). | a URL or free text |
| unclassified form | A surface form kept with its raw tags and a `reason` when its grammar cannot be mapped safely (`UnclassifiedForm`; `targetForms` in `src/italian/adapter.ts`). It is returned, not dropped, and no article is generated from it. | an error |
