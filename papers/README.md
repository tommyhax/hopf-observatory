# Papers

| Folder | Document | Venue and status |
| --- | --- | --- |
| [jma/](jma/README.md) | [Glass Tori Through Infinity](jma/DRAFT1.md) ([PDF](jma/draft.pdf)) | *Journal of Mathematics and the Arts*, Research Article. **Current focus.** First draft; figures not yet made. The geometry and the images. |
| [jcgt/](jcgt/README.md) | [Interactive ray tracing of stereographic Hopf tori](jcgt/paper.md) ([PDF](jcgt/manuscript.pdf)) | *Journal of Computer Graphics Techniques*. **On hold.** Review draft; not submitted. Graphics and numerics: intersection without tessellation, charts through infinity, where float32 fails, higher precision and closed-form solving. |
| [technical-note/](technical-note/README.md) | [Technical note](technical-note/technical-note.md) ([PDF](technical-note/technical-note.pdf), [HTML](../web/technical-note.html)) | Full derivations, implementation and experiments, published with the live site. Written as the supplement to the JCGT paper; the JMA draft cites it for the numerics. |

The JMA and JCGT papers are distinct: the first is about the geometry and the images, the second about rendering and numerical accuracy. The JMA draft cites the technical note, not the JCGT manuscript, for the numerical details; the JCGT manuscript does not cite the JMA paper.

Shared figures live in [technical-note/figures/](technical-note/figures/), where the note's HTML and LaTeX builds and `research/plot.py` expect them. The other papers refer to them there.

## Building

All three are built from the repository root:

```sh
./scripts/build-jma.sh                 # papers/jma/draft.pdf (pandoc and XeLaTeX)
python3 scripts/build-paper.py --pdf   # papers/jcgt/main.tex and manuscript.pdf
./scripts/build-note.sh                # web/technical-note.html
python3 scripts/build-latex.py         # papers/technical-note/main.tex
```

The JMA PDF is a reading copy of the Markdown draft; the submission will use the Taylor & Francis template.

Then compile the technical note in `papers/technical-note/` with `pdflatex -halt-on-error main.tex` twice and copy `main.pdf` to `technical-note.pdf`.
