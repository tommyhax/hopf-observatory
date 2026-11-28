# JCGT manuscript preparation

- Title: *Interactive ray tracing of stereographic Hopf tori*
- Author: Tom Crosby
- Correspondence: twcrosbynz@gmail.com
- Repository: `git@github.com:tommyhax/hopf-observatory.git`
- Canonical manuscript: [`papers/jcgt/manuscript.pdf`](../papers/jcgt/manuscript.pdf)
- Editable prose: [`papers/jcgt/paper.md`](../papers/jcgt/paper.md); bibliography: [`papers/jcgt/references.bib`](../papers/jcgt/references.bib)
- Generated LaTeX and official template: [`papers/jcgt/`](../papers/jcgt/)
- Supplement: extended technical note, runnable application, figures, raw measurements, executable experiments and SHA-256 manifest
- Status: JCGT review draft, prepared locally; not submitted. On hold while the *Journal of Mathematics and the Arts* paper is prepared; its requirements and checklist are in [`papers/jma/README.md`](../papers/jma/README.md)

## Verified venue guidance

Checked 22 November 2026 against JCGT's [author guidance](https://jcgt.org/write.html), [reviewer form](https://jcgt.org/files/review-form.txt) and [official template](https://jcgt.org/files/jcgt-template.zip). Initial submissions may use a reasonable article format; accepted papers require the journal's LaTeX and BibTeX format. Review is single-blind. There is no formal page limit or author fee. The template requires an opening teaser figure and uses author-year references.

The journal welcomes implementation studies and asks for usable detail, relevant comparisons and explicit limitations. The reviewer form also asks what improves on existing literature; a lack of algorithmic novelty does not remove that requirement. Venue fit and acceptance remain editorial judgments.

JCGT distributes published articles under CC BY-ND 4.0 and requires supplied code/data under non-restrictive open-source terms. Project software and original data are supplied under the repository's MIT licence. Peters's CC0 attribution and the Graphics Gems permission notice remain in [`research/THIRD_PARTY.md`](../research/THIRD_PARTY.md); the latter is a separate upstream permission grant, not MIT. The added corrected Algorithm 1010 implementation retains the OpenMC port's [BSD licence](../research/diagnostics/algorithm1010/LICENSE) and [source attribution](../research/diagnostics/algorithm1010/SOURCES.md). The journal template's provenance is recorded in [`papers/jcgt/README.md`](../papers/jcgt/README.md). No third-party material has been relicensed in this preparation pass.

## Editorial changes

The manuscript has six sections: motivation and scope; geometry and the projection pole; intersection and optical implementation; evaluation; discussion and limitations; conclusion. It opens with the renderer and a normal-colored pole-crossing sequence. The implementation section gives homogeneous chart vectors, direct Bernstein coefficients, isolation thresholds, refinement/acceptance rules, nearest-hit pseudocode and shell-dependent offsets. The technical note retains the longer derivations.

The contribution is a documented implementation and a reproducible numerical study of where float32 fails on this family and what fixing it costs. The [grazing-stage diagnostic](../research/diagnostics/grazing/README.md) shows that exact solving of the captured GPU coefficients reproduces the same 109 failures, so the error arises in coefficient construction. Later diagnostics remove the failures by building the coefficients in higher precision, in [binary64 on the CPU](../research/diagnostics/double-precision/README.md) and with [float-float arithmetic in WebGL](../research/diagnostics/browser-precision/README.md), and compare iterative and closed-form solvers on that construction ([GPU](../research/diagnostics/guarded-direct/README.md), [CPU](../research/diagnostics/native-algebraic/README.md)). The paper states that these variants were developed against the corpora they are evaluated on. The production renderer is unchanged and keeps float32 Bernstein as its default.

Prior work is attributed explicitly: the stereographic Clifford-torus geometry to Banchoff and to McCuan and Spietz, the cyclide equation to Pottmann, Shi and Skopenkov, and the rendering and numerical ingredients to their sources. The paper does not claim a new root-finding algorithm.

## Structural references

These papers informed presentation rather than serving as new experimental baselines:

- Hansson Söderlund, Evans and Akenine-Möller, [*Ray Tracing of Signed Distance Function Grids*](https://jcgt.org/published/0011/03/06/paper-lowres.pdf) (2022): compact polynomial derivation followed by practical rendering evaluation.
- Tejima, Fujita and Matsuoka, [*Direct Ray Tracing of Full-Featured Subdivision Surfaces with Bézier Clipping*](https://jcgt.org/published/0004/01/04/paper.pdf) (2015): pipeline exposition, pseudocode and visible failure analysis.
- Majercik, Crassin, Shirley and McGuire, [*A Ray-Box Intersection Algorithm and Efficient Dynamic Voxel Rendering*](https://jcgt.org/published/0007/03/04/paper-lowres.pdf) (2018): distinction between intersection tests and complete application performance.

They are not added to the scientific bibliography solely as style examples. The manuscript cites directly relevant mathematical and numerical sources. Its length follows the material; 8–12 pages is not a JCGT rule.

Rebuild with `python3 scripts/build-paper.py --pdf`; see [`REVIEW.md`](../REVIEW.md) for review and reproduction routes. Author endorsement of the interpretation and assistance statement remains part of deciding whether to submit.
