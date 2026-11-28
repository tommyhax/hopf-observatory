#!/usr/bin/env python3
"""Package an explicit committed revision reproducibly, without publishing."""

import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
TOP = {
    "README.md", "REVIEW.md", "LICENSE",
    "package.json", "package-lock.json", ".gitignore", ".prettierrc.json",
    ".prettierignore", ".clang-format", "playwright.config.js",
}
DIRECTORIES = {"web", "docs", "scripts", "tests", "research", "papers", ".github"}
TEMP_SUFFIXES = {".pyc", ".ppm", ".aux", ".log", ".out", ".toc", ".synctex", ".bbl", ".blg", ".brf"}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True, help="e.g. v0.1.0-review.4")
    parser.add_argument("--source", required=True, help="committed Git revision, e.g. HEAD")
    parser.add_argument("--output", type=Path, help="version directory; default release/<version>")
    args = parser.parse_args()
    if not re.fullmatch(r"v[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?", args.version):
        raise SystemExit("Invalid release version")
    commit = git("rev-parse", "--verify", f"{args.source}^{{commit}}").decode().strip()
    # Require the packaging implementation itself to belong to the source revision.
    if git("show", f"{commit}:scripts/package-release.py") != Path(__file__).read_bytes():
        raise SystemExit("Commit the intended packaging script before packaging")
    name = f"hopf-observatory-{args.version}"
    output = (args.output or ROOT / "release" / args.version).resolve()
    payloads, modes = {}, {}
    with tarfile.open(fileobj=io.BytesIO(git("archive", "--format=tar", commit))) as source:
        for item in source.getmembers():
            path = Path(item.name)
            if item.name not in TOP and path.parts[0] not in DIRECTORIES:
                continue
            if (path.name in {".DS_Store", "main.pdf"} or path.suffix in TEMP_SUFFIXES
                    or any(p in {"__pycache__", "node_modules", ".venv", ".cache"} for p in path.parts)):
                continue
            if item.isdir():
                continue
            if not item.isfile():
                raise SystemExit(f"Unsupported source entry: {item.name}")
            payloads[item.name] = source.extractfile(item).read()
            modes[item.name] = 0o100755 if item.mode & 0o111 else 0o100644
    required = TOP | {
        "papers/jcgt/paper.md", "papers/jcgt/manuscript.pdf",
        "papers/technical-note/technical-note.md", "papers/technical-note/technical-note.pdf",
        "papers/jma/DRAFT1.md", "papers/jma/draft.pdf", "web/shader.js",
        "scripts/verify-release.py", "docs/RELEASE_NOTES.md",
        "research/diagnostics/grazing/frozen-manifest.json",
        "research/diagnostics/algorithm1010/traversal/MANIFEST.json",
    }
    if required - payloads.keys():
        raise SystemExit(f"Missing required files: {sorted(required - payloads.keys())}")
    manifest = {
        "schemaVersion": 1,
        "version": args.version,
        "package": name,
        "sourceCommit": commit,
        "sourceTree": git("rev-parse", f"{commit}^{{tree}}").decode().strip(),
        "sourceCommitTime": git("show", "-s", "--format=%cI", commit).decode().strip(),
        "archiveFormat": "ZIP_STORED; sorted paths; fixed 1980 timestamp; Git executable modes",
        "files": {key: sha(value) for key, value in sorted(payloads.items())},
    }
    manifest_bytes = (json.dumps(manifest, indent=2) + "\n").encode()
    payloads["MANIFEST.json"] = manifest_bytes
    # Stored entries avoid differences between zlib versions. Most large evidence
    # is already compressed (PDF, PNG, RGBA gzip). Only committed bytes are read.
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_STORED) as target:
        for path, data in sorted(payloads.items()):
            info = zipfile.ZipInfo(f"{name}/{path}", date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = modes.get(path, 0o100644) << 16
            target.writestr(info, data)
    delivered = {
        f"{name}.zip": archive.getvalue(),
        "manuscript.pdf": payloads["papers/jcgt/manuscript.pdf"],
        "technical-note.pdf": payloads["papers/technical-note/technical-note.pdf"],
        "jma-draft.pdf": payloads["papers/jma/draft.pdf"],
        "MANIFEST.json": manifest_bytes,
        "RELEASE_NOTES.md": payloads["docs/RELEASE_NOTES.md"],
    }
    delivered["SHA256SUMS.txt"] = "".join(
        f"{sha(delivered[path])}  {path}\n"
        for path in ["manuscript.pdf", "technical-note.pdf", "jma-draft.pdf", f"{name}.zip"]
    ).encode()
    if output.exists():
        existing = {p.name: p.read_bytes() for p in output.iterdir() if p.is_file()}
        if existing != delivered or len(list(output.iterdir())) != len(delivered):
            raise SystemExit(f"Refusing to overwrite existing version with different content: {output}")
        print(f"Identical release already exists: {output}")
    else:
        output.parent.mkdir(parents=True, exist_ok=True)
        staging = Path(tempfile.mkdtemp(prefix=f".{name}-", dir=output.parent))
        try:
            for path, data in delivered.items():
                (staging / path).write_bytes(data)
            staging.rename(output)
        finally:
            if staging.exists():
                shutil.rmtree(staging)
    print(f"Source: {commit}\nFiles: {len(manifest['files'])}\nOutput: {output}")
    print(delivered["SHA256SUMS.txt"].decode(), end="")


if __name__ == "__main__":
    main()
