# Review package

Start with the **[JCGT review manuscript](paper/manuscript.pdf)** ([editable source](PAPER.md)). The **[technical note](technical-note/technical-note.pdf)** ([source](TECHNICAL_NOTE.md)) is the 21 November 2026 baseline exposition. Its geometry and production-renderer description remain applicable; the [completed Algorithm 1010 overview](research/diagnostics/algorithm1010/README.md) supplies the subsequent experimental conclusions. This is a review artifact for a mathematical-visualization / graphics implementation paper, with no claim to a fundamentally new root-finding algorithm.

## Navigate

| Material | Entry point |
|---|---|
| Canonical JCGT manuscript | [PAPER.md](PAPER.md), [PDF](paper/manuscript.pdf), [LaTeX](paper/main.tex) |
| Full geometry, renderer and prior work | [TECHNICAL_NOTE.md](TECHNICAL_NOTE.md) |
| Runnable implementation | [web/](web/); run `npm start`, then open `http://localhost:8765/` |
| Experimental methods and reproduction | [research/README.md](research/README.md) |
| Final seeded corpus, failures and transport | [research/STRESS.md](research/STRESS.md) |
| Post-hoc grazing-stage diagnosis | [research/diagnostics/grazing/README.md](research/diagnostics/grazing/README.md) |
| Algebraic applicability and conventional Ferrari controls | [research/diagnostics/algebraic/README.md](research/diagnostics/algebraic/README.md) |
| Completed Algorithm 1010 investigation and study map | [research/diagnostics/algorithm1010/README.md](research/diagnostics/algorithm1010/README.md) |
| Controlled solver × traversal comparison | [research/diagnostics/algorithm1010/traversal/README.md](research/diagnostics/algorithm1010/traversal/README.md) |
| Offline verification and release provenance | [docs/RELEASE.md](docs/RELEASE.md) |
| Existing hardware regressions | [docs/GPU_VALIDATION.md](docs/GPU_VALIDATION.md) |
| Original/stress inputs, exact brackets and GPU outputs (diagnostics have their own results directories) | [research/results/](research/results/) |
| Baseline source provenance/licences | [research/THIRD_PARTY.md](research/THIRD_PARTY.md) |
| Material/overlap semantics | [docs/THREE_TORI.md](docs/THREE_TORI.md) |

## Principal evidence and qualifications

- The original 867-case comparison matches all 1,470 roots with Bernstein and both Yuksel–Peters variants at 1e−4. This is the designed corpus, not a universal guarantee.
- The final 2,400-query corpus has 3,314 represented roots. All methods pass 1,800 non-grazing queries and fail the same 109/600 grazing queries. Failures include missing/excess candidates and inaccurate positions. Seeds, raw/refined outputs, tighter tolerances and representative failure IDs are preserved.
- Input rounding changes 570 intended root sets beyond 1e−4. This is separate from the 109 failures on the represented inputs; the counts can overlap.
- All 100 seeded three-shell groups retain boundary order at 1e−4. Twelve independently checked transport paths pass per solver, covering 167 boundaries each. One reaches the boundary cap and one reaches the energy cutoff; these are not certified complete paths.
- Existing regression tests retain eight interfaces per aligned single 0.01° shell and 24 across three shells. Finite offsets, grazing rays and finite budgets prevent an all-path guarantee.
- Complete images agree closely but not exactly: one pixel differs by 0.341 in one comparison. Image comparison uses Bernstein as a baseline, not independent physical ground truth.
- Timings support the application's Bernstein choice for the measured three-shell workload; no cross-vendor, universal-speed or superior-completeness claim is made.
- The separate grazing diagnostic replays all frozen GPU hit sets. Exact roots of captured coefficients already fail on the same 109 queries. Intermediate construction errors can cancel; no unique per-instruction attribution is claimed. The no-proximity-merge ablation changes no outputs, and residual filtering removes no grazing candidates. New captures, exact brackets and three one-ULP probe discrepancies are retained separately.

The production shader remains byte-identical to the frozen revision `e49349dd91defdc1d86961ec68b472a7f0f24efe`. This consolidation changes documentation, the generated manuscript and release tooling. The release manifest records the exact committed source revision and per-file SHA-256 hashes; the package is built only from that commit. Historical manifests retain their original documentary hashes, checked against the explicitly identified snapshots described in [the provenance instructions](docs/RELEASE.md).

## Recorded validation history

The original local validation completed on 21 November 2026:

| Check | Outcome |
|---|---|
| JavaScript math/scene tests | 24 passed |
| Independent-reference and matching tests | 5 + 5 passed |
| Browser integration, including the 867-case WebGL regression | 4 passed; [recorded run](research/results/browser-integration.json) |
| Native intersection, optics and full-shader regressions | Passed for production, both Yuksel variants and the conservative refinement control |
| Original and seeded exact references | Regenerated; identical to the recorded inputs/results in the tested environment |
| Solver comparison, refinement ablation, image comparison and repeated native timings | Executed; numerical failures and image differences retained in the linked reports |
| Formatting, source/input provenance and PDF layout | Checked |

The 22 November 2026 editorial revision adopts the official JCGT template, adds implementation detail and a pole-crossing figure, and separates numerical lessons from the conclusion. It preserves the measured sources and recorded results. Template provenance, build instructions and the bibliography are in `paper/`; verified venue guidance is in `docs/SUBMISSION.md`.

