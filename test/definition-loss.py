"""Run with python3 test/definition-loss.py. No network or generated directories."""
import contextlib
import copy
import io
import json
import pathlib
import runpy
import types

root = pathlib.Path(__file__).resolve().parents[1]
m = runpy.run_path(str(root / 'tools/definition_loss.py'))
verify = m['cmd_verify']
cases_path = root / 'fixtures/definition-loss-regressions.json'
cases = json.loads(cases_path.read_text())
records = m['records_for']({c['word'] for c in cases})
args = types.SimpleNamespace(cases=str(cases_path))

def check(data, expected):
    verify.__globals__['records_for'] = lambda words: data
    with contextlib.redirect_stdout(io.StringIO()) as output:
        result = verify(args)
    assert result == expected, output.getvalue()

check(records, 0)
check({}, 1)
for field in ['glosses', 'examples']:
    changed = copy.deepcopy(records)
    for record in changed['informatica']:
        for sense in record['senses']:
            sense[field] = []
    check(changed, 1)
changed = copy.deepcopy(records)
changed['casa'][0]['senses'][0]['glosses'] = []
check(changed, 1)
changed = copy.deepcopy(records)
changed['lap steel guitar'][0]['senses'][0]['examples'][0].pop('translation')
check(changed, 1)
lap = next(c for c in cases if c['word'] == 'lap steel guitar')['sections'][0]
assert len(lap['definitions']) == 3 and lap['examples'] == []
assert {d['extractor_destination'] for d in lap['definitions']} == {'absent', 'examples[].text', 'examples[].translation'}
samples = root / 'fixtures/definition-loss-samples'
report = json.loads((samples / 'report-lemma.json').read_text())
inflected = json.loads((samples / 'report-inflected.json').read_text())
labels = json.loads((samples / 'hand-labels.json').read_text())

assert report['definition_loss'] == 12 and report['records_scored'] == 1189
assert report['records_flagged_by_heuristic'] == 15 and report['flags_rejected_by_review'] == 3
assert inflected['definition_loss'] == 0 and inflected['records_scored'] == 1000

for name, data in [('lemma', report), ('inflected', inflected)]:
    # The projection is only licensed while the numerator and the denominator
    # count the same thing. Both are records here; a page-level count projected
    # onto a record population is the error this replaced.
    assert data['measurement_unit'] == m['MEASUREMENT_UNIT'], name
    assert data['records_scored'] <= data['records_sampled'] <= data['stratum_population'], name
    assert len(data['confirmed_records']) == data['definition_loss'], name
    low, high = data['definition_loss_rate_ci95']
    assert data['definition_loss_rate'] == round(
        data['definition_loss'] / data['records_scored'], 5), name
    assert data['projected_records'] == round(
        data['definition_loss_rate'] * data['stratum_population']), name
    assert low <= data['definition_loss_rate'] <= high, name
    assert data['projected_records_ci95'] == [round(low * data['stratum_population']),
                                              round(high * data['stratum_population'])], name
    # Every record in the numerator was read by a person, who wrote down why.
    for entry in data['confirmed_records'] + data['rejected_flags']:
        assert entry['human_label'] and entry['reason'], (name, entry['word'])
        key = m['label_key'](entry['word'], entry['pos_title'])
        assert labels[key]['label'] == entry['human_label'], key
    assert all(e['human_label'] == 'definition' for e in data['confirmed_records']), name
    assert all(e['human_label'] != 'definition' for e in data['rejected_flags']), name

# A flag nobody has read must stop the command rather than quietly leave the
# numerator, in either direction.
empty_labels = root / 'build' / 'no-labels.json'
empty_labels.parent.mkdir(exist_ok=True)
empty_labels.write_text('{}')
try:
    with contextlib.redirect_stdout(io.StringIO()):
        m['cmd_classify'](types.SimpleNamespace(
            sample=str(samples / 'sample-lemma.json'), labels=str(empty_labels),
            out=str(root / 'build' / 'unused-report.json')))
except SystemExit as exc:
    assert 'unreviewed flags' in str(exc), exc
else:
    raise AssertionError('classify projected a rate from unreviewed flags')

print('Verified baseline and failures for missing records, glosses, examples, controls\n'
      'and translations; record-unit counts, hand labels and the projection checked.')
