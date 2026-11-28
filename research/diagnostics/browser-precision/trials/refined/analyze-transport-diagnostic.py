"""Independently adjudicate the legacy shell reference using exact uploaded rays."""
from pathlib import Path
import hashlib
import json
import sys
import sympy as sp

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'research'))
from reference import roots

path = HERE / 'results/transport-diagnostic.json'
capture = json.loads(path.read_text())
for p, expected in capture['hashes'].items():
    assert hashlib.sha256((ROOT / p).read_bytes()).hexdigest() == expected, p

paths = {}
for name, states in capture['paths'].items():
    checked = []
    for state in states:
        references = {side: roots(capture['P'], capture[side], state['o'], state['d'])
                      for side in ['low', 'high']}
        candidates = sorted((float(root['s']), capture[side], side)
                            for side, ref in references.items() for root in ref['roots']
                            if float(root['s']) > state['minS'])
        nearest = candidates[0] if candidates else None
        error = None if nearest is None else abs(state['s'] - nearest[0]) / max(1, abs(nearest[0]))
        passed = state['s'] < 0 if nearest is None else (
            state['s'] > 0 and state['level'] == nearest[1] and error <= 1e-4)
        checked.append({**state, 'exactReferences': references, 'nearest': nearest,
                        'relativeError': error, 'passed': passed})
    paths[name] = checked

actual = [{'s': s['total'] + s['s'], 'level': s['level'], 'sign': s['normalSign'], 'id': s['id']}
          for s in capture['paths']['paired'] if s['s'] >= 0 and s['total'] + s['s'] < 1e7]
same_outputs = actual == capture['priorFailure']['actual']
cpu_reference = roots(capture['P'], capture['high'], capture['paths']['paired'][0]['o'], capture['cpuD'])
gpu_reference = paths['paired'][0]['exactReferences']['high']
adjudicated = (same_outputs and all(s['passed'] for s in paths['paired'])
               and len(cpu_reference['roots']) == 0 and len(gpu_reference['roots']) == 0)
sources = [path, Path(__file__).resolve(), ROOT / 'research/reference.py']
report = {
    'sympy': sp.__version__, 'adjudicated': adjudicated,
    'diagnosticReproducesPriorPairedOutputsExactly': same_outputs,
    'legacyExpectedContact': next(h for h in capture['priorFailure']['expected'] if h['sign'] == 1),
    'exactHighBoundaryForCPUNormalizedRay': cpu_reference,
    'exactHighBoundaryForGPUNormalizedRay': gpu_reference,
    'paths': paths,
    'conclusion': 'Legacy CPU helper supplies a false tangency; paired output is correct on every captured incoming ray.' if adjudicated else 'Unresolved; do not waive the legacy suite mismatch.',
    'hashes': {**capture['hashes'], **{p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}},
}
(HERE / 'results/transport-adjudication.json').write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['paths','hashes']},indent=2))
if not adjudicated:
    raise SystemExit(1)
