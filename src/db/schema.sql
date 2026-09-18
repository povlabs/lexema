-- Lexema D1 schema, v1.
--
-- Target: Cloudflare D1 (SQLite). No pragmas here: D1 manages journal mode and
-- foreign-key enforcement itself, and rejects most PRAGMA statements in migrations.
--
-- Conventions used throughout:
--   * A JSON pointer is RFC 6901, rooted at the single JSON object on one JSONL
--     line. "" is the whole record, "/senses/0/glosses/0" is one gloss.
--   * line_no is the 1-based physical line number in the .jsonl.gz.
--   * Array indexes are 0-based, matching the pointers.
--   * Every row that can end up on a screen carries the pointer of the field it
--     was read from, so a reader can check the claim at its real source and not
--     at some nearby lemma. See issue #16 for what happens when it does not.
--
-- The shape rests on three facts about this dataset, all verified against the
-- file (docs/DATASET_SPOT_CHECK.md, docs/RECORD_IDENTITY.md):
--   1. Both `word` and every `forms[].form` are searchable surfaces.
--   2. The record holding a form is often not the base word. `studentessa`
--      lists `studenti`; `bellissimo` lists `bella`.
--   3. A `form_of` edge names a word, never a record. `bella`'s noun edge points
--      at `bello`, which has two separate noun records.
-- So the schema has no column anywhere that resolves a form to a lemma record.
-- That resolution is a query, and a query may return more than one answer.


-- ---------------------------------------------------------------------------
-- Release
-- ---------------------------------------------------------------------------

-- One row per imported source file. The file itself is kept byte-for-byte in R2;
-- this row pins which bytes, so line_no below means something exact.
CREATE TABLE source_release (
  release_id       TEXT PRIMARY KEY,

  source_name      TEXT NOT NULL,           -- e.g. 'kaikki-it-wiktextract'
  source_url       TEXT,                    -- download URL, when known
  retrieved_at     TEXT,                    -- ISO-8601, when known
  upstream_release TEXT,                    -- upstream dump id; still unverified for the local file

  archive_r2_key   TEXT NOT NULL,           -- the untouched .jsonl.gz in R2
  archive_sha256   TEXT NOT NULL,           -- of the compressed bytes
  archive_bytes    INTEGER NOT NULL CHECK (archive_bytes > 0),

  -- Search keys are only comparable within one release, because the normalizer
  -- that produced them is a property of the import run, not of the schema.
  -- Italian accent and apostrophe handling is still open; see the doc.
  normalizer       TEXT NOT NULL,           -- e.g. 'it-normalize/v1'

  importer_version TEXT NOT NULL,
  schema_version   INTEGER NOT NULL,

  license          TEXT,                    -- SPDX-ish string as found upstream
  attribution      TEXT,

  -- A half-imported release must never be served. Lookup queries filter on
  -- status = 'complete'; nothing else is allowed to be read.
  status           TEXT NOT NULL DEFAULT 'importing'
                   CHECK (status IN ('importing', 'complete', 'failed', 'superseded'))
) STRICT;


-- ---------------------------------------------------------------------------
-- Source records
-- ---------------------------------------------------------------------------

-- Identity of a source record is (release_id, line_no). Nothing else is stable:
-- the file carries no id field, and (word, pos) is not unique — 1,435 (word, pos)
-- groups have more than one Italian record, up to 5 of them. record_id is a
-- surrogate integer so the many child tables index cheaply; it is an artefact of
-- this database and must never be published as a permanent identifier.
CREATE TABLE source_record (
  record_id  INTEGER PRIMARY KEY,
  release_id TEXT    NOT NULL REFERENCES source_release(release_id) ON DELETE CASCADE,
  line_no    INTEGER NOT NULL CHECK (line_no > 0),

  -- sha256 of the raw line bytes, so a record can be checked against the R2 archive.
  line_sha256 TEXT NOT NULL,

  -- Verbatim copies of three top-level fields, kept here only so lookup can
  -- group and label results without decompressing raw_json. Every Italian record
  -- in the file has all three.
  word      TEXT NOT NULL,
  pos       TEXT NOT NULL,
  pos_title TEXT NOT NULL,

  -- The import admits `lang_code == 'it'` and nothing else. The constraint keeps
  -- that filter visible in the data; relax it when a second language lands.
  lang_code TEXT NOT NULL CHECK (lang_code = 'it'),

  UNIQUE (release_id, line_no),
  -- Lets child tables carry release_id under a composite foreign key, so a child
  -- row can never claim a release its record does not belong to.
  UNIQUE (record_id, release_id)
) STRICT;

