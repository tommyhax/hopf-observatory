#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Native MathML keeps the note readable without a CDN or math-rendering script.
pandoc TECHNICAL_NOTE.md --standalone --mathml --toc --toc-depth=2 \
  --css=note.css --output=web/technical-note.html
cp docs/note.css web/note.css
mkdir -p web/figures
cp technical-note/figures/*.png web/figures/
