# Review package

Start with the **[JCGT review manuscript](papers/jcgt/manuscript.pdf)** ([editable source](papers/jcgt/paper.md)). The **[technical note](papers/technical-note/technical-note.pdf)** ([source](papers/technical-note/technical-note.md)) has the complete derivation, implementation and experiments. The application runs in the browser with `npm start`, at `http://localhost:8765/`.

The paper is an implementation and visualization study. It claims exact, interactive, refractive ray tracing of stereographic Hopf tori, including surfaces through infinity, and a measured account of where float32 fails and what fixing it costs. It does not claim a new root-finding algorithm.

## Navigate

| Material | Entry point |
|---|---|
| Canonical JCGT manuscript | [paper.md](papers/jcgt/paper.md), [PDF](papers/jcgt/manuscript.pdf), [LaTeX](papers/jcgt/main.tex) |
| Full geometry, renderer, experiments and prior work | [technical-note.md](papers/technical-note/technical-note.md) |
| Runnable implementation | [web/](web/) |
| Reference, corpora, methods and reproduction | [research/README.md](research/README.md) |
| Seeded stress corpus, failures and transport | [research/STRESS.md](research/STRESS.md) |
| Where the grazing failures arise | [research/diagnostics/grazing/](research/diagnostics/grazing/README.md) |
| Binary64 construction replay (CPU) | [research/diagnostics/double-precision/](research/diagnostics/double-precision/README.md) |
| Paired float32 construction (WebGL) | [research/diagnostics/browser-precision/](research/diagnostics/browser-precision/README.md) |
| Closed-form solver on the GPU | [research/diagnostics/guarded-direct/](research/diagnostics/guarded-direct/README.md) |
| Closed-form solver in binary64 (CPU) | [research/diagnostics/native-algebraic/](research/diagnostics/native-algebraic/README.md) |
| Float32 closed-form controls and Algorithm 1010 | [research/diagnostics/algebraic/](research/diagnostics/algebraic/README.md), [research/diagnostics/algorithm1010/](research/diagnostics/algorithm1010/README.md) |
| Hardware regressions | [docs/GPU_VALIDATION.md](docs/GPU_VALIDATION.md) |
| Offline verification and provenance | [docs/RELEASE.md](docs/RELEASE.md) |
| Third-party sources and licences | [research/THIRD_PARTY.md](research/THIRD_PARTY.md) |
| Material and overlap semantics | [docs/THREE_TORI.md](docs/THREE_TORI.md) |

## Principal evidence

- **Designed corpus.** Production Bernstein and both Yuksel–Peters variants match all 1,470 roots of 867 rays at relative tolerance 1e−4, including pole crossings with hits 2.4 × 10⁹ units away. A float32 Ferrari port fails 378.
- **Stress corpus.** All 1,800 random, pole and shell queries pass. All three modern solvers fail the same 109 of 600 deliberately grazing queries natively; the browser fails 123. Input rounding separately changes 570 intended root sets.
- **Cause.** Exact roots of the captured float32 coefficients fail on all 109 grazing queries. The failures arise in coefficient construction, not in isolation, refinement or filtering.
- **Remedy.** Building the coefficients in binary64 on the CPU recovers all 584 grazing intersections. Float-float construction in WebGL matches all 4,784 intersections of both corpora and passes the optical suite, at 4.4–7.5× GPU time.
- **Closed form.** On that construction, a Ferrari/Cardano GPU solver with guarded precision escalation passes every query, fixture and optical check, at 3.0–5.7× GPU time. In binary64 on the CPU the same closed form is 12× faster than bisection.
- **Optics.** 36 refraction paths with 392 events pass; 0.01° shells keep all their crossings; twelve seeded paths pass exact boundary-by-boundary checks for each solver.

The production shader is unchanged by every diagnostic. Variants are assembled in memory by each study's `renderer.mjs`.

## Reproduction

Use Node.js and the pinned scientific Python environment:

```sh
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r research/requirements.txt
npm test
.venv/bin/python research/test_reference.py
.venv/bin/python research/test_analysis.py
.venv/bin/python research/diagnostics/grazing/test_diagnostic.py
python3 scripts/verify-release.py
npm run build:site
npx playwright install chromium
npm run test:browser
```

`scripts/verify-release.py` re-verifies all recorded evidence offline, without a GPU. The Playwright checks use software WebGL. Native numerical and optical checks and all timings used an Apple M3 Pro, with Chrome on ANGLE Metal for browser runs; repeating those captures needs a comparable stack. Each diagnostic directory documents its own capture commands and verifier.

Rebuild the manuscript with `python3 scripts/build-paper.py --pdf`. Rebuild the technical note with `./scripts/build-note.sh` and `python3 scripts/build-latex.py`, then run `pdflatex -halt-on-error main.tex` twice in `papers/technical-note/` and copy `main.pdf` to `technical-note.pdf`.

## Questions for a reviewer

1. Does exact, interactive rendering of this family, with the accompanying numerical account, merit a JCGT implementation paper given the cited prior work?
2. Are the baseline adaptations, the shared construction and refinement, and the matching criterion fair for the comparative claims made?
3. Is the deliberately grazing corpus, with explicit failure reporting, an appropriate test? It does not estimate how often failures appear in ordinary views.
4. Are the finite-precision and optical limits given enough weight relative to the visual results?
5. Does the author endorse the mathematics, interpretation, attribution and AI-assistance statement?

This package has not been submitted.