-- The verbatim record, split off because it is large (391 MB of Italian JSON,
-- ~700 bytes a row) and is only read when rendering one result. Keeping it out
-- of source_record keeps the table that every lookup joins small enough to stay
-- in page cache.
CREATE TABLE source_record_json (
  record_id INTEGER PRIMARY KEY REFERENCES source_record(record_id) ON DELETE CASCADE,
  -- The exact JSON text of the line, unparsed, unreordered, unmodified.
  -- Nothing downstream may write to this column.
  raw_json  TEXT NOT NULL
) STRICT;


-- ---------------------------------------------------------------------------
-- Lookup rows
-- ---------------------------------------------------------------------------

-- One row per searchable surface occurrence: the record's own `word`, plus every
-- `forms[].form` it embeds. ~560k headword rows and ~713k embedded-form rows.
--
-- `origin` is the load-bearing column. It says what the row's record actually
-- claims about the surface:
--   'headword'      -> this record IS about that surface.
--   'embedded-form' -> this record MENTIONS that surface in a table. It may or
--                      may not be the base word. `studentessa` lists `studenti`.
-- Nothing may treat an 'embedded-form' hit as evidence that the container is the
-- lemma. Lemma claims come only from form_of_edge.
CREATE TABLE lookup_form (
  lookup_id  INTEGER PRIMARY KEY,
  record_id  INTEGER NOT NULL REFERENCES source_record(record_id) ON DELETE CASCADE,
  release_id TEXT    NOT NULL,

  origin     TEXT NOT NULL CHECK (origin IN ('headword', 'embedded-form')),

  surface     TEXT NOT NULL,  -- verbatim source text, never cleaned
  surface_key TEXT NOT NULL,  -- release's normalizer applied to surface

  json_pointer TEXT NOT NULL, -- '/word' or '/forms/3/form'
  form_index   INTEGER,       -- index into forms[]; NULL for a headword

  -- forms[].source, present on 546,410 form entries, always a
  -- 'Appendice:Coniugazioni/...' page. It is the conjugation table the row came
  -- from, which is different provenance from the entry page itself.
  form_source TEXT,

  CHECK ((origin = 'headword') = (form_index IS NULL)),
  CHECK ((origin = 'headword') = (json_pointer = '/word')),
  -- One row per pointer. A record that lists the same surface twice keeps both
  -- rows: `studente` has `studenti` at /forms/0 and again at /forms/3, with
  -- different tags. Deduplicating would destroy evidence.
  UNIQUE (record_id, json_pointer),

  FOREIGN KEY (record_id, release_id)
    REFERENCES source_record(record_id, release_id) ON DELETE CASCADE
) STRICT;

-- The search index.
CREATE INDEX lookup_form_by_key
  ON lookup_form (release_id, surface_key);

-- Resolving a form_of edge means finding headword records for a word. The
-- partial index keeps that lookup off the 713k embedded-form rows.
CREATE INDEX lookup_form_headword_by_key
  ON lookup_form (release_id, surface_key)
  WHERE origin = 'headword';

CREATE INDEX lookup_form_by_record
  ON lookup_form (record_id);


-- ---------------------------------------------------------------------------
-- form_of edges
-- ---------------------------------------------------------------------------

