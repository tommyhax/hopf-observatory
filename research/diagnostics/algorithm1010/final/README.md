# Adoption decision: retain Algorithm 1010 as experimental

23 November 2026, Apple M3 Pro. **Keep Bernstein as the production default.**
The centered Algorithm 1010 candidate passes the tested correctness checks,
but its native speedup does not carry over to the actual browser backend.
Chrome 157 / WebGL2 / ANGLE Metal takes approximately 20%, 44% and 60% more
GPU time for the three shell workloads. This is sufficient blocking evidence;
no further optimization, new solver, or expanded stress campaign was attempted.

The production shader, previous research captures, and existing `release/`
artifacts remain unchanged. The research implementation and this evaluation
are committed alongside a short manuscript addition. The earlier technical
note and its browser edition remain the frozen study; this report supplies
the new technical evaluation.

## Comparable measurements

Both implementations use the exact four native benchmark scenes and uniforms,
1280×720 resolution and a 24-interaction budget. Columns within each backend
are comparable; native wall time and browser GPU time are distinct metrics.

| Scene | Native Bernstein ms | Native ODM ms | Native time reduction | WebGL Bernstein ms | WebGL ODM ms | WebGL time reduction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Single solid | 3.124 | 1.981 | 36.6% | 4.818 | 4.909 | -1.9% |
| Single 0.01° shell | 5.632 | 3.131 | 44.4% | 8.920 | 10.710 | -20.1% |
| Three 0.01° shells | 20.169 | 13.454 | 33.3% | 32.582 | 47.024 | -44.3% |
| Three shells, XW = 45° | 46.810 | 37.019 | 20.9% | 83.405 | 133.288 | -59.8% |

Negative reduction means slower. The solid result is effectively a tie given
the observed variability. The substantial shell slowdown is the adoption
blocker, independently of that small difference.

The [native capture](../results/benchmark.json) measures draw-plus-`glFinish`
wall time with the existing RGBA32F offscreen harness, excluding readback.
The [browser capture](results/webgl-benchmark.json) uses a fresh, hardware
Chrome profile and an RGBA8 offscreen WebGL framebuffer. Each scene/variant has
three alternating-order blocks of five warmup and ten measured frames.
`EXT_disjoint_timer_query_webgl2` brackets each draw. A synchronous one-pixel
readback completes that frame before submitting the next; a disjoint result
rejects the run. Compilation, warmup, query-result polling, Playwright IPC,
full-image readback, UI and vsync are outside the measurements.

As a cross-check, median browser draw-plus-readback wall times for Bernstein /
ODM are **5.45 / 5.50**, **9.85 / 11.50**, **33.45 / 47.75**, and
**84.10 / 134.10 ms**, respectively. These confirm the same ranking. These are
offscreen completed-frame costs, not interactive display FPS or a cross-device
claim. All raw samples and block summaries are retained.

Two timing pilots are explicitly rejected and preserved with their exact
source snapshots: [per-draw queries around queued frames](results/webgl-timing-initial.json)
reported overlapping elapsed times; [one query around repeated queued draws](results/webgl-timing-batched.json)
undercounted distinct-frame cost by approximately thirtyfold. Elimination of
earlier identical opaque fullscreen draws is a plausible explanation for the
latter. The accepted protocol completes every frame and obtains consistent
GPU and wall measurements. Neither rejected pilot supports the performance table.

## Correctness and remaining grazing failures

The final [WebGL replay](results/webgl-roots.json) passes all **54 Algorithm
1010 polynomial fixtures**. All **867 original ray records** reproduce the
previous browser capture exactly, including every raw and refined output for
both solvers; all 1,470 reference intersections remain matched. The earlier
native fixture and ray checks also pass, with identical final solver sources.

The native stress failure set is checked by **query ID**, not aggregate count.
Both ODM coordinate variants and production Bernstein have precisely the same
109 grazing IDs, both raw and refined, as the prior captured-coefficient
diagnostic. The comparison is recorded by `verify-results.py`. All other
1,800 stress queries pass. The browser's previously captured stress counts
remain different (119 ODM, 123 Bernstein); the native 109 must not be described
as a browser result. No new stress corpus was generated.

The complete existing optical regression suite passes for production and
centered ODM in both native OpenGL and browser WebGL: 31 thin-crossing cases,
36 Snell paths / 392 interfaces, 31 index-one checks, 625 solid cases,
403 shell cases, 133 scene cases, and eight complete-fragment checks. These
exercise multiple thin shells, refraction/TIR, and projection-pole crossings.
All 24 crossings through three 0.01° shells are retained. Reports are named
`results/{native,webgl}-transport-{production,odm-direct}.json`.

## Two isolated solid-scene pixels

The investigation is restricted to the previously observed pixels (284,77)
and (312,126), using top-left image coordinates in the existing 480×270 solid
scene. Full-size raster sampling preserves `gl_FragCoord`; replacing it with
a uniform was insufficient for the first round-off-sensitive pixel and was
not used for the conclusions. The instrumented full-raster probes reproduce
the uninstrumented float colors exactly.

[Exact-reference analysis](results/pixel-analysis.json) checks every captured
incoming ray against exact-rational roots of the represented geometry, selects
the nearest root above the existing bias, and independently checks normals
and reflected/refracted continuation. All checks pass. Maximum relative
hit-distance error across the eight captured paths is **6.54e-7**. Terminal
misses, where reached, have no remaining admissible intersection. The raw
[native](results/pixels-native.json) and [WebGL](results/pixels-webgl.json)
captures retain origins, directions, hits, normals and pixel colors.

