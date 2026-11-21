# Reproducing the study

Run commands from the project root. Recorded results are under `research/results/`; rerunning replaces those files. Source hashes and the supplementary archive's per-file manifest identify the measured implementation.

## Requirements and regression tests

The application needs an HTTP server and WebGL 2. Research scripts use Node.js, Python 3.12 or later and pinned scientific packages. Native experiments require macOS, Xcode command-line tools (`clang`) and graphics-driver access. Browser experiments also run on other platforms; the recorded hardware results use Apple M3 Pro.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r research/requirements.txt
npm ci
npm test
.venv/bin/python research/test_reference.py
npm run test:gpu
```

There are 24 application tests and five independent-reference tests. Reference tests cover analytic axis roots, a rational double tangent, degree reduction, a contained line and input rounding. The native regression suite checks 625 solid, 403 shell, 133 multi-torus and 31 focused thin-shell rays, 36 production refraction paths, 31 index-one invisibility cases and eight complete-fragment smoke cases.

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

`reference.json` stores inputs, brackets and roots. `run-experiment.mjs` queries successive intersections for the production near/reciprocal solver and a conventional Ferrari baseline, with the same origin offsets. `pole-gpu.json` stores outputs, hashes and baseline sanity checks. [THIRD_PARTY.md](THIRD_PARTY.md) records attribution, numerical choices and permission.

`analyze.py` matches roots one-to-one at relative-distance tolerance 1e−4, with max(1, reference distance) as denominator and the production positive-root cutoff. There is no far-distance cutoff or same-boundary consolidation. A ray fails if any reference root is missing or any output is unmatched. An inaccurate position can contribute to both counts. `analysis.json` retains per-ray classifications and errors for every output relative to its nearest reference.

The production solver passes all 867 rays, matching 1,470 roots with maximum relative-distance error 7.56e−5. Its maximum pole-sweep error is 1.75e−7. The farthest reference hit is about 2.4 billion scene units. The Ferrari baseline fails on 381 rays, including 230 of 600 pole rays. Input rounding alone changes 210 pole-sweep root sets; all sampled nominal |δ| ≤ 1e−9 round onto the pole. These finite tests establish neither universal completeness nor superiority to every modern solver.

## Browser verification and timing

Serve the **project root**, rather than only `web`:

```sh
python3 -m http.server 8770 --bind 127.0.0.1
```

Open <http://127.0.0.1:8770/research/verify.html>. It runs the production GLSL ES intersection function against all 867 independent cases, with the same matching rule. **Save JSON** writes the report; store it as `research/results/webgl-validation.json`. The recorded WebGL run matches all 1,470 roots. Check source hashes when comparing runs, and use a fresh server origin or clear the browser cache after source edits.

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

Both require Pandoc. Compile the PDF using [the LaTeX instructions](../technical-note/README.md). `npm run build:site` assembles the app, HTML note and PDF for Pages.

JavaScript, HTML and CSS use pinned Prettier 3.6.2: `npm run format:check` and `npm run format`. Python uses Black 25.1.0; Objective-C and embedded GLSL use clang-format 19.1.7. With those optional tools installed:

```sh
black research/*.py scripts/*.py
clang-format -i tests/native-gpu.m research/native-render.m research/ferrari.glsl
python3 scripts/format-glsl.py
```

Source formatting changes hashes. Regenerate reports after changing measured source. `python3 scripts/package-release.py` creates a deterministic local archive with a SHA-256 manifest.
