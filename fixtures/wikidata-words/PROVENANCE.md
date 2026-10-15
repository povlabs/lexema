# Wikidata word fixtures (ADR 0033, #812)

Both files come from the Wikidata lexeme dump of 2026-10-07,
`wikidata-20261007-lexemes.json.gz` (653,077,837 bytes, SHA-256
`0623b19c27672b434f8600ce8331f6bc670168d268123550f5d2f8549c691d5f`), the dump
`PINNED_LEXEME_DUMP` in [src/wikidataWords/lexemeDump.ts](../../src/wikidataWords/lexemeDump.ts)
names. Wikidata's lexemes are CC0.

- `dump-lines.json`: three lines of the dump, verbatim, between the dump's own
  `[` and `]` lines: L1156607 *Chi cerca, trova* (a proverb, a category the
  table does not map), L1247138 *paralimpico* (no Italian gloss) and L1214279
  *orsetto* (a gloss in English only). The last line keeps the comma it has in
  the dump, where more lines follow it.
- `lexemes.jsonl`: five lexemes as `pnpm run wikidata-words:snapshot` writes
  them from the dump: L1144362 *papà*, L1165467 *ci*, L1247138 *paralimpico*,
  L1255218 *verbalizzare* and L1422655 *pentirsi*. Four are lines of the
  committed snapshot; *verbalizzare* is not, and is here because the declared
  lemma fixture (`fixtures/declared-lemmas.jsonl`) has it.