-- A declared `senses[].form_of[]` edge, stored exactly as declared. In this file
-- every form_of array has length 1 and every entry has the single key `word`.
--
-- There is deliberately no target_record_id column. The source names a word, and
-- a word can have several records; noun `bella` points at `bello`, which is one
-- adjective record and two separate noun records. With no column to hold a
-- winner, no importer and no query can quietly pick one. Callers expand the edge
-- through form_of_candidate below and handle 0, 1, or many answers.
CREATE TABLE form_of_edge (
  edge_id    INTEGER PRIMARY KEY,
  record_id  INTEGER NOT NULL REFERENCES source_record(record_id) ON DELETE CASCADE,
  release_id TEXT    NOT NULL,

  -- The declaring side is the inflected record: `studenti` declares an edge to
  -- `studente`, not the other way round.
  sense_index    INTEGER NOT NULL CHECK (sense_index >= 0),
  form_of_index  INTEGER NOT NULL CHECK (form_of_index >= 0),
  json_pointer   TEXT NOT NULL,  -- '/senses/0/form_of/0/word'

  target_word     TEXT NOT NULL, -- verbatim
  target_word_key TEXT NOT NULL, -- release's normalizer applied to target_word

  UNIQUE (record_id, sense_index, form_of_index),

  FOREIGN KEY (record_id, release_id)
    REFERENCES source_record(record_id, release_id) ON DELETE CASCADE
) STRICT;

-- "What points at this word?" — used to list inflected forms of a headword.
CREATE INDEX form_of_edge_by_target
  ON form_of_edge (release_id, target_word_key);

CREATE INDEX form_of_edge_by_record
  ON form_of_edge (record_id);


-- ---------------------------------------------------------------------------
-- Senses
-- ---------------------------------------------------------------------------

-- Senses stay separate, one row each, in source order. Nothing is merged on
-- matching spelling and nothing is merged across records: `sale` is three
-- records (salt noun, plural of `sala`, third-person of `salire`) and stays three.
CREATE TABLE sense (
  sense_id     INTEGER PRIMARY KEY,
  record_id    INTEGER NOT NULL REFERENCES source_record(record_id) ON DELETE CASCADE,
  sense_index  INTEGER NOT NULL CHECK (sense_index >= 0),
  json_pointer TEXT NOT NULL,  -- '/senses/0'
  UNIQUE (record_id, sense_index)
) STRICT;

CREATE INDEX sense_by_record ON sense (record_id);

-- Glosses are copied source text, never a Lexema definition. 667 senses are
-- tagged 'no-gloss' and simply have no rows here; `sala` sense 1 has a gloss that
-- says the definition is missing. A non-empty gloss is not a usable definition.
CREATE TABLE sense_gloss (
  gloss_id     INTEGER PRIMARY KEY,
  sense_id     INTEGER NOT NULL REFERENCES sense(sense_id) ON DELETE CASCADE,
  gloss_index  INTEGER NOT NULL CHECK (gloss_index >= 0),
  text         TEXT NOT NULL,
  json_pointer TEXT NOT NULL,  -- '/senses/0/glosses/0'
  UNIQUE (sense_id, gloss_index)
) STRICT;

-- Register and usage labels on a sense ('figuratively', 'rare', 'form-of',
-- 'no-gloss', and the raw_tags like 'scuola'). Free text on purpose: this is the
-- source's vocabulary, not Lexema's, so there is no CHECK list to fall behind.
CREATE TABLE sense_label (
  label_id     INTEGER PRIMARY KEY,
  sense_id     INTEGER NOT NULL REFERENCES sense(sense_id) ON DELETE CASCADE,
  label_index  INTEGER NOT NULL CHECK (label_index >= 0),
  kind         TEXT NOT NULL CHECK (kind IN ('tag', 'raw_tag')),
  label        TEXT NOT NULL,
  json_pointer TEXT NOT NULL,  -- '/senses/0/tags/0'
  UNIQUE (sense_id, kind, label_index)
) STRICT;


-- ---------------------------------------------------------------------------
-- Grammar claims
-- ---------------------------------------------------------------------------

