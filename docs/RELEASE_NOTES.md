# Second external review snapshot — solver evaluation complete

Corrected Algorithm 1010 has completed native, browser-adoption and controlled
solver × traversal evaluation. Native improvements do not carry over to the
recorded Chrome 157 / ANGLE Metal shell workloads. With the original traversal
loop held constant, GPU time increases by 37.2% for three aligned thin shells
and 55.1% near the projection pole. Traversal expansion contributes but does
not explain most of the slowdown on this stack.

Bernstein remains the production default. Production behavior is unchanged;
corrected Algorithm 1010 remains an attributed BSD-licensed experiment.
The current research overview, compact manuscript discussion and review guide
now present the completed investigation. Original evidence, rejected timing
pilots, failing controls, historical manifests and baseline technical-note
editions are preserved.

This second external-review snapshot (`v0.1.0-review.3`) packages a committed
source revision with per-file provenance, both PDFs and self-contained offline
verification. The first two review tags remain unchanged. Hardware results
are measured evidence from one stack, not universal completeness or solver
superiority claims. The manuscript is a JCGT review draft, **not submitted or
accepted**; author endorsement and any submission decision remain separate.
