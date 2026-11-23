# Algorithm 1010 port provenance

The research shader is a float32 adaptation of Orellana and De Michele's
factorization algorithm. The implementation reference is OpenMC's
[quartic_solver.cpp](https://github.com/openmc-dev/openmc/blob/develop/src/external/quartic_solver.cpp).
Its authors granted OpenMC a simplified BSD license, which is retained verbatim
in [LICENSE](LICENSE). The original project license does not replace that notice.

The algorithm is described in the
[2020 paper](https://cristiano-de-michele.netlify.app/publication/orellana-2020/orellana-2020.pdf).
The wider near-degenerate comparison comes from the
[2024 correction](https://cristiano-de-michele.netlify.app/publication/de-michele-acm-2024/de-michele-acm-2024.pdf),
verified against `1010/Remark2/C/Src/quartic_solver.c` in the
[ACM source archive](https://calgo.acm.org/1010.zip). That corrected source also
retains the factor iterate with the lowest absolute coefficient residual and
allows up to 20 iterations. The author's current C++ source and Kurbo were
inspected for comparison; neither is bundled here.

Retrieved 23 November 2026; SHA-256 fingerprints:

| Source | SHA-256 |
| --- | --- |
| OpenMC `src/external/quartic_solver.cpp` | `3883c3b59c82dfdbbd884ae42735dbc65b5e73710b04a6d9dc9a91b059222193` |
| OpenMC `src/external/LICENSE` | `796e5ea92719c3191ef8b50158635b3b88eadeab09801b55ec7372be47c123c1` |
| ACM `1010.zip` | `8c843d7a117f9ffb0f6dda96a9cea4488bf024c8338d6575e59a74d503e95c0a` |
| ACM `Remark2/C/Src/quartic_solver.c` | `c83b869aa951e6dd287c8794c33ff4cbafd0896e92ccf4e00e2226a9d61bf9db` |

## Deliberate shader adaptations

- All arithmetic uses GLSL `highp float`, with epsilon `2^-23` and correction
  threshold `sqrt(2^-23)`. This preserves the precision-relative interpretation
  of the author's default rather than reusing the double-precision constant.
- Cubic radical evaluation uses the published overflow-resistant ratio form,
  a clamped trigonometric argument, and up to eight residual-decreasing Newton
  corrections. The quartic rescaling fallback uses a float32-scale constant.
  This port does not implement the additional extreme-range cubic-rescaling
  fallback of the general-purpose upstream code. Nonfinite quartic failures
  are recorded explicitly, not silently interpreted as an empty root set.
- The resolvent has a single dominant real root. Exact degree loss and an exact
  zero constant term use separate algebraic cubic/quadratic routines, with
  stable quadratic extraction, cubic deflation, and cubic polishing. They do
  not call the existing Bernstein or Yuksel solvers.
- Both real and conjugate-complex quadratic factors are handled. Complex roots
  count as real only if their computed imaginary part is exactly zero.
- If the near-degenerate real-factor candidate ties the conjugate-factor
  candidate in the rounded coefficient-error metric, the port prefers the real
  factors. Native contracted arithmetic otherwise produces a spurious positive
  `d2 = 2^-23` for `(x-1)^4`, misses the quadruple root, and gives both candidates
  zero rounded reconstruction error. Perturbations above and below that
  polynomial are separate exact-reference fixtures. This tie rule is a port
  choice, not an additional theorem or a universal tangency guarantee.
- Factor refinement uses the 2024 source's 20-iteration bound, stops when the
  relative error ceases decreasing, and returns the best absolute-residual
  iterate seen. Nonfinite proposals are rejected.
- Root collection keeps only exact duplicates. The same subsequent homogeneous
  refinement and residual filtering are used for every compared method.

The renderer adapter additionally expands the fixed three-object scene loop.
The original loop with this large backend produced inconsistent object IDs and
levels on the native Metal stack. The expanded, equivalent traversal passes
the regression suite. That observation suggests a compilation issue but does
not identify its precise cause. Initial reports and the original adapter source
are retained in `results/integration-initial.json`.
