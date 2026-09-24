// What is known about a source archive beyond its own bytes (#133).
//
// The Kaikki file records neither where it was downloaded from nor which
// Wiktionary dump it was built from, so those facts were read off the file's
// surroundings once and are kept here, keyed by the SHA-256 of the file they
// were read from. A seed looks up the checksum of the archive it actually read,
// so a fact can only ever land on the file it describes: an archive with any
// other checksum — a newer download from the same URL, or the development
// fixture cut from this one — gets none of them.
//
// This is the one place these facts live. The seed copies them into
// `source_release` (src/db/schema.sql) and the attribution page reads them back
// from there; nothing else types them in.

/** A Wikimedia dump id, `itwiktionary-` and the dump's date as `YYYYMMDD`. */
export type WiktionaryDumpId = `itwiktionary-${string}`;

/**
 * The Wiktionary dump an archive was extracted from, and how that is known.
 *
 * `recorded` is a dump kaikki's build log names. `inferred` is one kaikki did
 * not record, reasoned to from the archive's dates and contents; the entry
 * states that reasoning beside it, and its `evidence` says where it is shown.
 */
export interface SourceDump {
  id: WiktionaryDumpId;
  basis: "recorded" | "inferred";
}

/** The facts one archive does not carry in its own bytes. */
export interface ArchiveFacts {
  /** The URL the file was downloaded from. */
  sourceUrl: string;
  /** When the file was downloaded, ISO-8601 UTC. */
  retrievedAt: string;
  dump: SourceDump;
  /** Where in this repository each fact above is shown to be true. */
  evidence: readonly string[];
}

/** Facts per archive, keyed by the lowercase hex SHA-256 of the compressed file. */
export type ArchiveFactsCatalog = Readonly<Record<string, ArchiveFacts>>;

export const ARCHIVE_FACTS: ArchiveFactsCatalog = {
  // `it-extract.jsonl.gz`, 39,890,237 bytes, release `it-0c432803`. Published
  // as extracted from the 1 July 2026 dump by ADR 0013 (PR #130).
  "0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf": {
    sourceUrl: "https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz",
    retrievedAt: "2026-07-20T09:04:02Z",
    // kaikki's file does not name its dump. kaikki built it on 16 July 2026,
    // the last Italian Wiktionary dump before that is 1 July's, every one of
    // its 560,357 Italian records has a page of its exact title in that dump,
    // and the dump's newest edit is from 3 July.
    dump: { id: "itwiktionary-20260701", basis: "inferred" },
    evidence: [
      "docs/LICENSING.md §1.1: the download URL and time, from the file's macOS metadata; the build time, from its gzip header",
      "docs/LICENSING.md §1.3: why the dump is itwiktionary-20260701, and why that is inferred",
      "reports/2026-09-23-recovered-definitions-full-release.md: every Italian record has a page of its exact title in that dump",
    ],
  },
};

/** The facts recorded for the archive with this SHA-256, or none. */
export function archiveFactsFor(
  sha256: string,
  catalog: ArchiveFactsCatalog = ARCHIVE_FACTS,
): ArchiveFacts | undefined {
  return Object.hasOwn(catalog, sha256) ? catalog[sha256] : undefined;
}
