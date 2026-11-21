# Final independent validation

This is the fixed final validation pass, not a solver-development branch. The production shader is unchanged from revision `e49349dd91defdc1d86961ec68b472a7f0f24efe` (SHA-256 `a81b18cb46201bd13822eed8dcab85e598ae8a131477ae1574584dff9492d2e3`). Numerical failures are retained. The short review manuscript is [PAPER.md](../PAPER.md); the main reproduction guide is [README.md](README.md).

## Corpus and references

`stress-reference.py` fixes seed **20261121** and **2,400 boundary queries** before GPU execution:

| Family | Construction | Queries |
|---|---|---:|
| Random | Six independent SO(4) angles, parameters 1–89°, random directions, camera scales 0.01–1,000; half aimed through a sampled torus point | 600 |
| Pole | 100 rotations/rays, six levels each: nominal pole, ±1e−6 and ±1e−10 level offsets, and one adjacent float32 level | 600 |
| Grazing | 200 exact rational spatial rotations and rational ring tori; each has an exact outer tangent and two normal offsets with magnitudes 1e−3–1e−10 | 600 |
| Shell | 100 shared-projector groups, three 0.01° shells and six boundaries each; 40 overlapping bands, 40 separated bands, 20 pole-boundary groups | 600 |

Rotation angles are independent uniform draws, not Haar-uniform SO(4) samples. These deliberate stress weights are not an estimate of failures in normal viewing. Shared-projector level surfaces do not geometrically intersect; overlapping **material bands** exercise boundary ordering and medium priority. Related wall queries share the original ray, so 2,400 is a boundary-query count, not 2,400 unrelated scene configurations.

The reference imports only the independent exact-rational machinery in `reference.py`, not production intersections. It expands the original quartic and uses SymPy continued-fraction isolation with rational brackets of width at most 1e−30. Intended geometry is serialized at 80 decimal digits; tangent constructions use exact rationals and all 200 intended contacts are verified double roots. Float32 inputs are converted to their exact rational values for the represented reference. Both references include every distinct positive root and multiplicity. The largest represented hit is approximately 3.546×10⁸ scene units.

The GPU collector uses the same all-original-ray protocol as the existing comparison: no advancing origin, near bias or finite far clipping; only identical float positions are consolidated. Bernstein and both Yuksel–Peters configurations are tested raw and after common guarded refinement/residual filtering. The production solver is not changed in response to these results.

## Root results

At tolerance `abs(sGPU-sRef)/max(1,abs(sRef)) <= 1e-4`:

| Family | Reference roots | Intended/represented mismatches | Refined failures, each modern solver |
|---|---:|---:|---:|
| Random | 861 | 0/600 | 0/600 |
| Pole | 501 | 253/600 | 0/600 |
| Grazing | 584 | 304/600 | 109/600 |
| Shell boundaries | 1,368 | 13/600 | 0/600 |
| Total | 3,314 | 570/2,400 | 109/2,400 |

The same 109 query IDs fail in all three variants, raw and refined. After refinement, Bernstein matches 3,166 roots (148 missing, 137 unmatched outputs); each Yuksel variant matches 3,165 (149 missing, 137 unmatched outputs). Each method has 40 failed queries with too few outputs, 34 with too many, and 35 with equal counts but unacceptable positions. “Unmatched” includes inaccurate candidates outside the matching tolerance, not only geometrically extraneous intersections. The difference of one matched root is not meaningful evidence of superiority.

At tolerances 1e−5 and 1e−6, refined failed-query counts are respectively **197/195/195** and **294/292/292** for Bernstein/centered Yuksel/chart Yuksel. Raw and refined tables, per-family errors and every failed principal-tolerance case are retained in `results/stress-analysis.json`. It also records representative count-shortfall, excess and position failures by ID; the exact inputs and brackets are in `stress-reference.json`.

Input changes and represented-root failures are different comparisons and may overlap. The former compare intended geometry against uploaded geometry; the latter test the entire float32 intersection computation, including coefficient construction, isolation and refinement. Their counts must not be added. Float32-rounded projectors need not remain exactly rank-two or idempotent. A represented geometry may therefore have different grazing or remote roots before the GPU solver begins.

Conditioning diagnostics flag multiple roots, nearest-root separation below 1e−4 relative distance, and a coefficient condition proxy above 1e4. At the principal tolerance, 17 failed queries have close represented roots and 51 have a large proxy; flags overlap. Queries with no real reference root cannot have a real-root condition estimate. These flags characterize cases, not a unique cause: the methods share some construction and acceptance code. All solver failures lie in the deliberately grazing family.

