"""Check the close-contact regression against exact uploaded incoming rays."""
from pathlib import Path
import hashlib
import json
import sys
import sympy as sp
import numpy as np

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
cpu_reference = roots(capture['P'], capture['high'], capture['paths']['paired'][0]['o'], capture['cpuD'])
gpu_reference = paths['paired'][0]['exactReferences']['high']
pair = [float(r['s']) for r in gpu_reference['roots']]
separation = pair[1]-pair[0] if len(pair)==2 else None
spacing = float(np.spacing(np.float32(pair[0]))) if pair else None
passed = (all(s['passed'] for s in paths['paired']) and len(pair)==2
          and separation < spacing and any(s['level']==capture['high'] for s in paths['paired']))
sources = [path, Path(__file__).resolve(), ROOT / 'research/reference.py']
report = {
    'sympy': sp.__version__, 'passed': passed,
    'pairSeparation': separation, 'float32SpacingAtContact': spacing,
    'finalPairedIntersections': actual,
    'legacyExpectedContact': next(h for h in capture['priorFailure']['expected'] if h['sign'] == 1),
    'exactHighBoundaryForCPUNormalizedRay': cpu_reference,
    'exactHighBoundaryForGPUNormalizedRay': gpu_reference,
    'paths': paths,
    'conclusion': 'The genuine contact is retained; every captured paired nearest hit and terminal miss matches exact arithmetic.' if passed else 'Close-contact regression remains unresolved.',
    'hashes': {**capture['hashes'], **{p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}},
}
(HERE / 'results/close-contact.json').write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['paths','hashes']},indent=2))
if not passed:
    raise SystemExit(1)
