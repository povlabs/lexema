# Source-record admission and provenance

How `src/source/` admits a record from `it-extract.jsonl.gz`, and how every value
derived from it keeps a pointer back; applies to the reader, the resolver and the
Italian adapter.

## The shape

The file is read as a gzip stream, one JSONL line at a time, and never parsed
whole. A line is admitted when it parses and its `lang_code` is exactly `"it"`; a
malformed line and a non-Italian record are counted, not raised. Each admitted
record travels as a `RecordEnvelope`: the record, its 1-based physical line as
`ordinal`, its byte size, and an optional SHA-256 of the line
(`src/source/jsonlGzipReader.ts`).

```ts
if (record.lang_code !== "it") {
  profile.nonItalianSkipped += 1;
  continue;
}
const ordinal = profile.parsedLines;
options.onItalianRecord({ record, ordinal, sourceBytes, recordHash });
```

Every value the adapter derives from an envelope carries a `ProvenanceRef` built by
one function: the release id, the ordinal, a JSON Pointer to the field inside the
record, and the hash when present (`src/source/provenance.ts`).

```ts
provenanceFor(metadata, envelope, `/senses/${senseIndex}/examples/${exampleIndex}/text`)
```

The pointer names the exact field, such as `/word`, `/forms/16` or
`/senses/0/examples/1/text`, so a reader can open the release at that line and
check the claim. A form whose grammar cannot be mapped safely is kept as an
`UnclassifiedForm` with its raw tags and a reason, provenance attached
(`targetForms` in `src/italian/adapter.ts`).

The integration test pins the memory shape: streaming the real file accepts more
than 500,000 Italian records while retaining fewer than 500 at peak
(`test/integration/adapter-fixtures.test.ts`).

## When this applies

The field names here are the spike's compact `{ r, i, p, h }`. The canonical names are the schema's `release_id`, `line_no`, `json_pointer`, `line_sha256` (`src/db/schema.sql`); code written against the schema uses those, and this reader is the pre-schema shape.

Any code that reads the source file or derives a value from a record:
`src/source/jsonlGzipReader.ts`, `src/source/provenance.ts`,
`src/core/candidateResolver.ts` and `src/italian/adapter.ts`. It stops at the
serving layer. The D1 projection and the Worker
([ADR 0004](../.decisions/0004-cloudflare-workers-d1-vinext.md)) are decided but
not built, and how a projection row carries its provenance ref is not yet settled.

## Why it is not obvious

The filename says Italian, but the file holds `ca`, `la`, `pt`, `es`, `en` and
other records. Filtering on the filename, on a category string, or on the spelling
of `word` admits the wrong language ([dataset findings](../reports/dataset-findings.md)).
Reading the whole file into memory works on a laptop and is banned inside a request
Worker ([ADR 0004](../.decisions/0004-cloudflare-workers-d1-vinext.md)), which is
why the stream retains almost nothing. A provenance recorded as a URL or a free-text
note cannot be checked against the release; the ordinal-plus-pointer form can, and
the validation report measures its byte overhead so the cost of keeping it is known
rather than assumed.
