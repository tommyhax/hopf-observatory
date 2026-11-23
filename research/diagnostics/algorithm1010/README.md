# Corrected Algorithm 1010 in the shader

**Final evaluation: investigation closed. Bernstein remains the production
default; Algorithm 1010 remains experimental.** The
[browser adoption pass](final/README.md) and the controlled
[2×2 solver/traversal comparison](traversal/README.md) establish that the native
gains below do not carry over to the tested WebGL shell workloads.

Holding the original loop constant, Algorithm 1010 takes **37.2% more GPU time
for three aligned thin shells and 55.1% more near the projection pole**.
Expansion adds 7.8% and 3.0% to Algorithm 1010's time, respectively: it partly
explains the aligned-shell slowdown and makes little difference near the pole,
but is not the main cause. Bernstein has lower pooled medians under either
traversal in all four scenes; the small single-object effects vary between
measurement blocks.

All four variants pass the existing WebGL correctness suite, and all 24
within-solver loop/expanded image pairs are bit-identical across the four
scenes and three rendering modes. Looped Algorithm 1010's known native OpenGL
failure remains an additional portability limitation. The results support
retaining the current default, with no further optimization work planned in
this investigation. Detailed measurements, attribution, numerical limitations
and immutable historical records remain in the linked reports.

Experiment dated 23 November 2026. Orellana–De Michele quartic factorization is
a viable performance candidate for this renderer: the centered-coordinate
variant reduced native frame time by **21–44% at 1280×720** across four scenes
on an Apple M3 Pro. Both variants pass the original ray corpus, independent
polynomial fixtures, and the complete native optical-transport suite. The
production renderer remains unchanged; this directory contains the runnable
research variants and their evidence.

This is an algebraic/numerical hybrid. It constructs two quadratic factors,
refines their coefficients, extracts roots with stable quadratic formulas, and
uses the renderer's existing homogeneous root refinement. It does not march
along the ray, and it does not remove numerical iteration altogether.

## Implementation

[solver.glsl](solver.glsl) ports Algorithm 1010 to float32 GLSL, including the
2024 correction for near-degenerate factorization. It supports exact degree
loss, zero constant terms, real and conjugate-complex factors, and repeated
roots. There is no fallback to Bernstein or Yuksel. [SOURCES.md](SOURCES.md)
records primary references, source fingerprints, licensing, and deliberate
adaptations; the upstream BSD notice is retained in [LICENSE](LICENSE).

[renderer.mjs](renderer.mjs) supplies two replacements:

- `odm-direct`: solve the centered ray polynomial directly.
- `odm-charts`: solve within the existing near/reciprocal coordinate charts.

Both preserve the existing homogeneous refinement and optical behavior. The
adapter also expands the fixed three-object scene loop. With the original
loop, the larger backend produced inconsistent object IDs/levels on the native
Metal stack; expansion fixes the tested cases. This suggests a compilation
issue, whose precise cause remains unproven. The initial failures and original
adapter source are preserved in [integration-initial.json](results/integration-initial.json).
Timings therefore measure the complete replacement, including this change,
rather than isolating the factorization algorithm's cost.

## Root accuracy

Reference geometry is the unchanged, uploaded float32 geometry, expanded with
exact rational arithmetic. Every distinct positive intersection is matched at
`abs(actual-reference) / max(1, abs(reference)) <= 1e-4`. A query fails for any
missing, spurious, nonfinite, or inaccurate root. There is no finite far cutoff
or rendering bias. Raw and homogeneously refined roots are retained separately.

Both native OpenGL and Chrome WebGL2 pass **54/54 independent polynomial
fixtures**, including exact degree loss, repeated roots, separated scales,
the corrected paper's biquadratic regression, and perturbations around a
quadruple root. Fixture references are exact-rational isolations of the
float32-rounded coefficients, not the intended pre-rounding polynomials.

The following counts use the common homogeneous refinement:

| Backend | Method | Failed original rays / 867 | Failed stress queries / 2,400 |
| --- | --- | ---: | ---: |
| Native | Production Bernstein | 0 | 109 |
| Native | ODM direct | 0 | 109 |
| Native | ODM charts | 0 | 109 |
| WebGL2 | Production Bernstein | 0 | 123 |
| WebGL2 | ODM direct | 0 | 119 |
| WebGL2 | ODM charts | 0 | 119 |

All methods recover all **1,470 original intersections** on each backend, both
raw and refined. All stress failures are in the 600-case grazing family;
the other 1,800 queries pass. Native ODM fails on exactly the same 109 query
IDs as Bernstein. On that stress corpus it matches 3,165 of 3,314 roots with
137 extras; Bernstein matches 3,166 with 137 extras. Equal failed-query counts
therefore do not mean identical root outputs.

