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
report = json.loads((root / 'fixtures/definition-loss-samples/report-lemma.json').read_text())
assert sum(p['human_label'] == 'definition' for p in report['affected_pages']) == report['definition_loss'] == 4
assert report['definition_loss_rate'] == round(4 / 396, 4)
assert not any('projected' in k for k in report)
print('Verified baseline and failures for missing records, glosses, examples, controls and translations; labels and count checked.')
