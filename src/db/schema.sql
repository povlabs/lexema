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
  -- The archive does not carry these in its own bytes. The seed copies them
  -- from src/source/archiveFacts.ts, and only for the archive whose SHA-256
  -- they are keyed by; any other file leaves all of them NULL.
  source_url       TEXT,                    -- download URL, when known
  retrieved_at     TEXT,                    -- ISO-8601, when known
  -- The Wiktionary dump id, when known: `itwiktionary-YYYYMMDD`. Spelled out
  -- rather than as one GLOB, which D1 refuses as too complex.
  upstream_release TEXT
                   CHECK (length(upstream_release) = 21
                          AND substr(upstream_release, 1, 13) = 'itwiktionary-'
                          AND substr(upstream_release, 14) NOT GLOB '*[^0-9]*'),
  -- 'recorded' when kaikki's build names the dump, 'inferred' when it does not
  -- and the dump was reasoned to; the reasoning is in src/source/archiveFacts.ts.
  upstream_release_basis TEXT CHECK (upstream_release_basis IN ('recorded', 'inferred')),

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

  -- A half-imported release must never be served. Lookup queries read only the
  -- releases `served_release` names: a 'complete' one, and the feed releases
  -- it takes changes from. Direct table reads are import diagnostics only.
  -- 'partial' is a release only part of whose archive landed, though the
  -- checksum above describes the whole file, so it is never 'complete'. Either
  -- a seed run stopped early (a --limit smoke run), or the release is a feed
  -- (`feed_release`) whose chosen changes alone were applied.
  status           TEXT NOT NULL DEFAULT 'importing'
                   CHECK (status IN ('importing', 'partial', 'complete', 'failed', 'superseded')),

  -- What the run counted, written with the status flip at the end of the import.
  -- These are import metadata, not a cache of a query: lines the archive held,
  -- records admitted, and everything the run refused. A database can then be
  -- audited without the console output of the run that produced it.
  --
  --   lines_read = admitted + skipped_other_language + malformed_lines
  --
  -- malformed_members is not in that sum: it counts leaf values refused inside
  -- records that did land, so it says how much of an admitted record is missing.
  lines_read             INTEGER CHECK (lines_read >= 0),
  admitted               INTEGER CHECK (admitted >= 0),
  skipped_other_language INTEGER CHECK (skipped_other_language >= 0),
  malformed_lines        INTEGER CHECK (malformed_lines >= 0),
  malformed_members      INTEGER CHECK (malformed_members >= 0),

  -- The counts are written together or not at all, so 'not counted yet' is one
  -- state a reader can test for rather than five that can disagree.
  CHECK ((admitted IS NULL) = (lines_read IS NULL)),
  CHECK ((admitted IS NULL) = (skipped_other_language IS NULL)),
  CHECK ((admitted IS NULL) = (malformed_lines IS NULL)),
  CHECK ((admitted IS NULL) = (malformed_members IS NULL)),

  -- A dump is never stated without how it is known.
  CHECK ((upstream_release IS NULL) = (upstream_release_basis IS NULL))
) STRICT;

