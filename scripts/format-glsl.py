#!/usr/bin/env python3
"""Format the two GLSL template strings with clang-format, without changing JS."""
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parent.parent
path = ROOT / "web/shader.js"
source = path.read_text()


def format_shader(match):
    formatted = subprocess.run(
        ["clang-format", "--assume-filename=" + str(ROOT / "shader.cc")],
        input=match.group(2),
        text=True,
        capture_output=True,
        check=True,
    ).stdout.rstrip()
    return match.group(1) + formatted + match.group(3)


source, count = re.subn(
    r"(export const \w+ = `)(.*?)(`;)", format_shader, source, flags=re.S
)
if count != 2:
    raise SystemExit("Expected exactly two shader strings")
path.write_text(source)