-- The closed grammar vocabulary, as a table rather than a CHECK list because
-- SQLite forbids subqueries in CHECK constraints and a flat literal list would
-- not be queryable. grammar_claim references it with a composite foreign key, so
-- an unmapped tag cannot enter as a newly invented value — it must land as
-- 'unclassified' instead. Widening the vocabulary is an INSERT in a migration
-- somebody has to read.
CREATE TABLE grammar_value (
  dimension TEXT NOT NULL CHECK (dimension IN (
    'gender', 'number', 'person', 'tense', 'mood',
    'degree', 'voice', 'transitivity', 'form-role'
  )),
  value     TEXT NOT NULL,
  PRIMARY KEY (dimension, value)
) STRICT;

INSERT INTO grammar_value (dimension, value) VALUES
  ('gender', 'masculine'), ('gender', 'feminine'), ('gender', 'neuter'),
  ('number', 'singular'), ('number', 'plural'), ('number', 'invariable'),
  ('person', 'first-person'), ('person', 'second-person'), ('person', 'third-person'),
  ('tense', 'present'), ('tense', 'imperfect'), ('tense', 'future'),
  ('tense', 'past'), ('tense', 'past-remote'), ('tense', 'perfect'),
  ('tense', 'pluperfect'), ('tense', 'historic'),
  -- 'indicative', 'subjunctive' and 'conditional' are seeded although no form in
  -- this release carries them structurally. They are exactly the values a
  -- 'missing' row names, and upstream has them.
  ('mood', 'indicative'), ('mood', 'subjunctive'), ('mood', 'conditional'),
  ('mood', 'imperative'), ('mood', 'participle'), ('mood', 'gerund'),
  ('mood', 'infinitive'),
  ('degree', 'positive'), ('degree', 'comparative'),
  ('degree', 'superlative'), ('degree', 'absolute'),
  ('voice', 'reflexive'), ('voice', 'pronominal'), ('voice', 'reciprocal'),
  ('transitivity', 'transitive'), ('transitivity', 'intransitive'),
  -- The forms[] entry names the auxiliary verb rather than an inflected form of
  -- the headword: `salire` /forms/0 is the string 'avere o essere'. A UI must
  -- not show it as a conjugation.
  ('form-role', 'auxiliary');

