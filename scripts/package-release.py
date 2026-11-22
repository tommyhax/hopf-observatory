#!/usr/bin/env python3
"""Package this local working revision reproducibly; never publishes anything."""

from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parent.parent
NAME = "hopf-observatory-2026-11-22-grazing-diagnostic"
OUT = ROOT / "release"
OUT.mkdir(exist_ok=True)
TOP = [
    "README.md",
    "TECHNICAL_NOTE.md",
    "PAPER.md",
    "REVIEW.md",
    "LICENSE",
    "package.json",
    "package-lock.json",
    ".gitignore",
    ".prettierrc.json",
    ".prettierignore",
    ".clang-format",
    "playwright.config.js",
]
DIRECTORIES = [
    "web",
    "docs",
    "scripts",
    "tests",
    "research",
    "technical-note",
    "paper",
    ".github",
]
OMIT = {".DS_Store"}
TEMP_SUFFIXES = {
    ".pyc",
    ".ppm",
    ".aux",
    ".log",
    ".out",
    ".toc",
    ".synctex",
    ".bbl",
    ".blg",
    ".brf",
}

files = [ROOT / name for name in TOP]
for directory in DIRECTORIES:
    files.extend(
        p
        for p in (ROOT / directory).rglob("*")
        if p.is_file()
        and p.name not in OMIT
        and p.suffix not in TEMP_SUFFIXES
        and "__pycache__" not in p.parts
        and p.name != "main.pdf"
    )
files = sorted(set(files))
payloads = {p.relative_to(ROOT).as_posix(): p.read_bytes() for p in files}
manifest = {
    "release": NAME,
    "revision": "SHA-256 of every packaged file",
    "files": {
        name: hashlib.sha256(data).hexdigest() for name, data in payloads.items()
    },
}
manifest_bytes = (json.dumps(manifest, indent=2) + "\n").encode()
(OUT / "MANIFEST.json").write_bytes(manifest_bytes)
payloads["MANIFEST.json"] = manifest_bytes
archive = OUT / f"{NAME}.zip"
with zipfile.ZipFile(
    archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9
) as z:
    for name, data in sorted(payloads.items()):
        info = zipfile.ZipInfo(f"{NAME}/{name}", date_time=(2026, 11, 22, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.create_system = 3
        executable = (ROOT / name).exists() and bool(
            (ROOT / name).stat().st_mode & 0o111
        )
        info.external_attr = (0o100755 if executable else 0o100644) << 16
        z.writestr(info, data)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(OUT / "SHA256SUMS").write_text(f"{digest}  {archive.name}\n")
print(f"Packaged {len(files)} files: {archive}\nSHA-256: {digest}")
