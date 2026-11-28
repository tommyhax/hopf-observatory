# Direct native quartic experiment

Specified 28 November 2026. Work stays in hopf-observatory. No production
renderer or previous experiment is changed.

Test direct Ferrari factorization, with a closed-form Cardano cubic and stable
quadratic extraction. No Newton, Halley, root isolation, residual rejection,
or iterative polishing is allowed in the algebraic path. Elementary library
functions (square/cube roots and the trigonometric form of Cardano) evaluate
the formula; they are not an iterative search for the input polynomial's roots.

Run native C++ binary64 first, then the identical template at 113 and 256
significand bits if needed. Boost's software multiprecision is explicitly
distinguished from hardware doubles. Apple ARM64 long double is not assumed
to supply more precision; record numeric_limits for both native types.

Inputs are all 867 original and 2,400 stress rays, with the exact uploaded
binary32 geometry held fixed, plus the existing 54 polynomial fixtures.
References are independent exact-rational original-ray isolation. Recompute
fixture references from the actual coefficient values, rather than assuming
their intended roots survived coefficient rounding.

Construct one centered/scaled power polynomial per ray, using k=o.d,
center=o-k*d, L=max(1,length(center)), and lambda=(s+k)/L. Preserve original
directions. Ferrari solves the polynomial or its reciprocal, choosing the
larger-magnitude endpoint coefficient as its leading coefficient. This is an
algebraic coordinate choice, not a numerical fallback. Exact zeros alone
reduce degree; do not discard a small nonzero leading coefficient.

The control is native C++ derivative partitioning and bisection in the two
compact charts [-1,1], using the same constructed power coefficients. It is a
CPU comparison, not an instruction-identical port of the production Bernstein
shader. Use digits+4 bisections, stagnation stopping, and stationary tolerance
2^(-digits+14). Retain each distinct positive distance, no rendering bias,
finite far cutoff, or distance-proximity merging. The reciprocal chart owns
0<abs(x)<1; the direct chart owns abs(x)<=1. Only identical outputs collapse.

Compare roots one-to-one at relative-distance tolerances 1e-4, 1e-6, 1e-8,
1e-10, and 1e-12. A missing, extra, nonfinite, or inaccurate output fails its
query. Retain failed IDs and raw results. Report every tested precision,
including failures. This reused corpus is a development test, not an
independent universal robustness guarantee.

Time both solving already-constructed coefficients and construction plus
solving on the same CPU, with the same compiler settings, no fast-math, no
output/file parsing inside timed regions, warmup, repeated blocks, and a
consumed checksum. Report CPU kernel costs separately from GPU/full-render
times; they cannot be compared as frame rates. Hash input and source files,
record compiler/Boost/native precision metadata, and verify prior evidence.