-- Grammar read off the source tags, with the four states kept apart:
--
--   absent        -> NO ROW. The source says nothing and nothing was expected.
--   'stated'      -> the source gave a tag the importer maps to a known value.
--   'unclassified'-> the source gave text the importer cannot map. The literal
--                    text is kept; no value is guessed. e.g. raw_tags 'pl.: case'
--                    on `casa`, 'lui/lei' on a `salire` form.
--   'missing'     -> the importer looked for a dimension it expects here and the
--                    source gave nothing. e.g. `casa` has no gender tag at all,
--                    `città` has no number, and no form in this entire file
--                    carries a structural mood — `parlerei` at line 37 /forms/53
--                    is tagged only 'present', with the conditional stated in
--                    prose on a different record.
--
-- Which dimensions are "expected" for which pos is importer policy (#10), not
-- schema. The schema only guarantees the four states stay distinguishable.
CREATE TABLE grammar_claim (
  claim_id  INTEGER PRIMARY KEY,
  record_id INTEGER NOT NULL REFERENCES source_record(record_id) ON DELETE CASCADE,

  -- Where on the record the claim hangs. A form-scoped claim is about
  -- forms[scope_index], not about the headword.
  scope       TEXT NOT NULL CHECK (scope IN ('record', 'sense', 'form')),
  scope_index INTEGER CHECK (scope_index IS NULL OR scope_index >= 0),

  -- For 'stated'/'unclassified': the exact tag. For 'missing': the container
  -- that should have carried it ('' for the whole record).
  json_pointer TEXT NOT NULL,

  status TEXT NOT NULL CHECK (status IN ('stated', 'unclassified', 'missing')),

  dimension TEXT,
  value     TEXT,

  -- The literal source text behind the claim, kept so an 'unclassified' row is
  -- still usable evidence and a 'stated' row can be audited against its tag.
  source_text TEXT,

  CHECK ((scope = 'record') = (scope_index IS NULL)),
  CHECK (
    (status = 'stated'
       AND dimension IS NOT NULL AND value IS NOT NULL AND source_text IS NOT NULL)
    OR (status = 'unclassified'
       AND dimension IS NULL     AND value IS NULL     AND source_text IS NOT NULL)
    OR (status = 'missing'
       AND dimension IS NOT NULL AND value IS NULL     AND source_text IS NULL)
  ),

  -- SQLite ignores a composite foreign key whose child columns contain a NULL,
  -- so 'missing' (value NULL) and 'unclassified' (both NULL) rows pass, while a
  -- 'stated' row must name a pair that exists in the vocabulary.
  FOREIGN KEY (dimension, value) REFERENCES grammar_value(dimension, value),
  -- A dimension-only row still has to name a real dimension.
  CHECK (dimension IS NULL OR dimension IN (
    'gender', 'number', 'person', 'tense', 'mood',
    'degree', 'voice', 'transitivity', 'form-role'
  ))
) STRICT;

CREATE INDEX grammar_claim_by_record ON grammar_claim (record_id, scope, scope_index);

-- One claim per (record, pointer, dimension). ifnull() because an 'unclassified'
-- row has no dimension and SQLite would otherwise treat every NULL as distinct.
CREATE UNIQUE INDEX grammar_claim_identity
  ON grammar_claim (record_id, json_pointer, ifnull(dimension, '*'));


-- ---------------------------------------------------------------------------
-- Reviews of imported claims
-- ---------------------------------------------------------------------------

-- A note about one imported claim, written by review rather than by import.
-- Reviews never edit source_record or source_record_json: the download stays
-- verbatim and a disputed claim stays visible with its dispute attached.
--
-- The worked case is `studente` line 37884, a verb record calling the word a
-- present participle of `studiare`. Italian Wiktionary's rendered `studiare`
-- table and Treccani both give `studiante` instead. The claim is not deleted and
-- not corrected; it is labelled.
--
-- This table is the shape only. Who reviews, on what evidence, and how a verdict
-- is reached is issue #12 and is not decided here.
CREATE TABLE claim_review (
  review_id  INTEGER PRIMARY KEY,
  record_id  INTEGER NOT NULL REFERENCES source_record(record_id) ON DELETE CASCADE,

  -- The exact claim under review, not the whole record.
  json_pointer TEXT NOT NULL,

  status TEXT NOT NULL CHECK (status IN ('disputed', 'corroborated')),

  -- Why, and what was checked. Both required: an unsourced verdict is not a review.
  note          TEXT NOT NULL,
  evidence_url  TEXT NOT NULL,
  reviewed_at   TEXT NOT NULL,   -- ISO-8601
  reviewed_by   TEXT NOT NULL,

  UNIQUE (record_id, json_pointer, evidence_url)
) STRICT;

CREATE INDEX claim_review_by_record ON claim_review (record_id);


-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- Every candidate record a form_of edge could mean, one row per candidate. An
-- ambiguous edge produces several rows; a dangling edge produces none. Callers
-- get the ambiguity handed to them and cannot accidentally read past it, which
-- a target_record_id column would not have done.
CREATE VIEW form_of_candidate AS
SELECT
  e.edge_id,
  e.record_id        AS from_record_id,
  e.json_pointer     AS edge_pointer,
  e.target_word,
  t.record_id        AS candidate_record_id,
  t.line_no          AS candidate_line_no,
  t.pos              AS candidate_pos
FROM form_of_edge e
JOIN lookup_form lf
  ON lf.release_id = e.release_id
 AND lf.surface_key = e.target_word_key
 AND lf.origin = 'headword'
JOIN source_record t
  ON t.record_id = lf.record_id;

-- Search results, flattened. `is_headword_hit` tells a caller whether the record
-- is about the surface or merely mentions it.
CREATE VIEW surface_hit AS
SELECT
  lf.release_id,
  lf.surface_key,
  lf.surface,
  lf.origin,
  lf.json_pointer,
  lf.form_source,
  r.record_id,
  r.line_no,
  r.word   AS record_word,
  r.pos    AS record_pos,
  (lf.origin = 'headword') AS is_headword_hit
FROM lookup_form lf
JOIN source_record r ON r.record_id = lf.record_id
JOIN source_release rel
  ON rel.release_id = lf.release_id AND rel.status = 'complete';
