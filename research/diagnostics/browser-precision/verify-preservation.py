"""Verify the previous CPU experiment and inherited frozen numerical evidence."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
prior_path = HERE.parent / 'double-precision/results/analysis.json'
prior = json.loads(prior_path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


for name, expected in prior['hashes'].items():
    assert digest(ROOT / name) == expected, name
manifest = json.loads((HERE.parent / 'grazing/frozen-manifest.json').read_text())
differences = [{'path': name, 'historical': expected, 'current': digest(ROOT / name)}
               for name, expected in manifest['files'].items() if digest(ROOT / name) != expected]
assert all(row['path'] == 'web/technical-note.html' for row in differences)
assert len(differences) == len(prior['inheritedMismatches'])
report = {
    'priorSourceAndInputPathsVerified': len(prior['hashes']),
    'priorCPUAnalysisSHA256': digest(prior_path),
    'productionShaderSHA256': digest(ROOT / 'web/shader.js'),
    'inheritedDocumentationDifferences': differences,
    'protectedHashes': prior['hashes'],
    'passed': True,
}
(HERE / 'results/preservation.json').write_text(json.dumps(report, indent=2) + '\n')
print(f"Preserved {len(prior['hashes'])} prior source/input paths; production shader unchanged.")
