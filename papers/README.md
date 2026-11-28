# Papers

| Folder | Document | Venue and status |
| --- | --- | --- |
| [jcgt/](jcgt/README.md) | [Interactive ray tracing of stereographic Hopf tori](jcgt/paper.md) ([PDF](jcgt/manuscript.pdf)) | *Journal of Computer Graphics Techniques*. Review draft; not submitted. Graphics and numerics: exact intersection, charts through infinity, where float32 fails, higher precision and closed-form solving. |
| [technical-note/](technical-note/README.md) | [Technical note](technical-note/technical-note.md) ([PDF](technical-note/technical-note.pdf), [HTML](../web/technical-note.html)) | Supplement to the JCGT paper, with full derivations, implementation and experiments. Also published with the live site. |
| [jma/](jma/README.md) | [Glass Tori Through Infinity](jma/DRAFT1.md) | *Journal of Mathematics and the Arts*, Research Article. First draft, the main line for the mathematics-and-art paper. Figures not yet made. |
| [bridges/](bridges/OUTLINE.md) | [Glass Tori Through Infinity](bridges/DRAFT1.md) | Bridges conference. Alternative to the JMA version, which needs an in-person presenter; it overlaps heavily with JMA, so submit only one of them. |

The JCGT paper and the JMA paper are distinct: the first is about rendering and numerical accuracy, the second about the geometry and the images. Each cites the other.

Shared figures live in [technical-note/figures/](technical-note/figures/), where the note's HTML and LaTeX builds and `research/plot.py` expect them. The other papers refer to them there.

## Building

From the repository root:

```sh
python3 scripts/build-paper.py --pdf   # papers/jcgt/main.tex and manuscript.pdf
./scripts/build-note.sh                # web/technical-note.html
python3 scripts/build-latex.py         # papers/technical-note/main.tex
```

Then compile the technical note in `papers/technical-note/` with `pdflatex -halt-on-error main.tex` twice and copy `main.pdf` to `technical-note.pdf`. The Bridges and JMA drafts are Markdown for now; `pandoc DRAFT1.md -o draft.pdf` gives a quick preview.
