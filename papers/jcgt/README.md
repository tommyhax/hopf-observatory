# Canonical JCGT review manuscript

Edit the prose in [`paper.md`](paper.md) and the bibliography in [`references.bib`](references.bib). `main.tex` is generated; `manuscript.pdf` is the canonical review PDF. The extended [technical note](../technical-note/technical-note.pdf) is the supplement, with the full derivation, implementation and experiments. This is a local draft, not a submitted or accepted article, and it is on hold while the [JMA paper](../jma/README.md) is prepared.

From the repository root:

```sh
python3 scripts/build-paper.py --pdf
```

This requires Pandoc and a LaTeX installation with `pdflatex`, `bibtex` and the packages used by the JCGT class. It generates the LaTeX, runs BibTeX with `jcgt.bst`, resolves citations and cross-references, and writes `papers/jcgt/manuscript.pdf`. Intermediate files are temporary. Omit `--pdf` to regenerate only `main.tex`.

The build uses the official class, title/teaser layout, typography and author-year bibliography. The local header explicitly says “not submitted”; publication dates, volume, issue, editor and journal licence footer are not fabricated. Those fields belong to a later accepted edition. No affiliation or ORCID has been inferred.

## Template provenance

`jcgt.cls` and `jcgt.bst` are unmodified files from the [official JCGT template](https://jcgt.org/files/jcgt-template.zip), downloaded 22 November 2026. The [author guidance](https://jcgt.org/write.html) labels that distribution as updated 6 August 2025. Template files are third-party journal assets, not original Hopf Observatory software; retain this provenance when redistributing them.

| File | SHA-256 |
|---|---|
| Downloaded ZIP | `75494a4ec9a158e72a4443aa94c5b25990cb87f3790efba24110881a204f453f` |
| `jcgt.cls` | `91135b2c44815575e8f4c7a202df0d8b5ac59f52a847b391647459d43ba81330` |
| `jcgt.bst` | `3b1579488bb490a827fa02a2ef293c00779736a9fd3e297afb6f949b564cb12e` |

The upstream example PDF, sample article, sample bibliography and images are not part of this manuscript. Figures are generated from this project's renderer and measurements. See [`docs/SUBMISSION.md`](../../docs/SUBMISSION.md) for venue guidance and editorial scope.
