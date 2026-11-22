#!/usr/bin/env python3
"""Generate the canonical JCGT manuscript; --pdf also runs LaTeX and BibTeX."""

import argparse
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
PAPER = ROOT / "paper"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--pdf", action="store_true", help="also rebuild manuscript.pdf")
args = parser.parse_args()
source = (ROOT / "PAPER.md").read_text()
metadata = re.match(r"^---\n(.*?)\n---\n", source, re.S)
title = re.search(r'^title: "(.*)"$', metadata[1], re.M)[1]
author = re.search(r'^author: "(.*)"$', metadata[1], re.M)[1]
date = re.search(r'^date: "(.*?) ·', metadata[1], re.M)[1]
source = source[metadata.end() :]
source = re.sub(r"^## \d+\. ", "## ", source, flags=re.M)
source = re.sub(r"^### \d+\.\d+ ", "### ", source, flags=re.M)
source = source.split("## References", 1)[0]
abstract, body = source.split("## Motivation and scope", 1)
abstract = abstract.replace("## Abstract", "", 1).strip()
body = "## Motivation and scope\n" + body
body, supplement = body.split("## Index of supplemental materials", 1)
supplement = "## Index of supplemental materials {-}\n" + supplement
body = body.replace(
    "## Assistance and responsibility", "## Assistance and responsibility {-}"
)
teaser_match = re.search(r"^!\[.*\]\(.*\)\{#fig:teaser .*\}$", body, re.M)
if teaser_match is None:
    raise ValueError("PAPER.md must contain the JCGT teaser figure")
teaser = teaser_match[0]
body = body[: teaser_match.start()] + body[teaser_match.end() :]

# Keep the bibliography as a single source; fail rather than emit missing cites.
cited = set(re.findall(r"@([a-z][a-z0-9]+)", source))
entries = set(re.findall(r"@\w+\{([^,]+),", (PAPER / "references.bib").read_text()))
if cited != entries:
    raise ValueError(
        f"Bibliography mismatch: missing={cited - entries}, unused={entries - cited}"
    )


def convert(text):
    text = text.replace(
        "](technical-note/figures/", "](../technical-note/figures/"
    ).replace("](research/figures/", "](../research/figures/")
    text = text.replace("stress-validation.png", "stress-validation.pdf")
    text = text.replace(
        "](research/diagnostics/", "](../research/diagnostics/"
    ).replace("grazing-diagnostic.png", "grazing-diagnostic.pdf")
    for old, new in [("—", "---"), ("–", "--"), ("‑", "-")]:
        text = text.replace(old, new)
    return subprocess.run(
        [
            "pandoc",
            "--from=markdown",
            "--to=latex",
            "--shift-heading-level-by=-1",
            "--number-sections",
            "--natbib",
            "--listings",
        ],
        input=text,
        text=True,
        capture_output=True,
        check=True,
    ).stdout


preamble = r"""% Generated from ../PAPER.md by ../scripts/build-paper.py.
% Official JCGT class and bibliography style; see README.md for provenance.
\documentclass{jcgt}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{microtype,booktabs,longtable,array,calc,float,needspace,xurl}
\usepackage[section]{placeins}
\providecommand{\pandocbounded}[1]{#1}
\providecommand{\passthrough}[1]{#1}
\providecommand{\tightlist}{\setlength{\itemsep}{0pt}\setlength{\parskip}{0pt}}
\setlength{\emergencystretch}{2em}
\clubpenalty=10000
\widowpenalty=10000
\setlength{\tabcolsep}{4pt}
\renewcommand{\arraystretch}{1.08}
\lstset{language={},morekeywords={if,for,in,return,continue,prepend},
  columns=fullflexible,keepspaces=true,showstringspaces=false,
  breaklines=true,mathescape=false,float=htbp}
% This is a local review draft. Do not assert submission or acceptance.
\pagestyle{fancy}
\fancyhead[L]{\small JCGT review draft (not submitted)}
\fancyhead[C]{}
"""
preamble += (
    "\\fancyhead[R]{\\small " + date + "}\n"
    "\\setciteauthor{" + author + "}\n"
    "\\setcitetitle{" + title + "}\n"
    "\\begin{document}\n"
    "\\title{" + title + "}\n"
    "\\author{" + author + "}\n"
)
teaser_latex = convert(teaser)
teaser_latex = re.sub(r"\\begin\{figure\}(?:\[[^]]*\])?", "", teaser_latex)
teaser_latex = teaser_latex.replace(r"\end{figure}", "").strip()
latex = (
    preamble
    + "\\teaser{\n\\captionsetup{hypcap=false}\n"
    + teaser_latex
    + "\n}\n\\maketitle\n"
    + "\\begin{abstract}\n\\small\n"
    + convert(abstract)
    + "\n\\end{abstract}\n"
    + convert(body)
    + "\n\\small\n\\bibliographystyle{jcgt}\n\\bibliography{references}\n"
    + convert(supplement)
    + r"""
\section*{Author contact information}
Tom Crosby\\
\href{mailto:twcrosbynz@gmail.com}{twcrosbynz@gmail.com}
\end{document}
"""
)
# The upstream caption package needs a real counter for Pandoc's longtables.
latex = latex.replace(r"\def\LTcaptype{none} % do not increment counter", "")
latex = latex.replace(r"\begin{figure}", r"\begin{figure}[htbp]")
latex = latex.replace(
    r"\begin{longtable}", r"\Needspace{10\baselineskip}\begin{longtable}"
)
latex = latex.replace(
    "For either chart,", "\\Needspace{9\\baselineskip}\nFor either chart,"
)
latex = latex.replace(
    "Section 3.2", r"Section~\ref{isolation-refinement-and-acceptance}"
)
latex = latex.replace(
    "Section 4.4", r"Section~\ref{post-hoc-diagnosis-of-grazing-failures}"
)
# Linked references while keeping PAPER.md readable without a LaTeX renderer.
for label, target in [
    ("Figure 1", "fig:teaser"),
    ("Figure 2", "fig:pole"),
    ("Figure 3", "fig:stress"),
    ("Figure 4", "fig:grazing"),
    ("Listing 1", "lst:intersection"),
]:
    latex = latex.replace(label, label.split()[0] + "~\\ref{" + target + "}")
(PAPER / "main.tex").write_text(latex)
print("Wrote paper/main.tex")

if args.pdf:
    # Temporary output keeps aux files out of the source/release directories.
    with tempfile.TemporaryDirectory(prefix="hopf-paper-") as directory:
        build = Path(directory)
        shutil.copy2(PAPER / "references.bib", build)
        shutil.copy2(PAPER / "jcgt.bst", build)
        commands = [
            (
                [
                    "pdflatex",
                    "-interaction=nonstopmode",
                    "-halt-on-error",
                    f"-output-directory={build}",
                    "main.tex",
                ],
                PAPER,
            ),
            (["bibtex", "main"], build),
        ]
        commands.extend([commands[0]] * 3)
        for command, cwd in commands:
            result = subprocess.run(command, cwd=cwd, text=True, capture_output=True)
            if result.returncode:
                raise SystemExit(result.stdout + result.stderr)
        log = (build / "main.log").read_text()
        for line in log.splitlines():
            if "Warning" in line or "Overfull" in line:
                print(line)
        if re.search(r"undefined|Rerun to get", log):
            raise SystemExit("Unresolved LaTeX references; inspect the build")
        shutil.copy2(build / "main.pdf", PAPER / "manuscript.pdf")
    print("Wrote paper/manuscript.pdf")
