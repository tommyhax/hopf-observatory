# Applicability of algebraic quartic solvers

Investigation dated 23 November 2026. This directory contains a separate GPU
experiment and a literature assessment. It leaves the production renderer and
previous research sources/results unchanged. The existing grazing diagnostic's
frozen manifest is checked before and after GPU execution.

## Conclusion

Algebraic intersection is mathematically applicable: substituting a ray gives a
polynomial of degree at most four. The question is whether a particular
floating-point implementation is complete, accurate, and faster for this
renderer. The conventional Ferrari implementation currently in the repository
is unsuitable as a general replacement. Changing its coordinates or its fixed
zero threshold does not rescue it. This does **not** rule out modern algebraic
factorization methods, especially hybrids with numerical refinement.

The most relevant next candidate was Orellana–De Michele's Algorithm 1010,
using the subsequent corrections. The subsequent
[float32 GPU experiment](../algorithm1010/README.md) now implements and tests
it, including optical transport and full-render timings. The results below
remain the original conventional-Ferrari experiment.

## Controlled GPU experiment

The same conventional Graphics Gems Ferrari/Cardano port is evaluated in
centered coordinates and in all four near/reciprocal charts. Both use the
existing power-coefficient constructor. A second pair of variants replaces the
port's `abs(x) < 1e-6` decisions with exact-zero tests. This is a diagnostic
ablation, not a recommended numerical policy or a modern robust solver.

The input sets are the existing 867 original rays and 2,400 stress queries.
Reference roots are from exact-rational expansion of the uploaded float32
geometry. Every distinct positive root of the unchanged ray is compared by the
existing maximum-cardinality matcher at error
`abs(actual - reference) / max(1, abs(reference)) <= 1e-4`. A query fails if any
root is missing, spurious, nonfinite, or outside that tolerance. There is no
rendering bias or finite far cutoff. Only identical float outputs are merged.
Algebraic chart candidates outside `[0,1]` are excluded before refinement;
nonfinite candidates remain recorded failures.

All variants are reported raw and after the same production homogeneous-form
Newton refinement and residual filter. The table shows the latter. The native
run used Apple M3 Pro, OpenGL 4.1 Metal 90.5, with the existing ES-to-desktop
version-directive substitution.

| Method | Failed original rays / 867 | Failed stress queries / 2,400 |
| --- | ---: | ---: |
| Production Bernstein | 0 | 109 |
| Ferrari, centered, existing epsilon | 378 | 694 |
| Ferrari, near/reciprocal, existing epsilon | 331 | 649 |
| Ferrari, centered, exact-zero ablation | 366 | 507 |
| Ferrari, near/reciprocal, exact-zero ablation | 316 | 423 |

The baseline replays reproduce every stored raw/refined root set: Bernstein on
both corpora and Ferrari on the original corpus, with zero mismatches. This
checks that the new harness retains the existing behavior.

The 20 independent polynomial checks are retained, including all four failures.
The existing-epsilon version passes 9/10; its naive quadratic formula loses the
small root in the separated-scale case. The exact-zero variant passes only 7/10:
it additionally fails the quartic with roots `1,2,3,4` and the quartic with roots
`-1,-1,1,1`. Lower aggregate failure counts therefore hide basic regressions.
Removing the epsilon is not a usable fix.

The remaining 109 Bernstein stress failures are the previously diagnosed
grazing cases. [Exact isolation of captured coefficients](../grazing/README.md)
fails against the represented-geometry reference on those same 109 queries.
Changing the root solver alone cannot reconstruct the original polynomial from
its rounded coefficients. That limits what an algebraic solver can repair,
without making the current renderer universally robust.

These are accuracy experiments, not timing measurements. No algebraic renderer
was integrated or benchmarked, and no speedup is claimed. They test a specific
old port and two adapter choices, not the best achievable algebraic solution.

## Candidate methods and applicability

- **Orellana–De Michele, Algorithm 1010 (2020):** forms two quadratic factors
  with error-aware coefficient choices, then refines the factor coefficients
  numerically. This is the strongest next candidate identified here. The
  original timing/accuracy study uses double precision on a CPU, so it needs
  separate float32 GPU validation. Consult the
  [paper](https://cristiano-de-michele.netlify.app/publication/orellana-2020/orellana-2020.pdf),
  the [2024 revised correction](https://iris.uniroma1.it/handle/11573/1727754)
  (which supersedes an earlier correction), and the
  [author's implementation](https://github.com/cridemichel/quarticpp).
- **Practical precedent:** OpenMC uses Orellana–De Michele factorization for
  ray/torus intersections. This supports relevance to the geometric task, not
  an inference about shader performance.
  [OpenMC geometry documentation](https://docs.openmc.org/en/stable/methods/geometry.html).
- **Boost.Math Ferrari plus polishing:** a maintained implementation combines
  Ferrari with a Halley correction. Its code includes biquadratic handling and
  chooses the largest positive root of its resolvent cubic. This is a useful
  second comparator; it is not the port tested in this directory.
  [Documentation](https://www.boost.org/doc/libs/latest/libs/math/doc/html/math_toolkit/quartic_roots.html),
  [quartic source](https://github.com/boostorg/math/blob/develop/include/boost/math/tools/quartic_roots.hpp).
- **Structural biquadratic cases:** if symmetry makes the odd coefficients
  exactly zero, `a4*x^4 + a2*x^2 + a0 = 0` reduces to a quadratic in `x^2`.
  This can be an algebraic special case, but arbitrary rotations and rays do
  not generally have that structure. A merely small leading coefficient also
  cannot be discarded safely: near the projection pole it can encode a very
  distant intersection.

The new experiment does not include any of these modern implementations. Its
algebraic code remains the previously attributed port in
[THIRD_PARTY.md](../../THIRD_PARTY.md).

## What would justify a replacement

First validate a corrected factorization implementation in the actual shader
precision, with stable quadratic extraction and explicit degree-loss handling.
Keep coefficient construction, chart coordinates, original-ray enumeration,
and refinement controlled so solver and representation effects can be
distinguished. Compare both with exact roots of captured coefficients and with
the existing exact represented-geometry reference.

Require the known-root cases, distant roots, grazing contacts, chart endpoints,
and thin-shell transport to pass before drawing conclusions from complete
render timings. A candidate's small residual is not sufficient to select an
algebraic fast path: it validates returned roots without proving that no nearer
root was missed. Any fallback policy needs a separate completeness criterion.

## Reproduce

From the repository root, with the existing dependencies:

```sh
node research/diagnostics/algebraic/run.mjs
.venv/bin/python research/diagnostics/algebraic/analyze.py
```

The first command requires macOS graphics-driver access. Outputs are confined
to this directory. [GPU results](results/gpu.json) retain raw/refined roots,
sanity failures, hardware information, and source/input/shader hashes.
[Analysis](results/analysis.json) retains family summaries, failed query IDs,
replay mismatches, and analysis provenance. Both scripts reject changed inputs
or sources rather than silently analyzing stale evidence.
