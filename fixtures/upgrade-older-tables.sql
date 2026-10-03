-- `hidden_record` and `recovered_definition` as the shared dictionary stored
-- them before #511: the CHECKs the issue quotes from a read-only sqlite_schema
-- read of `lexema-dictionary`. Each is src/db/schema.sql's text from before the
-- commit that widened it: `hidden_record` from 94e4e53^ (#415, which added
-- `form-of-foreign-lemma/v1` and `lemma_line`), `recovered_definition` from
-- 5ba5d5f^ (#320, which added the `wrapped-prose` route).

CREATE TABLE hidden_record (
  record_id  INTEGER PRIMARY KEY REFERENCES source_record(record_id) ON DELETE CASCADE,
  release_id TEXT    NOT NULL,
  page_id    INTEGER NOT NULL,

  -- The rule and its version (`SECTION_LANGUAGE_RULE`).
  rule       TEXT    NOT NULL CHECK (rule = 'section-language/v1'),
  -- 'language-line' -> a bare `{{-nl-}}` line stands above the block.
  -- 'late-heading'  -> the block's heading names another language,
  --                    `{{-sost-|en}}`, below the Italian translation box.
  because    TEXT    NOT NULL CHECK (because IN ('language-line', 'late-heading')),
  -- The language code the page names: 'nl', 'en', 'la'.
  language   TEXT    NOT NULL CHECK (language <> 'it' AND language <> ''),
  -- The 1-based line of the revision that names it.
  page_line  INTEGER NOT NULL CHECK (page_line > 0),

  FOREIGN KEY (record_id, release_id)
    REFERENCES source_record(record_id, release_id) ON DELETE CASCADE,
  FOREIGN KEY (page_id, release_id)
    REFERENCES raw_page(page_id, release_id) ON DELETE CASCADE
) STRICT;

CREATE TABLE recovered_definition (
  recovered_id     INTEGER PRIMARY KEY,
  record_id        INTEGER NOT NULL REFERENCES source_record(record_id) ON DELETE CASCADE,
  release_id       TEXT    NOT NULL,
  page_id          INTEGER NOT NULL,
  definition_index INTEGER NOT NULL CHECK (definition_index >= 0),

  route TEXT NOT NULL CHECK (route IN ('below-page-control', 'sub-term', 'lead-in-item')),
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
