# Reproducing the study

Run commands from the project root. Recorded results are under `research/results/`; rerunning replaces those files. Source hashes and the supplementary archive's per-file manifest identify the measured implementation.

The final 2,400-query independent stress corpus, captured transport paths and complete-render comparisons are documented in [STRESS.md](STRESS.md). It includes significant grazing failures; the original 867-case success below must not be read as a universal robustness result.

The separate [post-hoc grazing diagnostic](diagnostics/grazing/README.md) traces all 600 grazing queries through construction and root solving while preserving the original evidence. Exact isolation of captured coefficients reproduces the same 109 failing queries. Its capture, analysis, ablation, figures and reproduction commands live entirely under `diagnostics/grazing/`; they do not overwrite `results/`.

The subsequent [corrected Algorithm 1010 evaluation](diagnostics/algorithm1010/final/README.md) tests algebraic factorization in float32, with native and actual WebGL transport and timing. The decision is **retain as experimental**: native gains do not carry over to Chrome/ANGLE Metal, where the shell scenes are slower. The production shader and original evidence remain unchanged. Its sources, licence, two-pixel investigation, loop controls and final source-hash verification are separate from the studies below.

## Requirements and regression tests

The application needs an HTTP server and WebGL 2. Research scripts use Node.js, Python 3.12 or later and pinned scientific packages. Native experiments require macOS, Xcode command-line tools (`clang`) and graphics-driver access. Browser experiments also run on other platforms; the recorded hardware results use Apple M3 Pro.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r research/requirements.txt
npm ci
npm test
.venv/bin/python research/test_reference.py
.venv/bin/python research/test_analysis.py
npm run test:gpu
```

There are 24 application tests, five independent-reference tests and five analysis-matching tests. Reference tests cover analytic axis roots, a rational double tangent, degree reduction, a contained line and input rounding. The native regression suite checks 625 solid, 403 shell, 133 multi-torus and 31 focused thin-shell rays, 36 production refraction paths, 31 index-one invisibility cases and eight complete-fragment smoke cases.

[GPU validation](../docs/GPU_VALIDATION.md) describes the regression tolerances and thin-shell results. Its CPU reference shares production solver structure. The independent study below does not.

## Independent numerical comparison

```sh
.venv/bin/python research/reference.py
node research/run-experiment.mjs
.venv/bin/python research/analyze.py
```

`reference.py` expands the ray polynomial in exact rational arithmetic. SymPy's continued-fraction isolation gives real roots with rational brackets no wider than 1e−30 and explicit multiplicities. It imports no application mathematics. One root set uses the exact binary values of uploaded float32 uniforms; another uses an 80-digit approximation of the intended geometry. This separates solver error from input-representation loss.

The 867-ray corpus contains:

- 600 pole rays: four configurations, six axial rays, δ = 0 and ±10⁻¹ through ±10⁻¹².
- 19 silhouette-neighborhood rays.
- 176 precision cases: 168 adjacent-float pole offsets spanning seven torus parameters, plus eight exact chart-junction, origin and contained-line cases.
- 72 rays through twelve seeded six-plane rotations.

`reference.json` stores inputs, brackets and distinct positive roots with multiplicities. `run-experiment.mjs` collects **all roots of the unchanged original ray**, without moving its origin, applying a near bias or imposing a finite far clip. `all-roots.glsl` adapts the production Bernstein helpers to enumeration; it does not modify the application shader. Four float render targets retain up to sixteen candidates, so false roots are not silently truncated to four.

The methods share closest-point recentering and ray scale:

| Method | Polynomial representation and domain |
|---|---|
| Bernstein near/reciprocal | Production Bernstein construction and isolation on four bounded charts |
| Yuksel–Peters, centered | Power coefficients in the centered affine ray coordinate; coefficient-only Cauchy bound |
| Yuksel–Peters, near/reciprocal | The same Newton-bisection implementation and power-coefficient construction on four bounded charts |
| Ferrari, centered | Conventional float32 analytic solver on the same centered power polynomial |

Every method reports raw roots and a second result after common residual-decreasing homogeneous refinement (up to four steps) and the production residual filter. Both chart intervals include their common junction; far-chart zero denotes infinity and is excluded. Only identical float hit positions are consolidated. This retains a junction root even when independently rounded chart polynomials detect it on only one side. There is no proximity-based consolidation of grazing roots. An identically zero polynomial is a contained line, recorded separately by the reference, with no isolated roots to enumerate.

`pole-gpu.json` stores outputs, hardware, source hashes, eleven Yuksel polynomial sanity checks, three Ferrari polynomial checks and 32 original-ray collection checks. Fixtures include degree loss, multiple roots, closed endpoints, separated scales, chart junctions, origin exclusion, contained lines and a positive hit below the rendering bias. All fourteen polynomial checks and all 24 iterative-method collector fixtures pass. The raw Ferrari baseline fails two collector fixtures near the origin; both failures remain recorded, and its refined outputs pass those fixtures. [THIRD_PARTY.md](THIRD_PARTY.md) documents the ports and licences.

`analyze.py` uses maximum-cardinality one-to-one matching, minimizing total error among assignments with the same cardinality. The tolerance is 1e−4 with `max(1, reference distance)` as denominator. A ray fails if any reference root is missing or any returned root is unmatched; nonfinite outputs also fail. Matching counts distinct positions, not algebraic multiplicity. The analyzer rejects stale source hashes. `analysis.json` retains per-ray classifications and raw/refined error summaries.

On Apple M3 Pro, all three modern variants match all **1,470 roots across 867 rays**, both before and after common refinement. Their largest relative-distance error is 7.56e−5, from the grazing corpus. The Ferrari port fails on 428 rays before refinement and 378 after it (682 and 740 matched roots, respectively; 223 and 13 unmatched outputs). The farthest reference hit is about 2.4 billion scene units. Input rounding alone changes 210 pole-sweep root sets; all sampled nominal |δ| ≤ 1e−9 round onto the pole.

**This corpus demonstrates no root-completeness advantage over the centered Yuksel–Peters baseline at the stated tolerance.** This experiment measures numerical behavior; the full-render experiment below measures cost. The two Yuksel variants hold the solver fixed while changing coordinates. Comparing Bernstein with either power-basis method also changes representation and isolation details, so that difference is not attributed to coordinates alone. Surface refinement can improve or worsen individual errors; both stages are retained.

## Refinement and full-render comparisons

```sh
node research/run-refinement.mjs
.venv/bin/python research/analyze.py --input research/results/refinement-gpu.json --output research/results/refinement-analysis.json
node scripts/run-gpu-checks.mjs --variant=bernstein-guarded
node scripts/run-gpu-checks.mjs --variant=yuksel-direct
node scripts/run-gpu-checks.mjs --variant=yuksel-charts
node research/benchmark-renderers.mjs
```

`renderer-variants.mjs` replaces complete shader functions while preserving optical transport. It fails if a named function is missing. Variant names identify the following controlled choices:

| Identifier | Refinement / intersection |
|---|---|
| `production`, `bernstein-decreasing` | Production Bernstein with strict residual decrease |
| `bernstein-raw` | Bernstein without Newton correction; residual filter retained |
| `bernstein-unguarded` | Step-limited Newton without residual-decrease acceptance |
| `bernstein-guarded` | Noise-aware guard requiring residual improvement beyond an `8 * 2^-23 * M` heuristic floor |
| `yuksel-direct` | Centered affine Yuksel–Peters; production refinement and optics |
| `yuksel-charts` | Near/reciprocal Yuksel–Peters; production hull rejection, refinement and optics |

The refinement experiment enumerates all original-ray roots for the four Bernstein policies, with common residual filtering. Its single `polished` stage denotes that filter even for the no-correction control. All policies match all 1,470 roots. Strict residual decrease reduces the rotation-subset maximum from 1.23e−5 for unguarded Newton to 5.84e−6, while the unrefined maximum is 8.69e−7. The noise-aware guard returns exactly the unrefined roots on this corpus and forgoes the precision-subset improvement from 2.35e−6 to 1.58e−7. Residual decrease is not a certificate of distance improvement or bracket preservation.

The full-render benchmark measures five variants (all except `bernstein-raw`) in four fixed scenes at 640×360 and 1280×720, with a 24-interaction cap. Each configuration has three blocks of five warmup and ten measured frames, rotating variant order. Avoid other GPU workloads while timing. Native draw plus `glFinish` wall times exclude compilation, readback, UI and vsync. `renderer-benchmark.json` records raw samples, uniforms, pooled medians, interquartile ranges, block medians and source/shader hashes. This measures the complete optical renderer, including rejection and coefficient construction, rather than isolated root-solver throughput.

On the recorded M3 Pro run, Yuksel is faster for a single solid torus but slower for three thin shells. At 1280×720 near the pole, pooled medians are 38.45 ms for production Bernstein, 67.69 ms for centered Yuksel and 45.74 ms for chart Yuksel. Between-block variation is retained, and small differences should not be overinterpreted. These native results do not establish browser or cross-device speedups; the app retains Bernstein.

All three additional transport variants pass the full native regression suite, including the 0.01° paths with eight single-shell or 24 three-shell interfaces. `transport-*.json` records each variant's source and compiled shader hashes. `docs/gpu-results.json` is the production report. The same two Yuksel shader hashes occur in the transport and timing reports, linking correctness checks to measured variants.

## Browser verification and timing

Serve the **project root**, rather than only `web`:

```sh
python3 -m http.server 8770 --bind 127.0.0.1
```

Open <http://127.0.0.1:8770/research/verify.html>. It checks successive production intersections against all 867 independent cases. This is a separate ray-continuation regression: it advances the origin using the rendering bias and applies the matching tolerance 1e−4. It is not the all-roots coordinate comparison above. **Save JSON** writes the report; store it as `research/results/webgl-validation.json`. The recorded WebGL run matches all 1,470 roots. Check source hashes when comparing runs, and use a fresh server origin or clear the browser cache after source edits.

Open <http://127.0.0.1:8770/research/benchmark.html>, click **Run benchmark**, keep the tab foregrounded until completion, and **Save JSON** to `research/results/webgl-benchmark.json`. Avoid other GPU workloads while timing. Rerun `plot.py` and update the manuscript timing table when replacing measurements.

The recorded browser is embedded Chromium 157, WebGL 2 / ANGLE Metal on Apple M3 Pro. Each configuration uses five warmup and thirty measured frames. Browser wall time includes a synchronous one-pixel readback, and excludes compilation, UI, vsync and adaptive resolution. Raw samples, uniforms, source hashes, renderer and user agent are recorded. These are draw-and-readback times, not presented-frame FPS or comparative solver-speed measurements.

## Figures and native timings

```sh
node research/render-and-time.mjs
.venv/bin/python research/plot.py
```

The renderer writes PPM images into `research/figures/` directly from the production fragment shader, then benchmarks three scenes at two fixed resolutions and 8, 16 and 24 main-path interactions. Five warmup and thirty recorded frames surround draw plus `glFinish`, excluding readback. `rendering.json` records uniforms, hardware, shader hash and every timing. Native compilation changes only the ES version directive to GLSL 4.10. Native timings and browser timings have different overhead and should be compared separately.

`plot.py` creates six manuscript figures in `technical-note/figures/`. Three diagrams/charts also have vector PDFs. PPM intermediates are regenerated and omitted from the archive. Figures use production renders and recorded data.

## Manuscript and formatting

```sh
./scripts/build-note.sh
python3 scripts/build-latex.py
```

Rebuild the canonical JCGT manuscript separately with `python3 scripts/build-paper.py --pdf` ([instructions](../paper/README.md)). These document generators require Pandoc. Compile the PDF using [the LaTeX instructions](../technical-note/README.md). `npm run build:site` assembles the app, HTML note and PDF for Pages.

JavaScript, HTML and CSS use pinned Prettier 3.6.2: `npm run format:check` and `npm run format`. Python uses Black 25.1.0; Objective-C and embedded GLSL use clang-format 19.1.7. With those optional tools installed:

```sh
black research/*.py scripts/*.py
clang-format -i tests/native-gpu.m research/native-render.m research/*.glsl
python3 scripts/format-glsl.py
```

Source formatting changes hashes. Regenerate reports after changing measured source. `python3 scripts/package-release.py` creates a deterministic local archive with a SHA-256 manifest.
