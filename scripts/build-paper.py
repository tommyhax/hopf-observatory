#!/usr/bin/env python3
"""Generate the short review manuscript's LaTeX from PAPER.md; Pandoc required."""
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parent.parent
source = (ROOT / "PAPER.md").read_text()
source = re.sub(r"^---\n.*?\n---\n", "", source, count=1, flags=re.S)
source = re.sub(r"^## \d+\. ", "## ", source, flags=re.M)
source = re.sub(r"^### \d+\.\d+ ", "### ", source, flags=re.M)
abstract, body = source.split("## Motivation and scope", 1)
abstract = abstract.replace("## Abstract", "", 1).strip()
body = "## Motivation and scope\n" + body
body = body.replace("## References", "## References {-}").replace(
    "## Assistance and responsibility", "## Assistance and responsibility {-}"
)
body = body.replace(
    "](technical-note/figures/", "](../technical-note/figures/"
).replace("](research/figures/", "](../research/figures/")
body = body.replace("stress-validation.png", "stress-validation.pdf")
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
            "--number-sections",
            "--no-highlight",
        ],
        input=text,
        text=True,
        capture_output=True,
        check=True,
    ).stdout


preamble = r"""% Generated from ../PAPER.md by ../scripts/build-paper.py.
\documentclass[10pt,a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{lmodern,microtype,amsmath,amssymb}
\usepackage[margin=21mm]{geometry}
\usepackage{graphicx,booktabs,longtable,array,calc,float,needspace}
\usepackage[section]{placeins}
\usepackage{xcolor,xurl,hyperref,caption,fancyhdr}
\hypersetup{colorlinks=true,urlcolor=teal,linkcolor=teal,pdftitle={Interactive ray tracing of stereographic Hopf tori},pdfauthor={Tom Crosby}}
\providecommand{\pandocbounded}[1]{#1}
\providecommand{\tightlist}{\setlength{\itemsep}{0pt}\setlength{\parskip}{0pt}}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0.35em}
\setlength{\emergencystretch}{2em}
\setlength{\tabcolsep}{5pt}
\renewcommand{\arraystretch}{1.08}
\captionsetup{font=small,labelfont=bf}
\pagestyle{fancy}\fancyhf{}
\fancyhead[L]{\small Hopf Observatory}\fancyhead[R]{\small Review manuscript}
\fancyfoot[C]{\thepage}\setlength{\headheight}{13pt}
\begin{document}
\thispagestyle{plain}
{\LARGE\bfseries Interactive ray tracing of stereographic Hopf tori\par}
\medskip
Tom Crosby\quad\href{mailto:twcrosbynz@gmail.com}{twcrosbynz@gmail.com}\par
{\small 21 November 2026\quad Review manuscript}
\begin{abstract}
"""
latex = (
    preamble
    + convert(abstract)
    + "\n\\end{abstract}\n"
    + convert(body)
    + "\n\\end{document}\n"
)
latex = latex.replace(r"\def\LTcaptype{none} % do not increment counter", "")
latex = latex.replace(r"\begin{figure}", r"\begin{figure}[H]")
latex = latex.replace(
    r"\begin{longtable}", r"\Needspace{10\baselineskip}\begin{longtable}"
)
(ROOT / "paper").mkdir(exist_ok=True)
(ROOT / "paper/main.tex").write_text(latex)
print("Wrote paper/main.tex")
