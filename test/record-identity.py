"""Run with python3 test/record-identity.py; SQLite serving-read regression."""
import pathlib
import sqlite3

root = pathlib.Path(__file__).resolve().parents[1]
db = sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys = ON')
db.executescript((root / 'src/db/schema.sql').read_text())
db.execute("""INSERT INTO source_release
    (release_id, source_name, archive_r2_key, archive_sha256, archive_bytes,
     normalizer, importer_version, schema_version)
    VALUES ('test', 'synthetic', 'test', 'test', 1, 'test', 'test', 1)""")
for n, word in [(1, 'form'), (2, 'target')]:
    db.execute("INSERT INTO source_record VALUES (?, 'test', ?, 'test', ?, 'noun', 'noun', 'it')", (n, n, word))
    db.execute("INSERT INTO lookup_form (record_id, release_id, origin, surface, surface_key, json_pointer) VALUES (?, 'test', 'headword', ?, ?, '/word')", (n, word, word))
db.execute("INSERT INTO form_of_edge VALUES (1, 1, 'test', 0, 0, '/senses/0/form_of/0/word', 'target', 'target')")
db.execute("INSERT INTO form_of_edge VALUES (2, 1, 'test', 0, 1, '/senses/0/form_of/1/word', 'dangling', 'dangling')")
db.execute("INSERT INTO source_record_json VALUES (1, '{}')")
db.execute("INSERT INTO sense VALUES (1, 1, 0, '/senses/0')")
db.execute("INSERT INTO sense_gloss VALUES (1, 1, 0, 'test', '/senses/0/glosses/0')")
db.execute("INSERT INTO sense_label VALUES (1, 1, 0, 'tag', 'test', '/senses/0/tags/0')")
db.execute("INSERT INTO grammar_claim VALUES (1, 1, 'record', NULL, '', 'missing', 'gender', NULL, NULL)")
db.execute("INSERT INTO claim_review VALUES (1, 1, '/word', 'disputed', 'test', 'https://example.org', 'test', 'test')")
sql = '\n'.join(line for line in (root / 'src/db/queries.sql').read_text().splitlines() if not line.lstrip().startswith('--'))
queries = [q for q in sql.split(';') if 'SELECT' in q]
# Every serving read must hide incomplete data, even when called by record id.
for status in ['importing', 'failed', 'superseded']:
    db.execute('UPDATE source_release SET status = ?', (status,))
    assert db.execute('SELECT * FROM surface_hit').fetchall() == []
    assert db.execute('SELECT * FROM form_of_candidate').fetchall() == [], status
    for query in queries:
        for record_id in [1, 2]:
            assert db.execute(query, {'release': 'test', 'key': 'form', 'record_id': record_id}).fetchall() == [], (status, query)
# A second target arrives before promotion; neither may be silently selected.
db.execute("INSERT INTO source_record VALUES (3, 'test', 3, 'test', 'target', 'noun', 'noun', 'it')")
db.execute("INSERT INTO lookup_form (record_id, release_id, origin, surface, surface_key, json_pointer) VALUES (3, 'test', 'headword', 'target', 'target', '/word')")
db.execute("UPDATE source_release SET status = 'complete'")
assert len(db.execute('SELECT * FROM form_of_candidate').fetchall()) == 2
public = db.execute(queries[2], {'record_id': 1}).fetchall()
assert len(public) == 3 and public[-1][3] is None, public
for query in queries:
    assert any(db.execute(query, {'release': 'test', 'key': 'form', 'record_id': n}).fetchall() for n in [1, 2]), query
assert db.execute('PRAGMA foreign_key_check').fetchall() == []
print('Serving reads hide incomplete releases; complete reads retain ambiguity and dangling edges.')
