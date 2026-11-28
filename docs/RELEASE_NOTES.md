# Third external review snapshot — precision findings and all papers

Since `v0.1.0-review.3`, the JCGT manuscript and the technical note have been
rewritten around where the float32 grazing failures arise and how to remove
them. Exact solving of the captured GPU coefficients reproduces all 109 native
failures, so the error arises in coefficient construction, not in solving.
Building the coefficients in binary64 on the CPU recovers all 584 grazing
intersections. Float-float construction in WebGL removes all 123 browser
failures, at 4.35–7.54 times the GPU time. A closed-form Ferrari solver on that
construction passes every query and the optical suite, at 2.99–5.74 times the
GPU time, and in binary64 on the CPU the closed form is 12 times faster than
bisection.

Production behavior is unchanged: float32 Bernstein remains the default, and
the higher-precision and closed-form renderers are previews. Original evidence,
rejected timing pilots, failing controls, historical manifests and earlier
document editions are preserved.

The snapshot now delivers all three papers: the JCGT review manuscript
(`manuscript.pdf`), the technical note (`technical-note.pdf`) and the first
draft of the *Journal of Mathematics and the Arts* paper (`jma-draft.pdf`),
whose figures are not yet made. Prior geometry is attributed explicitly in all
three: the rotated Clifford-torus images to Banchoff and to McCuan and Spietz,
and the cyclide equation to Pottmann, Shi and Skopenkov.

This third external-review snapshot (`v0.1.0-review.4`) packages a committed
source revision with per-file provenance, the three PDFs and self-contained
offline verification. Earlier review tags remain unchanged. Hardware results
are measured evidence from one stack, not universal completeness or solver
superiority claims. Neither paper is **submitted or accepted**; author
endorsement and any submission decision remain separate.
