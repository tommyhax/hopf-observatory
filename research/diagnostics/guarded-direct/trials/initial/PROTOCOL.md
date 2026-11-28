# Guarded direct GPU quartics

28 November 2026. Scope: hopf-observatory only. Keep production and previous
experiments intact. Evaluate Ferrari/Cardano and algebraic special cases on
hardware browser WebGL2. No polynomial-root iteration, polishing, residual
rejection, or iterative fallback is permitted in the candidate.

Build coefficients from the original uploaded binary32 geometry. Use stable
quadratic extraction, finite/degree/zero guards, centered and reciprocal
coordinates, and higher precision for uncertain decisions. Software elementary
functions may use fixed arithmetic expansions to evaluate sqrt/cbrt/trigonometry;
these are not iteration on the input polynomial's roots.

Validate every distinct positive root on the unchanged 867 original and 2,400
stress rays with the existing independent exact-rational references. Preserve
original-ray enumeration, no finite distance cutoff, no distance merging, and
the existing 1e-4 matching criterion; also report 1e-6. Run the unchanged optical
suite and known polynomial fixtures. Save failures and source snapshots before
revising algorithms. Passing reused development cases is not a completeness
proof; all precision guards must be described as heuristic unless certified.

After correctness checks, compare the same four 1280x720 scenes, 24 interactions,
three alternating-order blocks, five warmups and ten completed frames per block
and variant. Record elapsed GPU queries and draw-plus-one-pixel synchronous
completion times. Exclude compilation, warmups, polling, image IO, UI and vsync.
Reject GL errors and disjoint queries. Capture full images separately in material,
normal and depth modes, investigate material differences, and record hashes of
the exact shader used for roots, optics and rendering. Only one GPU task at a
time. Failure of this candidate does not establish impossibility of the approach.
