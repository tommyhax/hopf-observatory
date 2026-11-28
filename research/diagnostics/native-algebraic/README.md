# Direct quartic formulas work in native doubles

28 November 2026, hopf-observatory, Apple Silicon / Apple Clang 17 / Boost 1.90.

The final C++ direct solver passes **all 3,267 ray queries and all 54 polynomial
fixtures using hardware binary64**, with no root isolation, Newton/Halley
corrections, residual filtering, or iterative fallback. Its construction-plus-
solving time is **0.282 microseconds per boundary query**, versus **3.454
microseconds** for the C++ bisection control: **12.25 times faster** on this
corpus. This is a CPU kernel comparison, not a complete-render or GPU speedup.

This answers the original feasibility question affirmatively. The earlier
float32 Ferrari failures and the slow float-pair browser experiment did not
establish that direct quartic solving requires emulated doubles or must be
slower. Coefficient construction, coordinates, and cancellation-resistant
evaluation matter alongside precision.

## Accuracy

Every ray uses the unchanged uploaded binary32 P, c, o and d. The target is
the existing independent exact-rational reference for that geometry, not the
unrounded intended surface. All positive finite intersections are enumerated;
there is no near bias, far cutoff, or proximity merging. Only identical
computed outputs collapse. The contained-line case uses the existing empty
discrete-root convention.

The matching error is abs(actual-reference)/max(1,abs(reference)). A query
fails for any missing, extra, nonfinite, or out-of-tolerance root. References
for the 54 polynomial fixtures are independently recomputed by SymPy exact
rational isolation from their actual coefficient values.

| Direct binary64 | Queries | Distinct reference roots | Failed at 1e-8 | Maximum error |
| --- | ---: | ---: | ---: | ---: |
| Original | 867 | 1,470 | 0 | 3.96e-12 |
| Stress | 2,400 | 3,314 | 0 | 1.89e-10 |
| Grazing subset of stress | 600 | 584 | 0 | 1.89e-10 |
| Polynomial fixtures | 54 | 174 | 0 | 9.10e-13 |

At 1e-10 the direct binary64 solver fails 11 stress queries on position
accuracy; at 1e-12 it fails one original and 175 stress queries. There are
still no missing or extra roots at the ordinary 1e-4 or tighter 1e-8 criterion.
The 113-bit and 256-bit implementations pass every group through 1e-12.
The maximum discrepancy against the stored ray reference midpoints is about
2.27e-28 at 113 bits. The ray reference brackets are about 1e-30 wide: printing
65 digits does not make those midpoints 65-digit-accurate, and the 256-bit
comparison reaches that reference limit.

The iterative binary64 control has one false stationary candidate, stress
1744; its other returned roots have maximum error 2.29e-12. Both higher-
precision controls pass all cases. This control is derivative partitioning
and bisection of power polynomials in compact charts, not the production
Bernstein shader or the earlier JavaScript precision replay. Its stationary
tolerance is recorded in the protocol and was not changed to remove that
remaining failure. This comparison does not claim to beat every possible
iterative implementation.

## The direct algorithm

`solver.hpp` implements Ferrari factorization, Cardano's closed-form cubic
(including its trigonometric three-real-root form), and stable quadratic
extraction. The formula is evaluated in floating-point arithmetic, so its
answers are approximations; “direct” here means no iterative search or
polishing of the input polynomial's roots. Library sqrt/cbrt/trigonometric
evaluation is part of formula evaluation.

The native implementation:

1. Constructs the centered/scaled homogeneous ray polynomial at the selected
   precision. Directions and geometry remain unchanged.
2. Preserves exact zero factors, lower degrees, and the biquadratic branch.
3. Scales a cluster near zero by an exact power of two using a root bound.
4. Chooses among five bounded translations, then optionally takes reciprocal
   coordinates to avoid division by a tiny endpoint coefficient.
5. Evaluates Ferrari/Cardano without their usual polishing steps. It forms
   the quadratic factors in the final coordinates before extracting roots,
   and obtains smaller factor constants through their product identity.
6. Maps roots back to the original ray and retains all distinct positive
   distances.

These are finite algebraic transformations. No small leading coefficient is
discarded, no near roots are merged, and there is no numerical-solver fallback.
The formula code is adapted from Boost.Math's Ferrari and cubic implementations
under the accompanying Boost license; **both** cubic and quartic polishing
were removed. Boost's normal library quartic function includes polishing and
is not the function called by this experiment. See the
[Boost quartic documentation](https://www.boost.org/doc/libs/latest/libs/math/doc/html/math_toolkit/quartic_roots.html)
and [upstream source](https://github.com/boostorg/math/blob/develop/include/boost/math/tools/quartic_roots.hpp).

## CPU timings

Single thread, all 3,267 geometry queries, seven measured blocks per cell after
warmup. Parsing, compilation, output, and reference work are excluded. A
checksum consumes the roots. Both methods use the same C++ arithmetic type,
input geometry, power coefficients, compiler, and optimization settings.
There is no fast-math or implicit multiply-add contraction. Solve-only time
includes each method's own coordinate preparation; construction-plus-solving
also includes recentering and coefficient construction.

| Arithmetic | Formula solve only | Bisection solve only | Formula construction + solve | Bisection construction + solve |
| --- | ---: | ---: | ---: | ---: |
| Native binary64, 53 significand bits | 0.215 us | 3.391 us | 0.282 us | 3.454 us |
| Software, 113 significand bits | 20.641 us | 193.758 us | 40.522 us | 214.821 us |
| Software, 256 significand bits | 55.616 us | 753.101 us | 162.576 us | 863.686 us |

Native formula construction-plus-solving ranged from 0.268 to 0.285 us across
blocks; the binary64 bisection control ranged from 3.414 to 3.530 us. Methods
ran in serial blocks, not alternating paired samples. These are wall-clock
kernel measurements on one system and a reused corpus, not a general CPU
throughput guarantee. Both native double and long double report 53 significand
bits on this machine. The higher-precision types are Boost software arithmetic;
they do not demonstrate hardware FP128 support.

## Scope and reproducibility

This is a standalone native solver experiment. Production WebGL, transport,
normals, and the application default are unchanged. No CPU renderer, browser
integration, native GPU backend, optical-path validation for this solver, or
complete-frame benchmark is claimed. Passing this development corpus is not a
proof of robustness for all quartics, repeated-root degeneracies, exponent
ranges, or future rays. The final algorithm was developed using these tests.

Python orchestrates compilation, exact-reference work and analysis; the timed
solver and coefficient construction run entirely in C++. From the repository
root, using the existing virtual environment and Homebrew Boost headers:

```sh
.venv/bin/python research/diagnostics/native-algebraic/run.py --bits 53 113 256 --benchmark
.venv/bin/python research/diagnostics/native-algebraic/verify.py
```

The build uses a temporary directory and does not leave a binary in the
repository. The [protocol](PROTOCOL.md), [solver](solver.hpp),
[native harness](main.cpp), [analysis](results/analysis.json), raw TSV captures
and timing samples are retained. The verifier rechecks every capture against
the references, every reported tolerance, timing medians, and 81 protected
source/input paths, including the earlier precision experiment's 75 paths.
The inherited generated-documentation mismatch is recorded, not overwritten.

The initial unconditioned direct implementation failed 371 ray queries and one
fixture in binary64, three ray queries at 113 bits, and none at 256 bits.
Intermediate implementations exposed repeated-root, exact-origin, and
near-zero scaling issues. Their sources, captures and timings remain under
`trials/`, with compressed result files and a checksum index. None of those
failures was removed from the final test set or waived by changing tolerance.
