# Hardware validation

The current shader passes numerical checks on **Apple M3 Pro**, vendor Apple, OpenGL **4.1 Metal – 90.5**. Execution time is recorded in UTC in [gpu-results.json](gpu-results.json); the local date is 21 November in Pacific/Auckland. That file includes SHA-256 hashes of the shader, mathematical reference, scene code and test harness.

## Execution and scope

Run `npm run test:gpu` from the project directory on macOS with Xcode command-line tools installed. `node scripts/run-gpu-checks.mjs --suite=thin` runs the focused subset. `HOPF_GPU_REPORT=/absolute/path/report.json` selects another report destination.

The Node runner compiles `tests/native-gpu.m`, creates an accelerated offscreen OpenGL context, draws a fullscreen triangle into four 1×1 RGBA32F attachments and reads numerical results. It uses the production GLSL source, changing only `#version 300 es` to `#version 410 core` for the native compiler. Eight smoke checks also execute the complete production fragment shader, covering all seven environment modes and a chrome scene rotated through the pole. The panorama mode uses a one-pixel test texture.

These are native hardware arithmetic and transport checks. The independent WebGL study below checks the browser compilation path.

## Results

| Check | Passed | Detail |
|---|---:|---|
| Focused thin-shell intersections | 31/31 | 296 hits; widths 0.01°, 0.05°, 0.5°, 3°, with endpoint clamping |
| Solid intersections | 625/625 | 496 hits; random rotations, tangencies, pole neighborhoods |
| Shell intersections | 403/403 | 1,305 contacts; both walls at and around their pole crossings |
| Three-torus intersections | 133/133 | 467 hits; random rotations and 24-crossing paths |
| Production refraction paths | 36/36 | 392 events: 187 entries, 181 exits, 24 total internal reflections |
| Index 1, opacity 0 invisibility | 31/31 | Maximum linear-color error: 0 |
| Complete fragment shader smoke checks | 8/8 | Finite RGBA output, no OpenGL error |

All **24 CPU tests** also pass. These include independent analytic axis roots and a check that applying width to all three respects the smallest allowable width while preserving other settings.

For single **0.01°** shells at t = 1°, 5°, 25°, 45°, 65°, 85°, 89°, each axis ray crosses **eight interfaces: four entries and four exits**. Three 0.01° shells at t = 25°, 45°, 65° retain **24 interfaces: twelve entries and twelve exits**. Oblique three-shell paths are tested before and after the projection-pole crossings. Separate paths test each boundary at the pole for t = 5°, 45°, 85°.

The six extra entries in the aggregate are paths into unbounded shell regions: there is no finite exit before infinity. They are not missed exit walls. For paths ending before the 24-interaction budget, the harness checks that the reference has no further forward intersection. The internal-reflection path stays in glass for all 24 interactions, without counting those reflections as entries or exits.

## What is checked at refraction

The harness instruments the actual production `trace()` immediately after its `refract()` calculation. It returns the hit position and distance, effective media before and after the boundary, both refractive indices, transmitted direction, TIR flag and normal. Each query reruns the production path up to the selected interaction, preserving the preceding intersections, origin offsets, medium transitions and reflection decisions.

The CPU compares each hit with the nearest reference intersection from the preceding GPU ray state. Spatial membership probes independently check the medium choice. Analytic gradients check the normal. The returned direction must satisfy the vector form of Snell's law and `n₁ sin θ₁ = n₂ sin θ₂`; TIR must agree with the sign of the refraction discriminant. Maximum measured Snell residual is **1.0406×10⁻⁷**; maximum normal-vector error is **1.0707×10⁻⁷**.

Maximum relative hit-distance errors, using `max(1, distance)` as the denominator, are 2.5957×10⁻⁵ for focused thin-shell cases, 6.4580×10⁻⁷ for solids, 6.4904×10⁻⁷ for shells and 1.2629×10⁻⁶ for three-torus cases.

## Precision limits

Two grazing cases in the shell suite produce reference root pairs separated by approximately 5.4–5.8×10⁻⁷ at ray distance 5.009. The GPU resolves each pair as one contact. The harness explicitly consolidates same-boundary roots within eight float32 epsilon units of the ray scale, and records both exceptions under `unresolvedTangencies`. Different shell boundaries are never consolidated. The double-tangent case also allows a single nearby contact rather than requiring a particular numerical multiplicity.

The general intersection comparison accepts relative error below 0.003, with boundary identity and ordered counts also checked; actual measured errors are much smaller, as listed above. Reference comparisons omit distances at or beyond 10⁷; the production shader has no corresponding finite bounding sphere. The mathematical reference shares the Bernstein solver structure, so this is regression evidence rather than a proof of root completeness. Float32, grazing rays, extremely distant walls, origin offsets and the finite transport budget remain limits.


## Independent pole study and browser execution

The [research study](../research/README.md) supplements these regressions with exact-rational roots and a conventional float32 Ferrari baseline. It applies no far-distance cutoff or same-boundary consolidation. The production near/reciprocal solver passes all **867 rays**, matching **1,470 intersections** at relative tolerance 1e−4. The corpus comprises 600 pole rays, 19 grazing rays, 176 precision cases and 72 six-plane rotation rays. The maximum relative-distance error is 7.56e−5; within the pole sweep it is 1.75e−7. The farthest tested hit is approximately 2.4 billion scene units. Input rounding alone changes 210 of the pole-sweep root sets.

Executing the production GLSL ES source in embedded Chromium 157, WebGL 2 / ANGLE Metal on Apple M3 Pro, also passes all 867 independent cases and matches all 1,470 roots. [The browser report](../research/results/webgl-validation.json) records source hashes and errors. This checks a second compiler path on the same hardware, not another GPU vendor.

Browser timing data are in `research/results/webgl-benchmark.json`, with thirty samples per configuration and synchronous one-pixel readback. The production app and its controls were also checked interactively in this browser. Future GitHub Actions browser tests use SwiftShader software WebGL and do not replace these hardware measurements.
