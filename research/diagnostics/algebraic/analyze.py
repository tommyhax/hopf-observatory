"""Analyze the isolated Ferrari coordinate/tolerance experiment."""

from pathlib import Path
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "research"))
from analyze import match, aggregate


def main():
    gpu_path = HERE / "results/gpu.json"
    gpu = json.loads(gpu_path.read_text())
    for name, digest in gpu["hashes"].items():
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest, name
    report = {"tolerance": 1e-4, "corpora": {}, "replayMismatches": []}
    for corpus, reference_name, old_name in [
        ("original", "reference.json", "pole-gpu.json"),
        ("stress", "stress-reference.json", "stress-gpu.json"),
    ]:
        reference = json.loads((ROOT / "research/results" / reference_name).read_text())
        old = json.loads((ROOT / "research/results" / old_name).read_text())
        for name, digest in old["hashes"].items():
            assert (
                hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest
            ), name
        assert len(reference["cases"]) == len(gpu["results"][corpus])
        previous = {row["id"]: row for row in old["results"]}
        rows = []
        for case, actual in zip(reference["cases"], gpu["results"][corpus]):
            assert case["id"] == actual["id"]
            expected = [float(root["s"]) for root in case["reference"]["roots"]]
            row = {"id": case["id"], "family": case["family"]}
            for method in gpu["methods"]:
                name = method["id"]
                row[name] = {
                    stage: match(expected, actual[name][stage])
                    for stage in gpu["stages"]
                }
            rows.append(row)
            replay = [("bernstein", "compactified")]
            if corpus == "original":
                replay.append(("ferrari_direct", "ferrari"))
            for name, old_method in replay:
                for stage in gpu["stages"]:
                    values = lambda xs: sorted(
                        xs, key=lambda x: float("inf") if x is None else x
                    )
                    if values(actual[name][stage]) != values(
                        previous[case["id"]][old_method][stage]
                    ):
                        report["replayMismatches"].append(
                            [corpus, case["id"], name, stage]
                        )
        summary = {}
        for family in ["all", *sorted({row["family"] for row in rows})]:
            selected = (
                rows
                if family == "all"
                else [row for row in rows if row["family"] == family]
            )
            summary[family] = {
                method["id"]: {
                    stage: aggregate(selected, method["id"], stage)
                    for stage in gpu["stages"]
                }
                for method in gpu["methods"]
            }
        report["corpora"][corpus] = {
            "summary": summary,
            "failedIds": {
                method["id"]: {
                    stage: [
                        row["id"] for row in rows if row[method["id"]][stage]["failed"]
                    ]
                    for stage in gpu["stages"]
                }
                for method in gpu["methods"]
            },
        }
        for method in gpu["methods"]:
            name = method["id"]
            for stage in gpu["stages"]:
                item = summary["all"][name][stage]
                print(
                    f'{corpus:8} {name:28} {stage:8} {item["failedRays"]}/{item["rays"]} failed; '
                    f'{item["matchedRoots"]}/{item["expectedRoots"]} matched; {item["falseRoots"]} extra'
                )
    report["hashes"] = {
        str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in [
            Path(__file__).resolve(),
            ROOT / "research/analyze.py",
            gpu_path,
            ROOT / "research/results/pole-gpu.json",
            ROOT / "research/results/stress-gpu.json",
        ]
    }
    (HERE / "results/analysis.json").write_text(
        json.dumps(report, indent=2, allow_nan=False) + "\n"
    )
    print("Replay mismatches:", len(report["replayMismatches"]))
    print(
        "Polynomial checks:",
        sum(row["pass"] for row in gpu["sanity"]),
        "/",
        len(gpu["sanity"]),
    )


if __name__ == "__main__":
    main()
