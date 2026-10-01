-- Canonical read queries for the Lexema D1 schema.
--
-- These exist so the importer (#10) and lookup (#13) build against one shape.
-- They are reference SQL, not a migration: nothing here runs at deploy time.
-- Bind parameters are :master and :key. :master is the release the dictionary
-- was seeded from, which names it with the changes applied from later releases
-- (#18); :key is the query text with the release's normalizer already applied.
-- All reads require a served release (`served_release` in schema.sql): the
-- complete release, or a feed of it. Direct base-table reads are for import
-- diagnostics, not serving.
--
-- Where a query orders by json_pointer it orders by pointer *text*, which puts
-- '/forms/10/form' before '/forms/2/form'. SQLite has no numeric-aware
-- collation for the array index inside a pointer, so a caller that presents
-- rows in source order re-orders them segment by segment itself; lookup does
-- this in src/lookup/lookup.ts. The ORDER BY here is for a stable result, not
-- for source order.


-- 1. Exact-surface search.
--
-- Returns one row per surface occurrence, not per word. `sale` returns five:
-- three records that ARE `sale`, and two that merely list it in a table.
-- `is_headword_hit = 0` means the record is not a claim about the surface — do
-- not label its `word` as the lemma of the query. `studenti` shows why: three of
-- its five hits sit inside `studente`, `studentessa` and `studentesse`.
SELECT
  record_id, release_id, line_no, record_word, record_pos,
  origin, json_pointer, form_source, surface, is_headword_hit
FROM surface_hit
WHERE master_release_id = :master
  AND surface_key = :key
ORDER BY is_headword_hit DESC, line_no, json_pointer;


-- 2. Candidate-only expansion (omits dangling edges; use 2a for public results).
--
-- One row per (edge, candidate). An edge with several candidates produces
-- several rows and the caller must show all of them. Noun `bella` returns three
-- candidate `bello` records; restricting to the same part of speech still leaves
-- two, and nothing in the source chooses between them.
SELECT
  edge_id, edge_pointer, target_word,
  candidate_record_id, candidate_release_id, candidate_line_no, candidate_pos
FROM form_of_candidate
WHERE from_record_id = :record_id
ORDER BY edge_id, candidate_line_no;


-- 2a. Recommended public result contract: distinguish "points nowhere"
-- from "points at one thing". A dangling edge yields one row with
-- candidate_record_id NULL instead of vanishing.
SELECT
  e.edge_id, e.json_pointer AS edge_pointer, e.target_word,
  c.candidate_record_id, c.candidate_release_id, c.candidate_line_no, c.candidate_pos
FROM form_of_edge e
JOIN served_release s ON s.release_id = e.release_id
LEFT JOIN form_of_candidate c ON c.edge_id = e.edge_id
WHERE e.record_id = :record_id
ORDER BY e.edge_id, c.candidate_line_no;


-- 3. Which records declare themselves forms of this one?
--
-- The reverse direction, and also ambiguous: an edge naming `bello` matches all
-- three `bello` records, so each of them lists the same inflected entries. The
-- ambiguity is symmetric and is not hidden on either side.
SELECT
  e.record_id  AS from_record_id,
  f.release_id AS from_release_id,
  f.line_no    AS from_line_no,
  f.word       AS from_word,
  f.pos        AS from_pos,
  e.json_pointer AS edge_pointer
FROM lookup_form lf
JOIN served_release sl ON sl.release_id = lf.release_id
JOIN served_release se ON se.master_release_id = sl.master_release_id
JOIN form_of_edge e
  ON e.release_id = se.release_id
 AND e.target_word_key = lf.surface_key
JOIN source_record f ON f.record_id = e.record_id
WHERE lf.record_id = :record_id
  AND lf.origin = 'headword'
ORDER BY f.line_no;


-- 4. Everything needed to render one record: senses in source order, each gloss
-- and label carrying its own pointer.
SELECT
  s.sense_index,
  g.gloss_index,
  g.text         AS gloss,
  g.json_pointer AS gloss_pointer
FROM sense s
JOIN source_record r ON r.record_id = s.record_id
JOIN served_release rel ON rel.release_id = r.release_id
LEFT JOIN sense_gloss g ON g.sense_id = s.sense_id
WHERE s.record_id = :record_id
ORDER BY s.sense_index, g.gloss_index;

SELECT
  s.sense_index, l.kind, l.label, l.json_pointer
FROM sense s
JOIN source_record r ON r.record_id = s.record_id
JOIN served_release rel ON rel.release_id = r.release_id
JOIN sense_label l ON l.sense_id = s.sense_id
WHERE s.record_id = :record_id
ORDER BY s.sense_index, l.kind, l.label_index;


-- 5. Grammar for a record, with the four states kept apart. A caller that wants
-- only usable values filters status = 'stated'; a caller that wants to be honest
-- about gaps reads the 'missing' and 'unclassified' rows too. A dimension with
-- no row at all was never expected here, which is a different thing from missing.
SELECT
  scope, scope_index, status, dimension, value, source_text, json_pointer
FROM grammar_claim
WHERE record_id = :record_id
  AND record_id IN (SELECT r.record_id FROM source_record r
    JOIN served_release rel ON rel.release_id = r.release_id)
ORDER BY scope, scope_index, json_pointer;


-- 6. Review notes attached to a record. A 'disputed' row leaves the source claim
-- as imported, never removed or rewritten; the result page does not show it.
SELECT json_pointer, status, note, evidence_url, reviewed_at, reviewed_by
FROM claim_review
WHERE record_id = :record_id
  AND record_id IN (SELECT r.record_id FROM source_record r
    JOIN served_release rel ON rel.release_id = r.release_id)
ORDER BY json_pointer, reviewed_at;


-- 7. The verbatim record, for auditing a pointer against its real source.
SELECT j.raw_json
FROM source_record_json j
WHERE j.record_id = :record_id
  AND j.record_id IN (SELECT r.record_id FROM source_record r
    JOIN served_release rel ON rel.release_id = r.release_id);
