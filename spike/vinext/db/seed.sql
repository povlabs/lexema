-- THROWAWAY spike schema. Not the real Lexema schema (issue #3 owns that).
-- Deliberately dumb: one flat table, fake data, no provenance, no normalisation.
DROP TABLE IF EXISTS spike_words;

CREATE TABLE spike_words (
  id       INTEGER PRIMARY KEY,
  lemma    TEXT NOT NULL,
  pos      TEXT NOT NULL,
  gloss    TEXT NOT NULL
);

CREATE INDEX idx_spike_words_lemma ON spike_words (lemma);

INSERT INTO spike_words (lemma, pos, gloss) VALUES
  ('casa',    'noun', 'FAKE SEED DATA - a house'),
  ('casa',    'verb', 'FAKE SEED DATA - third person of casare'),
  ('gatto',   'noun', 'FAKE SEED DATA - a cat'),
  ('mangiare','verb', 'FAKE SEED DATA - to eat'),
  ('libro',   'noun', 'FAKE SEED DATA - a book'),
  ('perché',  'adv',  'FAKE SEED DATA - why / because (accent round-trip check)');