The native paths encounter all 24 primary boundaries and undergo 22 or 23
total internal reflections. A one-ULP-scale early hit difference grows through
these repeated reflections. At (312,126), the two final incoming directions
differ by up to 1.45 in a component and their late TIR decisions differ; at
(284,77), the corresponding difference is about 0.00434. Thus the colors do
change, but there is no observed wrong nearest root, skipped boundary, or
Snell error for the captured incoming states. The evidence supports accumulated
round-off sensitivity and finite-budget termination, not an identified solver
regression or a guarantee of exact image equivalence.

Browser outputs differ less at these two pixels (maximum channel differences
0.00210 and 0.02135). That is another backend-specific observation, not a
high-precision physical image reference. The original image comparison also
covers material, normal and depth modes; it is retained in the parent study.

## Three-object traversal control

`variants.mjs` constructs four controls from the same shader: Bernstein with
its original loop, Bernstein with the candidate's expanded traversal, ODM with
the original loop, and ODM with expanded traversal. It changes only `sceneHit`.
The looped ODM control's shader hash matches the initially failing shader
exactly.

| Backend | Bernstein loop | Bernstein expanded | ODM loop | ODM expanded |
| --- | --- | --- | --- | --- |
| Native OpenGL | Pass | Pass | Fail: 28/31 thin, 114/133 scene | Pass |
| Browser WebGL | Pass | Pass | Pass | Pass |

The native looped failures reproduce the initial failure reports; complete
reports, including the failing control, are retained. The expanded ODM shader
passes on separate native runs and separate browser contexts. The same
expanded shader hash is used in its transport checks and performance captures.
Bernstein's complete result records are identical with looped and expanded
traversal on each backend.

Code inspection finds equivalent traversal order (object 0 through 2, low
boundary before high), identical strict nearest-hit tie behavior, preserved
`uCount=0` probe semantics and enabled/shell guards, initialized outputs and
bounded indices. Intersection code does not write uniforms or traversal state;
there is no recursion, derivative-dependent control, or synchronization in this
path. Root storage is initialized and bounded by degree four. No uninitialized
shader state or undefined indexing was identified. This is an audit plus
regression evidence, not a formal absence-of-undefined-behavior proof.

The workaround is reliable for the tested configurations and consistent with
a native compilation issue. Its exact cause remains unknown. No compiler
investigation beyond these controls was attempted, and the passing browser
loop control was not developed into a new optimization variant.

## Algorithm, attribution and limits

The port follows Orellana and De Michele's
[Algorithm 1010 (2020)](https://doi.org/10.1145/3386241), incorporating De
Michele's [revised 2024 correction](https://doi.org/10.1145/3674833). It forms
two quadratic factors, refines their coefficients, and extracts real roots
with stable quadratic formulas. The implementation reference is the
BSD-licensed OpenMC port; retain the authors' [licence](../LICENSE).

[SOURCES.md](../SOURCES.md) specifies the float32 adaptations: machine epsilon
`2^-23`, the correction's `sqrt(epsilon)` comparison neighborhood, finite and
residual checks, up to 20 factor-refinement iterations, algebraic degree-loss
handling, and the real-factor tie choice needed by a quadruple-root fixture.
The application still applies its common homogeneous refinement and acceptance
filter. This is an algebraic/numerical hybrid, not purely closed-form arithmetic.

Exact root solving cannot recover geometric information already lost while
forming float32 coefficients. The [captured-coefficient study](../../grazing/README.md)
reproduces the same 109 native failure IDs even with exact isolation. The port
also lacks all upstream extreme-range rescaling fallbacks; the near-real
complex-root policy and tie choice are not universal tangency guarantees.
Origin offsets, the 24-interaction limit, sensitive reflection paths and the
unresolved native traversal issue remain material limits. This one-device
evaluation justifies retaining the existing browser implementation, not
rejecting Algorithm 1010 as a general numerical method.

## Reproduce the bounded pass

Use the existing Node/Python dependencies from the repository root; GPU steps
require graphics-driver access and installed hardware Chrome. Run GPU jobs
sequentially, especially while timing.

```sh
node research/diagnostics/algorithm1010/final/benchmark-webgl.mjs
node research/diagnostics/algorithm1010/final/run-roots.mjs
node research/diagnostics/algorithm1010/final/inspect-pixels.mjs
node research/diagnostics/algorithm1010/final/inspect-pixels.mjs --webgl
.venv/bin/python research/diagnostics/algorithm1010/final/analyze-pixels.py
for backend in --native --webgl; do
  for variant in production production-unrolled odm-loop odm-direct; do
    node research/diagnostics/algorithm1010/final/run-webgl-suite.mjs "$backend" "--variant=$variant"
  done
done
.venv/bin/python research/diagnostics/algorithm1010/final/verify-results.py
```

The native `odm-loop` control intentionally exits with a failing regression
status. All production and expanded-candidate suites must pass. The verifier
checks source/input hashes, the frozen baseline, shader identity across runs,
the original-ray replay, exact grazing failure IDs, and the recorded adoption
decision. Source snapshots in the two rejected timing reports preserve their
historical provenance without pretending they describe the accepted protocol.