The native Bernstein/Ferrari baseline replay matches the prior captured
results exactly. Browser arithmetic differs from the native stack, so its
cross-backend replay mismatches are expected and are recorded, not used as
a browser pass criterion. The small browser failure-count improvement is not
evidence of universal superiority. The existing
[grazing diagnostic](../grazing/README.md) explains why rounded coefficient
construction can already lose the represented surface's roots; replacing the
root solver alone cannot repair that information loss.

See [native analysis](results/analysis.json), [WebGL analysis](results/webgl-analysis.json),
and the full root captures [native](results/gpu.json) / [WebGL](results/webgl.json).

## Optical transport and images

Both variants pass the complete native suite:

| Check | Passed |
| --- | ---: |
| Thin-shell crossing sequences | 31/31 |
| Snell paths | 36/36 (392 interfaces) |
| Index-one paths | 31/31 |
| Solid intersections | 625/625 |
| Shell intersections | 403/403 |
| Scene intersections | 133/133 |
| Complete fragment checks | 8/8 |

This includes all 24 crossings through three thin shells. Reports are saved
for [direct](results/transport-odm-direct.json) and [charts](results/transport-odm-charts.json).
Full optical transport was tested natively; the browser experiment checks
polynomial and ray-root accuracy, not complete browser transport.

The image comparison renders five scenes in three modes at 480×270. Across
all four thin-shell scenes and all modes, either variant differs from the
production baseline by at most one RGB8 code value. The solid physical image
has two pixels exceeding three codes for direct and one for charts; the
largest channel differences are 86 and 25 codes respectively. These isolated
differences remain unresolved. Production is a comparison baseline, not an
independent image reference, and these sampled images do not prove general
equivalence. The other two solid modes are pixel-identical.

See [image metrics](results/render-comparison-analysis.json) and the
[contact sheet](figures/render-comparison.png), which shows production physical
images beside absolute differences amplified eightfold. The full render
[capture](results/render-comparison.json) retains uniforms and shader hashes.

## Performance

Native OpenGL 4.1 Metal 90.5 on Apple M3 Pro; full optical renderer with a
24-interaction budget. Each configuration uses three rotating-order blocks,
each with five warmup frames and ten measured frames. Values below are median
draw-plus-`glFinish` wall times over 30 measured frames, excluding compilation,
readback, UI, and vsync. These are not browser FPS measurements.

| Scene at 1280×720 | Bernstein ms | ODM direct ms | ODM charts ms | Direct time reduction |
| --- | ---: | ---: | ---: | ---: |
| Single solid | 3.12 | 1.98 | 2.51 | 36.6% |
| Single 0.01 shell | 5.63 | 3.13 | 4.06 | 44.4% |
| Three thin shells | 20.17 | 13.45 | 15.13 | 33.3% |
| Three thin shells near pole | 46.81 | 37.02 | 38.62 | 20.9% |

Both variants also beat Bernstein at 640×360; direct reduces time by 24–49%
there. Direct is fastest in all eight tested scene/resolution combinations.
[benchmark.json](results/benchmark.json) contains individual samples, quartiles,
block medians, uniforms, hardware, and source/shader hashes. Near-pole timings
show substantial between-block variation; these results are evidence from
one GPU/compiler stack, not a portable speedup guarantee.

The centered variant is the fastest Algorithm 1010 variant in the native study;
the final browser evaluation nevertheless supports retaining Bernstein.
Remaining limits include grazing coefficient error, the float32 tie-handling
choice documented in SOURCES, the scene-loop workaround, incomplete upstream
extreme-range rescaling support, and validation on a single GPU.

## Reproduce

From the repository root with the existing Node and Python dependencies:

```sh
.venv/bin/python research/diagnostics/algorithm1010/generate-fixtures.py
node research/diagnostics/algorithm1010/run.mjs
.venv/bin/python research/diagnostics/algorithm1010/analyze.py
node research/diagnostics/algorithm1010/run-browser.mjs
.venv/bin/python research/diagnostics/algorithm1010/analyze.py --input research/diagnostics/algorithm1010/results/webgl.json --output research/diagnostics/algorithm1010/results/webgl-analysis.json
node research/diagnostics/algorithm1010/run-suite.mjs --variant=odm-direct
node research/diagnostics/algorithm1010/run-suite.mjs --variant=odm-charts
node research/diagnostics/algorithm1010/run-suite.mjs --benchmark
node research/diagnostics/algorithm1010/run-renders.mjs
.venv/bin/python research/diagnostics/algorithm1010/analyze-renders.py
```

GPU commands require macOS graphics-driver access. The WebGL runner uses
Playwright with the installed Google Chrome in a fresh headless profile and
rejects software rendering. Outputs stay within this directory. Generated PPM
images are ignored by Git and can be regenerated; metrics and the contact
sheet are retained. Inputs and executable sources are hashed, and the original
research frozen manifest remains unchanged.
