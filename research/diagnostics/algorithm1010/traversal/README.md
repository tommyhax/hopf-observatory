# Controlled WebGL solver × traversal comparison

**Traversal expansion partly explains the aligned three-shell slowdown, but
makes little difference near the projection pole. It is not the main cause of
Algorithm 1010's slower WebGL rendering.** With the original loop held fixed,
Algorithm 1010 still takes 37.2% more GPU time for three aligned shells and
55.1% more near the pole in this run.

This is a bounded follow-up to the [accepted WebGL benchmark](../final/README.md).
Only the four existing shaders are evaluated. Production, the manuscript,
the earlier benchmark records and review releases are unchanged. The known
native OpenGL failure of looped Algorithm 1010 remains a portability blocker;
this experiment neither reruns nor investigates that failure.

## Four-way timing result

Median GPU elapsed time in milliseconds, 1280×720, Apple M3 Pro, Chrome 157 /
WebGL2 / ANGLE Metal. Each cell contains 30 individually completed frames from
three blocks. All entries below come from this same new run.

| Scene | Bernstein loop | Bernstein expanded | ODM loop | ODM expanded |
| --- | ---: | ---: | ---: | ---: |
| Single solid | 4.881 | 4.702 | 5.114 | 5.043 |
| Single 0.01° shell | 10.187 | 9.304 | 10.705 | 10.920 |
| Three 0.01° shells | 33.477 | 31.359 | 45.943 | 49.511 |
| Three shells near pole | 86.719 | 84.342 | 134.460 | 138.488 |

Positive percentages below mean **more GPU time**, negative percentages mean
less. Expansion compares expanded/looped within one solver; solver comparisons
compare ODM/Bernstein with the indicated traversal held constant.

| Scene | Expansion: Bernstein | Expansion: ODM | ODM vs Bernstein, loop | ODM vs Bernstein, expanded |
| --- | ---: | ---: | ---: | ---: |
| Single solid | -3.7% | -1.4% | +4.8% | +7.3% |
| Single 0.01° shell | -8.7% | +2.0% | +5.1% | +17.4% |
| Three 0.01° shells | -6.3% | +7.8% | +37.2% | +57.9% |
| Three shells near pole | -2.7% | +3.0% | +55.1% | +64.2% |

For aligned three-shell rendering, the mixed-traversal comparison's 16.034 ms
gap decomposes algebraically into 12.466 ms between looped solvers and
3.568 ms from expanding ODM. Expansion accounts for about **22% of that gap**.
Near the pole the corresponding gap is 51.769 ms: 47.741 ms between looped
solvers and 4.028 ms from expansion, approximately **8% of the gap**. These
are descriptive decompositions of the same-run medians, not independent
causal estimates; shader compilation and traversal can interact.

Bernstein has lower pooled median time under either traversal in all four
scenes. The small single-object differences should not be treated as robust
speed guarantees. For the three-shell scenes the ranking persists in every
paired block: looped ODM costs 32.9–39.0% more for aligned shells and
53.4–56.9% more near the pole. ODM's expansion penalty is 2.9–15.6% and
0.5–1.9%, respectively, when comparing individual block medians. The latter
range differs from the 3.0% pooled-median estimate because pooling and taking
ratios do not commute.

The older mixed-traversal benchmark remains intact. Its absolute times should
not be pooled with this run: scheduling/thermal variability is visible, and
the purpose here is the controlled comparison within this run. The data do
not support attributing the shell slowdown primarily to the traversal
workaround, or switching the production solver.

## Correctness and output consistency

All four shaders pass a fresh execution of the unchanged complete WebGL suite:
31 thin-crossing cases, 36 Snell paths / 392 interfaces, 31 index-one checks,
625 solid cases, 403 shell cases, 133 scene cases and eight complete-fragment
checks. Each variant's result record exactly matches its previous WebGL suite.
The new `results/webgl-transport-*.json` reports contain the same fragment
hashes used for timing. No new numerical corpus was introduced.

**All 24 within-solver loop/expanded image pairs are bit-identical**, across
four scenes, three rendering modes and two solvers at 1280×720. Thus traversal
expansion changes measured execution cost without changing any captured
output pixel. The [comparison sheet](figures/traversal-output-comparison.png)
shows material images beside amplified traversal differences; those difference
panels are exactly black. Lossless captures of all 48 images are retained.

Across solvers, the shell scenes differ by at most two RGB8 code values;
normal and depth views differ by at most one. In the solid material image,
27 of 921,600 pixels differ, five by more than three codes, with a maximum
channel difference of 51 codes. Its normal and depth views are identical.
These are solver-dependent differences shared by both traversal forms, so
they do not explain the traversal effect. The prior study diagnosed sensitive
internal-reflection paths; this experiment does not investigate new pixels
or claim an independent physical image reference.

The [preservation record](results/preservation.json) verifies that the previous
reports, production shader, manuscript and release files are unchanged, along
with all 65 paths in the original frozen baseline manifest.

## Protocol and saved evidence

`run.mjs` imports the unchanged `final/browser-gpu.mjs` timing adapter and
`final/variants.mjs` shader assembler. It verifies that all four source shader
hashes match the previously passing WebGL transport captures. The two shaders
from the accepted timing run also retain those exact hashes. Reports include
both assembled-source hashes and hashes after the adapter's explicit output
location declaration.

The four accepted 720p scenes and their complete uniforms are read from the
accepted browser benchmark, including the 24-interaction cap. A fresh Chrome
profile uses the same hardware backend and browser version. The accepted
forward/reverse alternation is extended to the ordered list `production`,
`production-unrolled`, `odm-loop`, `odm-direct`: reverse when
`(round + sceneIndex)` is odd. Each cell has three blocks, five warmups and ten
measured frames per block. With three blocks, order positions are only partly
balanced; full block distributions are retained to expose drift.

Each draw has its own `EXT_disjoint_timer_query_webgl2` query and synchronous
one-pixel completion readback before the next draw. Disjoint samples reject
the run. GPU elapsed and draw-plus-readback wall times are recorded separately.
Compilation, warmup, query-result polling, Playwright IPC, full-image capture,
UI and vsync are excluded from timing. No other GPU work from this experiment
runs during the timed portion. These are offscreen WebGL costs, not interactive
display FPS or native OpenGL measurements.

- [Raw timing records](results/benchmark.json): every sample, block order,
  uniforms, hardware and source/input/shader hashes.
- [Analysis](results/analysis.json): minimum, p05, quartiles, median, p95,
  maximum, block medians, paired effects, correctness and image metrics.
- [Timing distributions](figures/timing-distributions.png): all samples and
  box plots for each scene; block colors expose temporal variation.
- [Render manifest](results/renders.json): lossless RGBA8 captures, uniforms
  and image hashes. Images are 1280×720 in material, normal and depth modes;
  full-image readback occurs after the timed portion.

## Reproduce

From the repository root with the existing dependencies and installed hardware
Chrome. Run the timed command without other GPU jobs.

```sh
node research/diagnostics/algorithm1010/traversal/run.mjs
for variant in production production-unrolled odm-loop odm-direct; do
  node research/diagnostics/algorithm1010/traversal/run-correctness.mjs "--variant=$variant"
done
.venv/bin/python research/diagnostics/algorithm1010/traversal/analyze.py
```

The correctness wrapper runs the existing complete WebGL transport suite,
changing only its report destination. It introduces no numerical corpus.
All new reports and figures are confined to this directory. A fresh run
overwrites this experiment's outputs only; earlier results remain untouched.
