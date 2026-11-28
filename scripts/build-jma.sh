#!/bin/sh
# Build papers/jma/draft.pdf from the Markdown draft with pandoc and XeLaTeX.
# This is a reading copy; the submission will use the Taylor & Francis template.
set -eu
cd "$(dirname "$0")/../papers/jma"
pandoc DRAFT1.md --pdf-engine=xelatex \
  -V geometry:margin=1in -V fontsize=11pt -V colorlinks=true \
  -o draft.pdf
echo "Wrote papers/jma/draft.pdf"
