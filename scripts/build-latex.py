#!/usr/bin/env python3
"""Generate the editable LaTeX edition of papers/technical-note/technical-note.md (requires Pandoc)."""
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parent.parent
note = root / "papers" / "technical-note"
source = (note / "technical-note.md").read_text()
source = re.sub(r"^---\n.*?\n---\n", "", source, count=1, flags=re.S)
source = re.sub(r'<div class="demo-block">.*?</div>', "", source, flags=re.S)
source = source.replace(
    "The note's rendered equations use native MathML and require no external mathematics service.",
    "The browser edition includes the interactive demo. This PDF links to that local edition; the interactive renderer runs in the browser, not inside the PDF.",
)
source = source.replace("S³", "$S^3$")
source = source.replace(
    "[Open the observatory](index.html)",
    "[Open the observatory](http://localhost:8765/)",
).replace(
    "[the illustrated browser note](technical-note.html)",
    "[the illustrated browser note](http://localhost:8765/technical-note.html)",
)
for figure in ("ray-lift", "pole-errors", "performance"):
    source = source.replace(f"figures/{figure}.png", f"figures/{figure}.pdf")
# Match the section structure to an article; LaTeX supplies the numbering.
source = re.sub(r"^## \d+\. ", "## ", source, flags=re.M)
abstract, body = source.split("## The accompanying demonstration", 1)
abstract = abstract.replace("## Abstract", "", 1).strip()
body = "## The accompanying demonstration {-}\n" + body
body = body.replace("## References", "## References {-}").replace(
    "## Implementation map", "## Implementation map {-}"
)
body = body.replace("### Contributions", "### Contributions {-}").replace(
    "## Assistance and responsibility", "## Assistance and responsibility {-}"
)
# Native TeX dash conventions avoid dependence on Unicode text glyph coverage.
for old, new in [("—", "---"), ("–", "--"), ("‑", "-")]:
    abstract = abstract.replace(old, new)
    body = body.replace(old, new)


def convert(text):
    return subprocess.run(
        [
            "pandoc",
            "--from=markdown",
            "--to=latex",
            "--shift-heading-level-by=-1",
            "--no-highlight",
        ],
        input=text,
        text=True,
        capture_output=True,
        check=True,
    ).stdout


preamble = r"""% Ray tracing stereographic Hopf tori
% Generated from technical-note.md by ../../scripts/build-latex.py.
% This file is standalone and can also be edited directly.
% Compile twice with pdflatex main.tex .
\documentclass[11pt,a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{lmodern}
\usepackage[margin=24mm]{geometry}
\usepackage{amsmath,amssymb}
\usepackage{microtype}
\usepackage{xcolor}
\usepackage{booktabs,longtable,array,calc}
\usepackage{graphicx,caption,float,needspace}
\usepackage[section]{placeins}
\captionsetup{font=small,labelfont=bf,skip=8pt}
\providecommand{\pandocbounded}[1]{#1}
\usepackage{enumitem}
\usepackage{fancyvrb}
\usepackage{fancyhdr}
\usepackage{titlesec}
\usepackage{xurl}
\usepackage{hyperref}
\definecolor{ink}{HTML}{172D36}
\definecolor{accent}{HTML}{126B72}
\hypersetup{colorlinks=true,linkcolor=accent,urlcolor=accent,citecolor=accent,
  pdftitle={Ray tracing stereographic Hopf tori across the projection pole},
  pdfauthor={Tom Crosby},
  pdfsubject={Geometry, quartic intersections, and solid and shell optics in Hopf Observatory}}
\urlstyle{same}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0.45em plus 0.15em minus 0.1em}
\setlength{\emergencystretch}{2em}
\setlength{\tabcolsep}{5pt}
\renewcommand{\arraystretch}{1.13}
\setlist{itemsep=0.35em,topsep=0.4em,leftmargin=*}
\providecommand{\tightlist}{\setlength{\itemsep}{0pt}\setlength{\parskip}{0pt}}
\titleformat{\section}{\large\sffamily\bfseries\color{ink}}{\thesection}{0.7em}{}
\titleformat{\subsection}{\normalsize\sffamily\bfseries\color{ink}}{\thesubsection}{0.7em}{}
\titlespacing*{\section}{0pt}{1.5em}{0.6em}
\titlespacing*{\subsection}{0pt}{1em}{0.4em}
\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\sffamily\color{accent}Hopf Observatory}
\fancyhead[R]{\small\sffamily Technical note}
\fancyfoot[C]{\small\thepage}
\setlength{\headheight}{14pt}
\renewcommand{\headrulewidth}{0.3pt}
\clubpenalty=10000
\widowpenalty=10000
\displaywidowpenalty=10000
\begin{document}
\thispagestyle{plain}
{\sffamily\bfseries\color{ink}\LARGE Ray tracing stereographic Hopf tori\\across the projection pole\par}
\vspace{0.5em}
{\sffamily\large Geometry, quartic intersections, and solid and shell optics\par}
\vspace{0.5em}
{\sffamily Tom Crosby\par}
{\small\href{mailto:twcrosbynz@gmail.com}{twcrosbynz@gmail.com}\par}
\vspace{0.3em}
{\sffamily\small Hopf Observatory \enspace\textbar\enspace 21 November 2026 \enspace\textbar\enspace Technical note\par}
\vspace{0.4em}
{\color{accent}\rule{\linewidth}{0.8pt}}
\begin{abstract}
"""
text = (
    preamble
    + convert(abstract)
    + "\n\\end{abstract}\n\n"
    + convert(body)
    + "\n\\end{document}\n"
)
# Keep each figure beside its discussion and out of longtable output queues.
text = text.replace(r"\begin{figure}", r"\begin{figure}[H]")
# Keep the three-row timing table intact; longer comparison tables may split.
short_table = re.compile(
    r"\\begin\{longtable\}\[\]\{@\{\}lrr@\{\}\}(.*?)\\end\{longtable\}", re.S
)


def keep_short_table(match):
    table = (
        match.group(1)
        .replace(r"\endhead", "")
        .replace(r"\bottomrule\noalign{}", "")
        .replace(r"\endlastfoot", "")
    )
    return (
        r"\begin{minipage}{\linewidth}\centering\begin{tabular}{@{}lrr@{}}"
        + table
        + r"\bottomrule\end{tabular}\end{minipage}"
    )


text = short_table.sub(keep_short_table, text)
text = text.replace(
    r"\begin{longtable}", r"\Needspace{10\baselineskip}\begin{longtable}"
)
# Pandoc 3.10's uncaptioned-table marker requires a newer longtable than some TeX distributions.
text = text.replace(r"\def\LTcaptype{none} % do not increment counter", "")
project = note
project.mkdir(exist_ok=True)
(project / "main.tex").write_text(text)
print(f'Wrote {project / "main.tex"}')
