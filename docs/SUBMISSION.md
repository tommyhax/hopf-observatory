# Manuscript metadata

- Title: *Interactive ray tracing of stereographic Hopf tori*
- Author: Tom Crosby
- Correspondence: twcrosbynz@gmail.com
- Repository: `git@github.com:tommyhax/hopf-observatory.git`
- Manuscript: `paper/manuscript.pdf` (short review paper); `technical-note/technical-note.pdf` (supplement)
- Editable source: `PAPER.md` and generated `paper/main.tex`; extended source `TECHNICAL_NOTE.md`
- Supplement: extended technical note, runnable application, figures, raw measurements, executable experiments and SHA-256 manifest
- Code licence: MIT; the Graphics Gems permission notice and Peters's CC0 attribution are retained

The note presents an implementation and reproducible numerical study. It claims no new Hopf geometry or universally robust polynomial solver. The assistance statement records Codex's contribution as an AI tool; Tom Crosby is responsible for the conclusions.

The article uses a standard single-column LaTeX format. A journal-specific edition should use the chosen venue's current template and author guidance. The experiments include an all-roots Yuksel–Peters comparison in centered and near/reciprocal coordinates, refinement ablation, and repeated full-render timings with transport checks. The final independent stress corpus is complete and records 109 grazing failures per modern variant; see `REVIEW.md` and `research/STRESS.md`. One GPU/compiler family remains a stated limitation. The artifact is prepared for outside review, not submitted.
