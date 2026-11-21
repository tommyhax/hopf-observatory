# Review package

Start with the **[short paper](paper/manuscript.pdf)** ([editable source](PAPER.md)). The **[technical note](technical-note/technical-note.pdf)** ([source](TECHNICAL_NOTE.md)) is the detailed supplement. This is a review artifact for a mathematical-visualization / graphics implementation paper, with no claim to a fundamentally new root-finding algorithm.

## Navigate

| Material | Entry point |
|---|---|
| Short manuscript | [PAPER.md](PAPER.md), [PDF](paper/manuscript.pdf), [LaTeX](paper/main.tex) |
| Full geometry, renderer and prior work | [TECHNICAL_NOTE.md](TECHNICAL_NOTE.md) |
| Runnable implementation | [web/](web/); run `npm start`, then open `http://localhost:8765/` |
| Experimental methods and reproduction | [research/README.md](research/README.md) |
| Final seeded corpus, failures and transport | [research/STRESS.md](research/STRESS.md) |
| Existing hardware regressions | [docs/GPU_VALIDATION.md](docs/GPU_VALIDATION.md) |
| All inputs, exact brackets and GPU outputs | [research/results/](research/results/) |
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

The production shader remains byte-identical to the frozen revision `e49349dd91defdc1d86961ec68b472a7f0f24efe`. Only validation, documentation and review packaging are added in this pass. The exact delivered working revision is identified by the release's per-file SHA-256 manifest, which includes uncommitted review files.

## Executed checks

The final local validation completed on 21 November 2026:

| Check | Outcome |
|---|---|
| JavaScript math/scene tests | 24 passed |
| Independent-reference and matching tests | 5 + 5 passed |
| Browser integration, including the 867-case WebGL regression | 4 passed; [recorded run](research/results/browser-integration.json) |
| Native intersection, optics and full-shader regressions | Passed for production, both Yuksel variants and the conservative refinement control |
| Original and seeded exact references | Regenerated; identical to the recorded inputs/results in the tested environment |
| Solver comparison, refinement ablation, image comparison and repeated native timings | Executed; numerical failures and image differences retained in the linked reports |
| Formatting, source/input provenance and PDF layout | Checked |

The browser integration run uses SwiftShader. Earlier recorded ANGLE Metal validation and browser timings remain separate hardware evidence; the latter timings were not rerun in this final pass.

## Reproduction routes

To inspect the result, read the supplied PDFs and run the buildless app. To run checks, use Node.js and the pinned scientific Python environment:

```sh
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r research/requirements.txt
npm test
.venv/bin/python research/test_reference.py
.venv/bin/python research/test_analysis.py
.venv/bin/python research/check-evidence.py
npm run build:site
npx playwright install chromium
npm run test:browser
```

The four Playwright checks use software WebGL for CI integration. Native numerical/optical checks and full-render timings use the M3 Pro; macOS and graphics-driver access are required. The complete native reproduction commands are in the two research guides. Recorded root and transport outputs can be reanalysed on other systems; regenerating render images requires the native GPU step. A second GPU is not required to review this artifact.

Rebuild documents with `./scripts/build-note.sh`, `python3 scripts/build-latex.py`, and `python3 scripts/build-paper.py`. From each document directory, run `pdflatex -halt-on-error main.tex` twice; copy `main.pdf` to `technical-note.pdf` or `manuscript.pdf`, respectively. `npm run build:site` generates `_site/`; it does not deploy it. `python3 scripts/package-release.py` writes the deterministic local ZIP, `MANIFEST.json` and `SHA256SUMS` under `release/`.

## Questions for an independent reviewer

1. Does the documented geometry-to-renderer integration merit a short implementation/visualization paper given the cited prior work? Algorithmic priority is not asserted.
2. Are the baseline adaptations and shared construction/refinement fair for the limited comparative claims? Shared stages and the identical grazing failure set limit causal attribution.
3. Are the error metric, intentionally difficult sampling distribution and explicit failure reporting appropriate? The study does not estimate a real user's failure probability.
4. Do the finite-precision and optical limits receive enough emphasis relative to the visual demonstration? Exact implicit geometry is not certified numerical completeness or exact global light transport.
5. Does the human author endorse the mathematics, interpretation, attribution and AI-assistance statement?

These are review questions, not unfinished implementation tasks. No second GPU, new solver or further optimization is required before seeking outside review. Submission would still require the author's approval, a venue choice and its formatting requirements.