For Bernstein, maximum nearest-output relative ray-distance error is 7.98e−4. Across outputs with a reference neighbor, maximum position-normalized error is 2.94e−4; maximum absolute position error is 31.5 units for a pole hit around 3.55×10⁸ units away. Position percentiles and maxima are reported separately. Nearest-output error cannot describe a missing root or establish one-to-one completeness; the matching counts remain primary.

All 100 shell groups retain every represented boundary intersection and its order at 1e−4. Tighter-tolerance group failures are also retained. These are straight-ray boundary tests; refraction is evaluated separately below.

## Independent transport checks

`stress-transport.mjs` selects groups `[0,1,20,21,40,41,60,61,80,81,98,99]` without selecting on success. It instruments the actual production `trace()` for each renderer variant and records the incoming origin/direction, hit, normal, media, indices, transmitted direction, TIR and hidden-boundary events. Earlier bounces and all transport branches remain unchanged.

`analyze-transport.py` independently isolates the original polynomial on **each captured incoming ray against all six represented boundaries** and checks the nearest intersection beyond the production cutoff. High-precision analytic gradients and spatial probes check normals and media. Vector/scalar Snell checks use tolerance 2e−4; hit distances use 1e−4. This separates local optical calculations from the all-roots study; it is not an independent global-light-transport reference.

Each of the three variants passes all 12 selected paths: **167 boundary events, 158 optical events, nine hidden boundaries, 73 air-to-material entries, 71 exits, five TIR events and nine inter-material transmissions**. Group 20 reaches the 24-boundary cap; group 81 terminates at the energy cutoff. Neither is claimed as a complete path. All other terminal misses are checked for remaining forward roots. The largest distance error across variants is 3.963e−6; the largest normal error is 2.651e−7 and Snell residual 9.291e−8. These results supplement, rather than replace, the existing 36-path/392-event transport regression.

## Complete-render comparison and cost

Five scenes are rendered in material, normal and depth modes, at 480×270, by all three complete renderers. The scenes include three 0.01° shells at XW angles 44.995°, 45° and 45.005°. This gives 30 comparisons against Bernstein. The comparator uses final RGB8 output, after tone mapping and vignette; Bernstein is a baseline image, not ground truth.

Maximum frame-mean absolute normalized RGB error is 2.82e−6. There is one pixel above 0.05 in the centered-Yuksel single-solid image, with maximum difference 0.341. No other comparison has a pixel above 0.05. Normal/depth maps agree exactly or to very few code values. Thus image agreement is close but not exact. `figures/render-comparison.png` shows the physical renders and absolute differences amplified eightfold. Per-image hashes and error distributions are retained. PPM intermediates are generated by the script and omitted from the package.

The existing repeated native timing benchmark was rerun. At 1280×720, three thin shells near the pole take median **38.45 ms** with Bernstein, **67.69 ms** with centered Yuksel and **45.74 ms** with chart Yuksel. Single-solid medians are **3.13/2.86/2.88 ms**. Small differences and between-block variation are not evidence of general speed superiority. These are draw-plus-completion timings on one M3 Pro, not presented-frame FPS or cross-platform results.

## Reproduce

Use the pinned environment from [README.md](README.md), from the project root:

```sh
.venv/bin/python research/stress-reference.py
node research/run-stress.mjs
.venv/bin/python research/analyze-stress.py
node research/stress-transport.mjs
.venv/bin/python research/analyze-transport.py
node research/compare-renders.mjs
.venv/bin/python research/analyze-renders.py
.venv/bin/python research/plot-stress.py
node research/benchmark-renderers.mjs
```

Native GPU commands require macOS graphics-driver access. Avoid simultaneous GPU work while timing. The reference uses four CPU worker processes and deterministic output ordering. Revision provenance is fixed to the frozen baseline, so the reference is reproducible from the unpacked package without Git metadata. Every measured source/input has a SHA-256 digest; analyzers reject stale reports. [`check-evidence.py`](check-evidence.py) checks the report chain and unchanged production shader without rerunning GPU experiments.

Byte-for-byte corpus regeneration was verified in the recorded macOS/Python environment. Python's Gaussian sampling uses platform math functions, so the archived exact inputs are authoritative for cross-platform replay; CI checks their provenance and recorded analyses rather than requiring identical regenerated random directions on every platform.

The results establish sampled strengths and failures. They do not establish general completeness, certified tangency resolution, an all-path thin-shell guarantee, a globally accurate optical solution, or priority over existing methods. These are documented limits for outside review, not an invitation to another optimisation cycle.
