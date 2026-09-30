-- The two reader-report tables exactly as src/db/schema.sql defined them at
-- ef0ea42, before they moved to the app database (#240, ADR 0018).
-- test/appSchema.test.ts holds the migrated tables to this shape. A reference
-- only: nothing applies it.

-- ---------------------------------------------------------------------------
-- Reader reports (#51)
-- ---------------------------------------------------------------------------

-- A reader's report that something on a word page is wrong, as sent from the
-- page's "Report a mistake" box. It is not a review: claim_review holds
-- verdicts, and every disputed row there is shown on the page, so an unreviewed
-- report cannot live in it. A report changes nothing; it waits for a person
-- (#12), who may then write a claim_review row.
--
-- No foreign key: a report names the release and record it was sent from, and
-- has to outlive that release. The visitor is stored as a SHA-256 of their
-- rate-limit key (web/lib/dictionary/report.ts), never as an address, and is kept only so
-- the hourly allowance can be counted.
CREATE TABLE reader_report (
  report_id    INTEGER PRIMARY KEY,
  release_id   TEXT NOT NULL,
  word         TEXT NOT NULL,
  record_id    INTEGER,          -- the reading the reader picked; NULL for none or "Not sure"
  choice       TEXT NOT NULL CHECK (choice IN ('meaning', 'example', 'form', 'synonym', 'other')),
  details      TEXT NOT NULL CHECK (length(details) BETWEEN 1 AND 2000),
  visitor_hash TEXT NOT NULL,
  received_at  TEXT NOT NULL     -- ISO-8601
) STRICT;

CREATE INDEX reader_report_by_visitor ON reader_report (visitor_hash, received_at);

-- One opening of the report box: a random token the server hands the box when
-- it opens, and the server's own time. A report must carry one, and at least
-- 3 s must have passed on the server's clock since it was issued, so the check
-- never compares two clocks. Used once: deleted when its report is stored.
-- Openings older than a day are swept when a new one is issued.
CREATE TABLE report_opening (
  token     TEXT PRIMARY KEY,
  opened_at TEXT NOT NULL      -- ISO-8601, the server's clock
) STRICT;
