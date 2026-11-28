# Browser precision experiment

28 November 2026. Follow the CPU double-precision result in hopf-observatory.
Keep the production shader and prior research evidence unchanged. New shader
variants, probes, timings and reports live here.

Implement paired-float arithmetic for original-ray recentering, homogeneous
vectors and polynomial construction. Test individual operations on actual
hardware WebGL before trusting this arithmetic. Preserve uploaded binary32
geometry. Candidate roots and final hit distances may remain binary32; record
any change to isolation/refinement and retain failed intermediate trials.
This is extended precision with binary32 range, not IEEE binary64.

Compare all distinct positive intersections against the existing exact-rational
uploaded-geometry references: 867 original queries and all 2,400 stress queries,
including all 600 grazing queries. Use the existing maximum-cardinality matcher
at 1e-4, with tighter tolerances as diagnostics. No near bias, advancing origin,
finite far cutoff or proximity merging in the all-roots collector. Independently
record raw and refined candidates where refinement is used. Validate complete
optical transport with the existing browser suite before timing a candidate.

Measure production and the passing candidate in the four existing 1280x720
scenes and uniforms, with 24 interactions. Use three alternating-order blocks,
five warmups and ten individually completed frames per variant/scene/block.
Every draw receives an elapsed GPU query and one-pixel completion readback.
Disjoint timings reject a block; compilation, warmup and query polling are
excluded. Preserve samples, block medians, hardware and shader/source hashes.
Run GPU work sequentially. Capture representative images outside timing.

Retain the browser default unless accuracy and rendering-cost evidence support
changing it. A slower working variant can remain available as an experiment.
No cross-device robustness, native FP64, or image-ground-truth claim follows
from this one-device test. Hash existing production and result files before
and after; record the already known generated-documentation manifest mismatch.