-- Rows the run wrote, one line per table it wrote them to. A table rather than
-- more columns on source_release, because the set of tables is the schema's and
-- it moves; a column per table would have to be migrated every time one is added.
CREATE TABLE release_table_rows (
  release_id TEXT    NOT NULL REFERENCES source_release(release_id) ON DELETE CASCADE,
  table_name TEXT    NOT NULL,
  rows       INTEGER NOT NULL CHECK (rows >= 0),
  PRIMARY KEY (release_id, table_name)
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

-- The records of one part of speech in line order, so a random pick of one
-- (`/v1/random?pos=`, src/lookup/random.ts) is two index probes, never a
-- scan. A pick with no part of speech walks UNIQUE (release_id, line_no).
CREATE INDEX source_record_by_pos
  ON source_record (release_id, pos, line_no);

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

-- What a search that found nothing offers instead (src/lookup/nearby.ts,
-- board 24). Both are written by the seed from the keys above, and both are
-- read by one indexed probe per request; neither is ever scanned.
--
-- The same letters with other accents: every distinct surface_key whose
-- accent-folded spelling (NFD, combining marks removed) differs from it, under
-- that folded spelling. `citta` finds `città`. Keys with no accent are left
-- out, since the exact lookup already found them.
CREATE TABLE accent_fold (
  release_id  TEXT    NOT NULL,
  fold_key    TEXT    NOT NULL,
  surface_key TEXT    NOT NULL,
  headword    INTEGER NOT NULL CHECK (headword IN (0, 1)),  -- some record's own headword
  languages   INTEGER NOT NULL CHECK (languages >= 0),      -- see typo_key
  richness    INTEGER NOT NULL CHECK (richness >= 0),       -- see typo_key
  PRIMARY KEY (release_id, fold_key, surface_key)
) STRICT, WITHOUT ROWID;

-- A spelling one edit away (SymSpell's deletion index): every distinct lemma
-- headword key (a record declaring no form_of) under itself and under each
-- spelling of it with one character left out. A query probes its own
-- deletions and itself; the candidates are then checked for a true distance
-- of one. Inflected forms are left out, so a typo leads to a base word.
CREATE TABLE typo_key (
  release_id   TEXT NOT NULL,
  deletion_key TEXT NOT NULL,
  surface_key  TEXT NOT NULL,
  -- How common the word is, as far as the source can say: the number of
  -- distinct languages its lemma records list translations in, then the
  -- senses plus forms those records carry. Among candidates the same number
  -- of edits away, the higher leads (`mangare` offers `mangiare`, 51
  -- languages, before `magnare`, none). 0 and 0 for a spelling only a form.
  languages    INTEGER NOT NULL CHECK (languages >= 0),
  richness     INTEGER NOT NULL CHECK (richness >= 0),
  PRIMARY KEY (release_id, deletion_key, surface_key)
) STRICT, WITHOUT ROWID;


-- ---------------------------------------------------------------------------
-- form_of edges
-- ---------------------------------------------------------------------------

-- A declared `senses[].form_of[]` edge, stored exactly as declared. In this file
-- every form_of array has length 1 and every entry has the single key `word`.
--
-- There is deliberately no target_record_id column. The source names a word, and
-- a word can have several records; noun `bella` points at `bello`, which is one
-- adjective record and two separate noun records. With no column to hold a
-- winner, storage preserves the unresolved declaration. Consumers must retain
-- all candidates; query 2a also preserves edges with no candidate.
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

-- Glosses are source text, never a Lexema definition: copied as written, except
-- for the source text normalizations of ADR 0019 (`normalizeGloss`), which
-- source_record_json never gets. 667 senses are
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
--                    One exception: the gloss grammar stamp rule
--                    (`it-gloss-stamp/v1`, src/import/grammarPolicy.ts, #317)
--                    states gender and number from a noun or adjective gloss
--                    that is a whole stamp line, like `casa ( approfondimento)
--                    f sing`, when the record has no gender tag.
--   'unclassified'-> the source gave text the importer cannot map. The literal
--                    text is kept; no value is guessed. e.g. raw_tags 'pl.: case'
--                    on `casa`, 'lui/lei' on a `salire` form.
--   'missing'     -> the importer looked for a dimension it expects here and the
--                    source gave nothing. e.g. `casa` at line 1 has no `tags` at
--                    all, so both gender and number are missing, and no form in
--                    this entire file carries a structural mood — `parlerei` at
--                    line 37 /forms/53 is tagged only 'present', with the
--                    conditional stated in prose on a different record.
--                    `città` at line 31998 is NOT a missing case: it is tagged
--                    ['feminine', 'invariable'], so number is 'stated' with the
--                    value 'invariable'. A stated value can still be unusable —
--                    no article agrees with 'invariable' — but that is a gap in
--                    the article rule, not a missing claim.
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

  -- For 'stated'/'unclassified': the exact tag, or for a gloss grammar stamp
  -- the gloss that carried it (`/senses/0/glosses/0`). For 'missing': the
  -- container that should have carried it ('' for the whole record).
  json_pointer TEXT NOT NULL,

  status TEXT NOT NULL CHECK (status IN ('stated', 'unclassified', 'missing')),

  dimension TEXT,
  value     TEXT,

  -- The literal source text behind the claim, kept so an 'unclassified' row is
  -- still usable evidence and a 'stated' row can be audited against its tag,
  -- or against the stamp (`f sing`) for a gloss grammar stamp.
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
-- verbatim, and a review is data stored beside the claim it judges. The result
-- page does not show reviews (data-only ruling, 2026-09-27; see docs/WEB.md).
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
-- The app database's tables
-- ---------------------------------------------------------------------------

-- Developer accounts, provider identities, sessions, API keys, their usage and
-- reader reports are not defined here. They live in the app database, never in
-- this one, which code only reads (ADR 0018). They are defined in Drizzle
-- (src/db/app/schema.ts, ADR 0017) and built by drizzle-kit's migrations in
-- src/db/app/migrations, which `pnpm run seed:dev` applies to the local APP_DB.


-- ---------------------------------------------------------------------------
-- Recovered definitions (#28)
-- ---------------------------------------------------------------------------

-- Definitions a raw Wiktionary page states that its archive record does not
-- carry. Wiktextract sends every `#*` line to its example reader, which keeps
-- italic runs only, so a plain-prose definition written one level below `#` is
-- dropped: `casa` keeps two page notes and loses all seven of its definitions
-- (reports/2026-09-18-definition-loss.md, reports/2026-09-23-recovered-definitions.md).
--
-- This is a layer beside the record, never an edit of it. source_record_json
-- and the sense tables stay exactly as imported; a recovered row points at its
-- record and names its own source, the page revision and line it was read
-- from, so a reader can always tell the two apart. The text is Wiktionary's own
-- words, under the same licence as the archive.

-- One revision of one raw page that at least one recovered row was read from.
CREATE TABLE raw_page (
  page_id     INTEGER PRIMARY KEY,
  release_id  TEXT    NOT NULL REFERENCES source_release(release_id) ON DELETE CASCADE,
  wiki        TEXT    NOT NULL CHECK (wiki = 'it.wiktionary.org'),
  title       TEXT    NOT NULL,
  revision_id INTEGER NOT NULL CHECK (revision_id > 0),
  revision_timestamp TEXT NOT NULL,  -- ISO-8601, as the wiki reported it
  UNIQUE (release_id, wiki, title),
  UNIQUE (page_id, release_id)
) STRICT;

-- One definition read off a raw page for one record, in page order.
--
-- `route` is which structure marked the line a definition (src/italian/wikitext.ts):
--   'below-page-control' -> one level below a `#` line that carries only the
--                           headword and its grammar (`casa`).
--   'sub-term'           -> opened by a bold sub-term, then prose
--                           (`#*'''liceo classico''', indirizzo...`); `term` holds it.
--   'lead-in-item'       -> an item of a list a definition opens with a colon.
--   'wrapped-prose'      -> the prose line right after a `#` line that carries
--                           only page controls and labels (`verde`).
CREATE TABLE recovered_definition (
  recovered_id     INTEGER PRIMARY KEY,
  record_id        INTEGER NOT NULL REFERENCES source_record(record_id) ON DELETE CASCADE,
  release_id       TEXT    NOT NULL,
  page_id          INTEGER NOT NULL,
  definition_index INTEGER NOT NULL CHECK (definition_index >= 0),

  route TEXT NOT NULL CHECK (route IN ('below-page-control', 'sub-term', 'lead-in-item', 'wrapped-prose')),
  term  TEXT,

  page_line INTEGER NOT NULL CHECK (page_line > 0),  -- 1-based line in the revision
  wikitext  TEXT    NOT NULL,                        -- that line, verbatim
  text      TEXT    NOT NULL,                        -- as a reader sees it

  -- The JSON pointer of the record's example that carries this text, when the
  -- record files it as an example rather than a definition (`lap steel guitar`:
  -- `/senses/0/examples/0/text`). The record keeps it there; a page shows it
  -- once, as this definition. NULL when no example carries it.
  held_as_example TEXT CHECK (held_as_example GLOB '/senses/[0-9]*/examples/[0-9]*/text'),

  -- The definition whose list this line is an item of, when it sits below a line
  -- ending in a colon (#123): `accollato`'s `#*` items under `# attributo araldico
  -- che si applica a:`. The page's layout decides it, not the item's wording. The
  -- lead-in is either a sense the record carries, matched by a gloss equal to its
  -- line's text, or a definition recovered before this one from the same page;
  -- both NULL for a definition at the top of the list or a lead-in not matched.
  lead_in_sense_index  INTEGER,
  lead_in_recovered_id INTEGER,

  CHECK ((route = 'sub-term') = (term IS NOT NULL)),
  CHECK (lead_in_sense_index IS NULL OR lead_in_recovered_id IS NULL),
  CHECK (lead_in_recovered_id < recovered_id),
  UNIQUE (record_id, definition_index),
  UNIQUE (recovered_id, record_id),
  FOREIGN KEY (record_id, lead_in_sense_index)
    REFERENCES sense(record_id, sense_index) ON DELETE CASCADE,
  -- A lead-in recovered for another record is not this record's list.
  FOREIGN KEY (lead_in_recovered_id, record_id)
    REFERENCES recovered_definition(recovered_id, record_id) ON DELETE CASCADE,
  FOREIGN KEY (record_id, release_id)
    REFERENCES source_record(record_id, release_id) ON DELETE CASCADE,
  -- The page must belong to the record's release.
  FOREIGN KEY (page_id, release_id)
    REFERENCES raw_page(page_id, release_id) ON DELETE CASCADE
) STRICT;

CREATE INDEX recovered_definition_by_record ON recovered_definition (record_id);

-- Usage labels a recovered line's templates print (`architettura`, `figurato`).
CREATE TABLE recovered_label (
  recovered_id INTEGER NOT NULL REFERENCES recovered_definition(recovered_id) ON DELETE CASCADE,
  label_index  INTEGER NOT NULL CHECK (label_index >= 0),
  label        TEXT    NOT NULL,
  PRIMARY KEY (recovered_id, label_index)
) STRICT;

-- The italic usage sentences one level below a recovered definition.
CREATE TABLE recovered_example (
  recovered_id  INTEGER NOT NULL REFERENCES recovered_definition(recovered_id) ON DELETE CASCADE,
  example_index INTEGER NOT NULL CHECK (example_index >= 0),
  page_line     INTEGER NOT NULL CHECK (page_line > 0),
  wikitext      TEXT    NOT NULL,
  text          TEXT    NOT NULL,
  PRIMARY KEY (recovered_id, example_index)
) STRICT;


-- ---------------------------------------------------------------------------
-- Changes applied from a later release (#18)
-- ---------------------------------------------------------------------------

-- The dictionary database is the master: the release it was seeded from, plus
-- the changes chosen from later kaikki releases. A later release is a feed,
-- never a replacement. Only the records of the changes chosen from it are
-- written, each as a record of its own release, through the same import path
-- as a seed. Nothing else is written, and no row of the master is deleted
-- except the index rows of a record a change takes over from (below).
-- docs/UPDATES.md explains the design; docs/UPDATE_THE_DICTIONARY.md is the
-- runbook. An older master gets these tables and views from the apply itself
-- (src/update/masterUpgrade.ts), which reads them out of this file.

-- A later release changes were applied from, and the master it feeds. Its
-- `source_release` row is 'partial': its checksum names the whole archive, and
-- only the chosen records landed.
CREATE TABLE feed_release (
  release_id        TEXT PRIMARY KEY REFERENCES source_release(release_id),
  master_release_id TEXT NOT NULL REFERENCES source_release(release_id),
  CHECK (release_id <> master_release_id)
) STRICT;

-- One change applied to the master, under the id the diff report gave it.
--
--   'new'     -> the feed's record of a (word, pos) the master did not hold.
--   'changed' -> the feed's record of a (word, pos) the master held one record
--                of, with different content. The master's record is retired:
--                its lookup_form and form_of_edge rows go, so no search reaches
--                it, and every other row of it stays. The rows written by hand
--                beside it (recovered_*, claim_review) stay attached to it, and
--                a lookup reads them through this row for the record that
--                replaced it.
--
-- A lost record is reported, never applied: removing one is not ruled (#18).
CREATE TABLE applied_change (
  -- 'new-' or 'chg-' and twelve hex digits: src/update/changes.ts.
  change_id          TEXT    PRIMARY KEY
                     CHECK (length(change_id) = 16 AND substr(change_id, 5) NOT GLOB '*[^0-9a-f]*'),
  release_id         TEXT    NOT NULL REFERENCES feed_release(release_id),
  kind               TEXT    NOT NULL CHECK (kind IN ('new', 'changed')),
  record_id          INTEGER NOT NULL UNIQUE,
  replaced_record_id INTEGER UNIQUE REFERENCES source_record(record_id),
  applied_at         TEXT    NOT NULL,  -- ISO-8601

  CHECK ((kind = 'new') = (replaced_record_id IS NULL)),
  -- No CASE here: wrangler's statement splitter closes a CASE only on an END
  -- followed by whitespace or ';', so `END)` swallows every later statement.
  CHECK ((kind = 'new' AND substr(change_id, 1, 4) = 'new-')
      OR (kind = 'changed' AND substr(change_id, 1, 4) = 'chg-')),
  CHECK (replaced_record_id <> record_id),
  -- The record the change wrote is a record of the release it came from.
  FOREIGN KEY (record_id, release_id) REFERENCES source_record(record_id, release_id)
) STRICT;


-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- The releases a master serves rows from, keyed by the master: the 'complete'
-- release it was seeded from, and every feed of it. `LEXEMA_RELEASE` names the
-- master. Every serving read keys on this view rather than on one release_id,
-- so the record a change wrote is found beside the records it did not touch.
CREATE VIEW served_release AS
SELECT m.release_id AS master_release_id, m.release_id
FROM source_release m
WHERE m.status = 'complete'
UNION ALL
SELECT f.master_release_id, f.release_id
FROM feed_release f
JOIN source_release m ON m.release_id = f.master_release_id AND m.status = 'complete'
JOIN source_release fr ON fr.release_id = f.release_id AND fr.status = 'partial';

-- The records a master serves: those of its served releases that no applied
-- change took over from. The diff compares a later release with exactly these.
CREATE VIEW served_record AS
SELECT
  s.master_release_id,
  r.record_id,
  r.release_id,
  r.line_no,
  r.line_sha256,
  r.word,
  r.pos,
  r.pos_title
FROM source_record r
JOIN served_release s ON s.release_id = r.release_id
WHERE NOT EXISTS (SELECT 1 FROM applied_change a WHERE a.replaced_record_id = r.record_id);

-- Every candidate record a form_of edge could mean, one row per candidate. An
-- ambiguous edge produces several rows; a dangling edge produces none. Callers
-- must retain every candidate rather than selecting a winner. Only served
-- releases are visible, and an edge finds candidates in every release of its
-- own master; query 2a also retains dangling edges.
CREATE VIEW form_of_candidate AS
SELECT
  e.edge_id,
  e.record_id        AS from_record_id,
  e.json_pointer     AS edge_pointer,
  e.target_word,
  t.record_id        AS candidate_record_id,
  t.release_id       AS candidate_release_id,
  t.line_no          AS candidate_line_no,
  t.pos              AS candidate_pos
FROM form_of_edge e
JOIN served_release se ON se.release_id = e.release_id
JOIN served_release sc ON sc.master_release_id = se.master_release_id
JOIN lookup_form lf
  ON lf.release_id = sc.release_id
 AND lf.surface_key = e.target_word_key
 AND lf.origin = 'headword'
JOIN source_record t
  ON t.record_id = lf.record_id;

-- Search results, flattened. `is_headword_hit` tells a caller whether the record
-- is about the surface or merely mentions it. `release_id` is the record's own
-- release, which its `line_no` counts in.
CREATE VIEW surface_hit AS
SELECT
  s.master_release_id,
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
JOIN served_release s ON s.release_id = lf.release_id;