The subsequent grazing diagnostic adds new experiments under `research/diagnostics/grazing/` and updates the canonical paper. Its frozen manifest protects 62 existing source/result files through 65 recorded paths. All 600 cases were captured and analyzed; five analytic diagnostic tests pass. The 3,600 baseline replay comparisons and 3,600 instrumented-collector comparisons reproduce the frozen float hit sets. Of 3,600 individual-probe aggregates, three differ by one ULP without changing a principal-tolerance classification. Original experiment outputs remain unchanged.

The original browser integration run used SwiftShader. Recorded ANGLE Metal validation and browser timings remain separate hardware evidence; the current consolidation does not rerun those timings.

The 23 November 2026 [completed Algorithm 1010 investigation](research/diagnostics/algorithm1010/README.md)
adds native and actual WebGL transport, browser timing, two-pixel path diagnosis
and a controlled solver × traversal comparison. In the latter run, original-loop
Algorithm 1010 costs 37.2% more GPU time for three aligned thin shells and 55.1%
more near the pole. Traversal expansion contributes but does not explain most
of the slowdown. Bernstein remains the production default. The native 109
failures are distinct from the browser stress counts; within-solver traversal
image identity does not establish cross-solver identity or physical ground truth.

## Verification for the second review snapshot

The 23 November 2026 consolidation checks are separate from the recorded
hardware experiments above:

| Check executed during consolidation | Outcome |
|---|---|
| Application / independent-reference / matching / grazing tests | 24 / 5 / 5 / 5 passed |
| Original provenance and new offline evidence gate | Passed; 65 frozen paths and 48 traversal images verified |
| Historical documentary snapshots | Three files matched the original `48c5166` Git blobs |
| Isolated offline reanalysis | 11 runs reproduced committed JSON byte for byte; both traversal figures also matched |
| Manuscript generation and references | LaTeX/BibTeX passed; affected pages 9–14 visually inspected |
| Formatting, local links and site assembly | Passed; both site PDFs match their canonical source files |
| Bounded Chromium / SwiftShader integration | 4 passed, including the 867-ray regression |

No hardware benchmarks or numerical capture campaign are rerun. The bounded
software-WebGL suite and final archive checks are recorded in the local
`release/v0.1.0-review.3-validation.md` report produced after packaging;
that local report is separate from the immutable source archive. The release
`MANIFEST.json` identifies the committed source. See [release instructions](docs/RELEASE.md)
for commands and [release notes](docs/RELEASE_NOTES.md) for the publication scope.

## Reproduction routes

To inspect the result, read the supplied PDFs and run the buildless app. To run checks, use Node.js and the pinned scientific Python environment:

```sh
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r research/requirements.txt
npm test
.venv/bin/python research/test_reference.py
.venv/bin/python research/test_analysis.py
python3 scripts/verify-release.py
.venv/bin/python research/diagnostics/grazing/test_diagnostic.py
npm run build:site
npx playwright install chromium
npm run test:browser
```

The four Playwright checks use software WebGL for CI integration. Native numerical/optical checks and full-render timings use the M3 Pro; macOS and graphics-driver access are required. Each study links its own historical capture commands. The Algorithm 1010 browser adapter targets Metal; the traversal runner checks the recorded renderer, vendor, WebGL version and browser user agent. Repeating that capture requires the expected Apple M3 Pro / Chrome 157 stack, not merely any WebGL browser. Offline verification and isolated reanalysis of supplied root, transport and timing outputs need no GPU; regenerating render images requires the native GPU step. A second GPU is not required to review this artifact.

Rebuild the canonical JCGT manuscript with `python3 scripts/build-paper.py --pdf`; this runs both LaTeX and BibTeX. The historical technical note need not be rebuilt for this release. Its original regeneration route is `./scripts/build-note.sh` and `python3 scripts/build-latex.py`; from `technical-note/`, run `pdflatex -halt-on-error main.tex` twice and copy `main.pdf` to `technical-note.pdf`. `npm run build:site` generates `_site/`; it does not deploy it. `python3 scripts/package-release.py --version v0.1.0-review.3 --source HEAD` packages the committed revision into `release/v0.1.0-review.3/`, including the two PDFs, deterministic ZIP, `MANIFEST.json` and `SHA256SUMS.txt`. It does not publish or change existing releases.

## Questions for an independent reviewer

1. Does the documented geometry-to-renderer integration merit a short implementation/visualization paper given the cited prior work? Algorithmic priority is not asserted.
2. Are the baseline adaptations and shared construction/refinement fair for the limited comparative claims? Shared stages and the identical grazing failure set limit causal attribution.
3. Are the error metric, intentionally difficult sampling distribution and explicit failure reporting appropriate? The study does not estimate a real user's failure probability.
4. Do the finite-precision and optical limits receive enough emphasis relative to the visual demonstration? Exact implicit geometry is not certified numerical completeness or exact global light transport.
5. Does the human author endorse the mathematics, interpretation, attribution and AI-assistance statement?

These are review questions, not unfinished implementation tasks. No second GPU, new solver or further optimization is required before seeking outside review. The canonical manuscript now uses the official JCGT template and bibliography style. Submission would still require the author's decision to submit; this package has not been submitted.
