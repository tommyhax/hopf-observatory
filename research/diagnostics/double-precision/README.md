# Double precision removes the frozen grazing failures

CPU experiment, 28 November 2026, in **hopf-observatory**. Rebuilding and
solving the ray polynomials in binary64 recovers **all 584 reference
intersections across all 600 grazing queries**, with no missing or extra
outputs. All **109 previously failing native queries recover**, and none of
the other 491 regresses at the original `1e-4` tolerance. Production rendering
and the prior numerical evidence are unchanged.

Using binary64 only to solve the already constructed binary32 coefficients
still fails on exactly the original 109 queries. Higher-precision construction
is necessary for the improvement observed here.

## Controlled result

The target is the exact geometry represented by the uploaded binary32
`P`, `c`, `o`, and `d`. Those values remain identical in every comparison.
The experiment does not reconstruct the ideal pre-upload geometry. All 600
exact original-ray references were independently recomputed; their root
counts, multiplicities, and rational brackets agree with the stored reference.

At `abs(actual-reference)/max(1,abs(reference)) <= 1e-4`:

| Construction and solving | Failed queries / 600 | Matched roots / 584 | Missing roots | Unmatched outputs |
| --- | ---: | ---: | ---: | ---: |
| Frozen native float32 GPU, refined | 109 | 436 | 148 | 137 |
| Captured float32 coefficients, exact solving | 109 | 434 | 150 | 138 |
| Captured float32 coefficients, double solving | 109 | 434 | 150 | 138 |
| Double construction, exact solving | 0 | 584 | 0 | 0 |
| Double construction, double solving | **0** | **584** | **0** | **0** |

The largest relative-distance error for the complete double calculation is
**4.8731e-12**. It also passes every query at `1e-6`, `1e-8`, and `1e-10`.
At `1e-12`, **15 queries fail on position**, with the correct root counts;
the exact roots of the double-constructed coefficients fail on the same 15
IDs. Double precision reduces construction error substantially but does not
eliminate it.

| Matching tolerance | Frozen float32 GPU, refined | Float32 coefficients, double solving | Double construction and solving |
| --- | ---: | ---: | ---: |
| 1e-4 | 109 | 109 | 0 |
| 1e-6 | 277 | 277 | 0 |
| 1e-8 | 325 | 324 | 0 |
| 1e-10 | 326 | 326 | 0 |
| 1e-12 | 326 | 326 | 15 |

Each column counts failed queries out of 600. These are deliberately grazing
queries, not the full 2,400-query stress corpus or an estimated viewing failure
rate. The GPU column is the previously captured **native** result, not a fresh
GPU run or the browser result.

## Why this distinguishes construction from solving

The two numerical CPU variants use the same unmodified `rootsBernstein`
function from `web/math.js`. One receives the recorded binary32 coefficients
and coordinate transform; the other receives coefficients and coordinates
built in binary64 from the original uploaded geometry. Neither applies
homogeneous polishing or a residual acceptance filter.

Independent SymPy rational isolation evaluates both sets of coefficient
polynomials. The double numerical solver matches the exact coefficient roots
on every query at all reported tolerances. For binary32 coefficients its
largest relative discrepancy is `1.764e-16`. For binary64 coefficients all
converted ray distances equal the exact-reference midpoints after binary64
rounding; this is not a claim of exact equality before rounding.

Thus the solve-only control accurately solves a polynomial whose intersections
already differ from the represented surface. Rebuilding that polynomial in
double precision avoids the large discrepancies on this corpus.

The slightly different GPU and exact-control root totals are retained. In
particular, the native shader's stationary-value heuristic can return a
candidate where the captured polynomial has no real root; its subsequent
refinement also changes some candidates. Equal failed-query counts do not
mean identical output roots.

## Previously selected examples

| Query | Exact uploaded-geometry intersections | Frozen float32 GPU | Double construction and solving |
| --- | --- | --- | --- |
| 1201: displaced pair | 5.995521984544, 6.004477744272 | 5.994742870331, 6.005257129670 | 5.995521984547, 6.004477744270 |
| 1257: missing pair | 7.998871098772, 8.001128393148 | None | 7.998871098770, 8.001128393150 |
| 1260: extra pair | None | 5.999402523041, 6.000598430634 | None |
| 1311: merged-looking contact | 3.999657729847, 4.000342114928 | 4.0 | 3.999657729850, 4.000342114925 |

These IDs were fixed in the protocol from the previous diagnostic. The last
case was previously traced to a stationary candidate after coefficient
construction removed the real roots; it is not evidence that proximity
merging caused the loss.

## Implementation and scope

`run.mjs` reuses the existing JavaScript binary64 chart constructor and solver,
with a diagnostic all-roots collector. It does not use `intersect`'s rendering
cutoff or distance-proximity merging. It keeps all distinct positive finite
distances, retains nonfinite candidates as failures, excludes the reciprocal
endpoint at infinity, and owns near-chart zero on one half-line only. The
CPU solver's existing internal chart-coordinate duplicate policy, stationary
tolerance `1e-12`, and 55 bisections are unchanged.

`analyze.py` expands the captured binary64 coefficients as exact rationals and
isolates them with coordinate brackets no wider than `1e-40`. The shared
maximum-cardinality matcher accounts for every distinct reference root and
every returned candidate; there is no truncation to four hits or tolerance
that merges close reference roots. Per-query records and tighter-tolerance
failures are retained in [results/analysis.json](results/analysis.json); the
coefficients and numerical candidates are in [results/cpu.json](results/cpu.json).

This establishes a useful CPU precision result, not a GPU implementation or a
performance improvement. Scalar operation ordering and solver thresholds
differ from the GPU, so it is not an instruction-identical precision swap.
It tests Bernstein solving, not a new double-precision Ferrari or Algorithm
1010 implementation. It does not establish universal tangency resolution,
full-render optical accuracy, or behavior on a new corpus.

The original intended-to-uploaded geometry comparison still differs on
**304/600 queries** at `1e-4`. That earlier quantization is held fixed here and
is separate from the construction errors removed by this experiment. A useful
next implementation experiment would preserve extra precision through chart
and coefficient construction in the browser, then measure correctness and
rendering cost; this work does not implement that change.

## Reproduction and verification

From the hopf-observatory repository root, using its existing dependencies:

```sh
node --test research/diagnostics/double-precision/test-replay.mjs
.venv/bin/python research/diagnostics/double-precision/test_analysis.py
node research/diagnostics/double-precision/run.mjs
.venv/bin/python research/diagnostics/double-precision/analyze.py
.venv/bin/python research/diagnostics/double-precision/analyze.py --verify-only
```

The eight analytic tests cover known torus intersections, non-unit ray
directions, reciprocal mapping, infinity and origin exclusion, close-hit
preservation, nonfinite accounting, exact basis conversion, binary64 value
reconstruction, and reference-bracket/multiplicity checking. The full replay
independently checks every original reference and both coefficient controls.

Capture and analysis protect 74 source/input paths and additionally hash the
CPU capture before analysis. All are checked again at completion. The
inherited grazing manifest already differs at generated documentation
`web/technical-note.html`; its historical and current hashes are explicitly
recorded, and its current contents are also protected. No numerical-source
exception is allowed. Existing unrelated working-tree edits are untouched.
The [protocol](PROTOCOL.md) records the comparisons before the first replay;
no numerical parameters were tuned after observing the outcome.
