# LaTeX edition

`main.tex` is a standalone article generated from `../TECHNICAL_NOTE.md`. `technical-note.pdf` is the compiled illustrated edition. Equations, references, numerical results and figures are included; interactive WebGL runs in the browser. Start the application with `npm start` from the project root.

To regenerate the LaTeX source, run from the project root:

```sh
python3 scripts/build-latex.py
```

This requires Pandoc and overwrites `main.tex`. Maintain the Markdown and generator together so the HTML and PDF editions agree.

Compile from this directory with a standard TeX distribution:

```sh
pdflatex -interaction=nonstopmode -halt-on-error main.tex
pdflatex -interaction=nonstopmode -halt-on-error main.tex
cp main.pdf technical-note.pdf
```

The document uses the included `figures/` directory and standard LaTeX packages. No network access or external bibliography database is needed to compile. Bibliographic and local-demo links remain clickable in the PDF.
