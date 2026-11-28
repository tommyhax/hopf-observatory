# CPU double-precision grazing replay

Specified on 28 November 2026 before running this diagnostic. Work is confined
to hopf-observatory. This is a post-hoc precision experiment on the existing
seed-20261121 corpus, not a new independent validation corpus or a production
renderer change.

## Fixed inputs and comparisons

Use all 600 `tangent` boundary queries in `research/results/stress-reference.json`,
including the 491 native Bernstein passes. Preserve the uploaded binary32
`P`, `c`, `o`, and `d` exactly; do not regenerate projectors, normalize directions,
or substitute the ideal geometry. The target is the stored independent
exact-rational reference of those uploaded inputs.

Record these comparisons:

1. Frozen native GPU Bernstein outputs, raw and refined.
2. Binary64 numerical solving of the captured binary32 Bernstein coefficients,
   retaining the captured binary32 coordinate transform. This upgrades only
   downstream solving and distance conversion.
3. Binary64 construction and numerical solving from the original uploaded
   inputs, using `rayChart` and `rootsBernstein` from `web/math.js`.
4. Independent exact-rational isolation of the binary64-constructed
   coefficients, to separate construction error from numerical solving.
   Reuse the already recorded exact roots of the binary32 coefficients as
   the corresponding control.

The numerical solver uses the existing CPU default stationary tolerance
`1e-12`, 55 bisections, and its existing chart-coordinate duplicate policy.
The diagnostic all-roots wrapper omits the rendering distance bias and
distance-proximity merging in `intersect`; it keeps every distinct positive
finite distance, excludes reciprocal zero (infinity), and gives near-chart
zero to the positive half-line. Only exactly identical distances are collapsed.
No homogeneous polishing or residual filter is applied to either CPU variant.
Capture coefficients, coordinate roots and converted distances for every chart.

Use the existing maximum-cardinality, minimum-error one-to-one matcher at
`abs(actual-reference)/max(1,abs(reference)) <= 1e-4`. Also report `1e-6`,
`1e-8`, `1e-10`, and `1e-12`, root counts, nonfinite outputs, maximum matched
errors, and failed IDs. Report recovery on the original 109 failed queries
and regressions on the other 491. Preserve failures; do not tune parameters
after seeing results. Retain the previous representative IDs 1201, 1257, 1260
and the stationary-candidate example 1311.

Independently recompute the uploaded-geometry exact references and check their
agreement with the stored references. Exact coefficient isolation uses rational
coordinate brackets no wider than `1e-40`, retaining multiplicities and mapped
distance brackets. Numerical candidates are also compared to their own
coefficient roots. Distinct roots remain separately accountable.

## Preservation and limits

Hash the prior grazing manifest, its protected files, the prior capture and
analysis, the reference inputs, and this diagnostic's executable sources.
Check hashes again after capture and analysis. The inherited manifest already
differs at the generated documentation file `web/technical-note.html`; record
that pre-existing difference explicitly and protect its current hash as well.
Any other inherited mismatch is an error. Existing unrelated working-tree
edits are left alone. All new results belong in this directory.

CPU JavaScript scalar operation ordering and tolerances differ from native
GPU arithmetic. This tests a practical binary64 implementation, not an
instruction-identical precision substitution. No GPU emulation, new rendering
backend, image-quality result, or real-time performance claim is implied.
Input quantization is held fixed; success cannot recover the ideal geometry
that was changed when its uniforms were first rounded to binary32.
