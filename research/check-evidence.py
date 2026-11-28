#!/usr/bin/env python3
"""Check recorded-source provenance without executing GPU work."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
PROVENANCE = ROOT / "research/provenance"
# Documents and build scripts revised or moved since a record was made are
# archived as research/provenance/<commit>/<path>. A recorded hash of such a
# file may match any archived edition or the current file; numerical sources
# and inputs still use current files only. See docs/RELEASE.md.
EDITIONS = {}
for edition in PROVENANCE.rglob("*"):
    if edition.is_file() and edition.name != ".DS_Store":
        name = Path(*edition.relative_to(PROVENANCE).parts[1:]).as_posix()
        EDITIONS.setdefault(name, []).append(edition)
reports = [
    ROOT / "docs/gpu-results.json",
    *sorted((ROOT / "research/results").glob("*.json")),
]
checked = 0
for path in reports:
    data = json.loads(path.read_text())
    hashes = data.get("hashes", data.get("sourceHashes", {}))
    for name, digest in hashes.items():
        source = (
            (ROOT / "research" / name)
            if path.name.startswith("webgl-")
            else ROOT / name
        )
        candidates = [source, *EDITIONS.get(name, [])]
        if not any(
            p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest() == digest
            for p in candidates
        ):
            raise SystemExit(
                f"Stale evidence: {path.relative_to(ROOT)} refers to changed {name}"
            )
        checked += 1
    if "shaderHash" in data:
        assert (
            data["shaderHash"]
            == hashlib.sha256((ROOT / "web/shader.js").read_bytes()).hexdigest()
        ), path
assert (
    hashlib.sha256((ROOT / "web/shader.js").read_bytes()).hexdigest()
    == "a81b18cb46201bd13822eed8dcab85e598ae8a131477ae1574584dff9492d2e3"
), "Frozen renderer changed"
reference = json.loads((ROOT / "research/results/stress-reference.json").read_text())
assert len(reference["cases"]) == 2400 and len(reference["shellGroups"]) == 100
exact = [c for c in reference["cases"] if c.get("exactTangent")]
assert len(exact) == 200 and all(
    any(r["multiplicity"] == 2 for r in c["idealReference"]["roots"]) for c in exact
)
benchmark = json.loads((ROOT / "research/results/renderer-benchmark.json").read_text())
for variant in ["production", "yuksel-direct", "yuksel-charts"]:
    report = (
        ROOT / "docs/gpu-results.json"
        if variant == "production"
        else ROOT / f"research/results/transport-{variant}.json"
    )
    data = json.loads(report.read_text())
    name = "bernstein-decreasing" if variant == "production" else variant
    assert (
        data["passed"]
        and data["shaderHashes"]["fragment"] == benchmark["shaderHashes"][name]
    )
    for study in ["stress-transport", "render-comparison"]:
        other = json.loads((ROOT / f"research/results/{study}.json").read_text())
        assert other["shaderHashes"][variant] == benchmark["shaderHashes"][name]
print(
    f"Checked {checked} source/input hashes, frozen shader, tangent fixtures and common measured variants."
)
