# Complete-frame native renderer comparison

Specified 28 November 2026 before capturing frames. Use hopf-observatory only.
Build a portable C++17 CPU ray tracer using the tested direct binary64 quartic
solver, without iterative polishing. Use the production shader as the source
of optical behavior via a checked GLSL-to-C++ syntax translation. Camera,
normals, materials, ray offsets, 24 primary interactions, four secondary
reflection interactions, lighting, tone mapping and vignette are retained.

Round scene uniforms to binary32 before giving the identical values to both
backends. C++ evaluates rays, optics and intersections in binary64. Its images
need not be bit-identical to the existing binary32 GPU renderer. Compare
material, normal and depth images, quantify every pixel difference, retain
outliers, run the existing optical suite against the native implementation,
and check the reused exact-reference root corpora. Diagnose material mismatches
before making a replacement recommendation.

Use the four existing benchmark scenes, unchanged: solid, single 0.01-degree
shell, three thin shells, and three thin shells near the pole. Final timing
is 1280x720 at 24 interactions. Use three blocks per backend, one warmup and
three measured completed frames per block, alternating backend order. Run
native worker threads and GPU work sequentially. Native threads use the
reported hardware concurrency; include a one-thread completed-frame control.

Measure complete CPU frames from dispatch to all RGBA8 pixels written, including
camera rays, full optical paths and colour conversion. Separately measure
upload/presentation to a GPU texture when available. GPU timing uses the
unchanged production shader and fresh hardware WebGL2: elapsed GPU queries
plus a per-frame completion readback. Report GPU elapsed and completion wall
times separately. No vsync, UI, compilation, file encoding or IPC is included
in rendering time. Distinguish offscreen frame readiness from displayed FPS.

Retain inputs, source hashes, raw timings, raw images and image comparisons.
Preserve prior precision/algebraic evidence and unrelated user edits. The
native prototype is separate from the production web application's default.

## Changes exposed by full-frame validation

The first binary64 frames and implementation are retained in trials/binary64.
Far-ray resolvent failures were misses confirmed by 128 exact rational
polynomials. A sufficient algebraic positivity test now handles that case.
Two material pixels at 1280x720 exposed three wrong boundary queries that
were absent from the frozen ray corpus. Their original incoming rays and
independent exact roots are retained in results/exact-pixel-queries.json.

The final renderer uses direct formulas with adaptive precision. Internal
discriminant sign ambiguity (128*epsilon times expression magnitude) or
Cardano cancellation (64*sqrt(epsilon) times the summed term magnitudes)
requests a fresh construction and direct solve at 113 bits, then 256 if
still flagged. These guards are conservative diagnostics, not certified
error bounds or a general completeness proof. No iterative root solver,
polishing, residual rejection or geometric tolerance is added. Count all
precision escalations, include their cost in timing, and rerun the full
root/transport/image checks before the final benchmark. Strict binary64
and forced higher-precision modes remain available for diagnosis.
