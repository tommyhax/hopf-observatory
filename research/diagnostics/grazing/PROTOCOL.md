# Grazing-failure diagnostic protocol

Specified on 22 November 2026 before the diagnostic GPU run. This is a post-hoc explanation of the existing stress results, not a new independent validation set or solver-development benchmark.

The input is all 600 `tangent` queries from the frozen seed-20261121 stress corpus, including the 491 queries that pass at the principal tolerance. The original reference, GPU outputs, analyses and measured source files are protected by `frozen-manifest.json`. No original result or production source is overwritten. New outputs reside in this directory's `results/`.

Capture, for every query and each of the three modern methods:

1. Closest-point center, translation `k`, scale `L`, and the rounded matrix `A = P - c I`.
2. Homogeneous chart vectors and both polynomial coefficient bases.
3. Isolated candidates, refined candidates before filtering, and residual/endpoint acceptance decisions.
4. The unchanged all-roots output, checked against the frozen run, plus the aggregate of the diagnostic chart probes checked against that output. Instrumentation differences must be reported, not silently substituted for frozen results.

Independently isolate, in exact rational arithmetic with brackets of width at most `1e-30`, the polynomials defined by: the reconstructed centered ray; the captured chart vectors with exact `P - c I`; the captured vectors with rounded `A`; and the captured coefficients. Compare each set of distinct positive ray distances with the existing exact represented-geometry reference, using its maximum-cardinality matching and tolerance `1e-4`. Retain brackets and per-case results. These are stage substitutions, not certified diagnoses of a single mutually exclusive cause; errors can cancel or be repaired downstream.

Run one diagnostic-only ablation of Bernstein's internal proximity consolidation, keeping exact-duplicate removal and all other rules. Do not change the production shader or adopt the ablation as a fix. Report both raw and refined output. No timing claim will be made for instrumentation or CPU exact solving.

For visual examples, use the first existing representative of each final failure category (count shortfall, count excess, equal-count position error), as recorded in `stress-analysis.json`. Do not select only visually favorable cases. Plot the stage root positions and describe which distinctions the evidence supports. Record software/hardware and source hashes. Recheck the frozen manifest after execution and analysis.
