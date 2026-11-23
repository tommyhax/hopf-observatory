# Third-party numerical baselines

`ferrari.glsl` adapts Jochen Schwarze's **Cubic and Quartic Roots**, *Graphics Gems* (1990), pp. 404–407, from [Roots3And4.c](https://github.com/erich666/GraphicsGems/blob/master/gems/Roots3And4.c). The port uses GLSL float32, clamps the cubic `acos` argument, and handles exactly zero leading coefficients. The comparison adapter supplies common centering, scaling, homogeneous-form chart polish and acceptance checks. It uses `EQN_EPS=1e-6` for float32 and is checked on known quadratic, cubic and quartic roots before each experiment. This is one conventional baseline, not the best available quartic solver.

The original Graphics Gems code is covered by its own permission notice, not this project's MIT licence. [Upstream licence](https://github.com/erich666/GraphicsGems/blob/master/LICENSE.md), accessed 21 November 2026:

> EULA: The Graphics Gems code is copyright-protected. In other words, you cannot claim the text of the code as your own and resell it. Using the code is permitted in any program, product, or library, non-commercial or commercial. Giving credit is not required, though is a nice gesture. The code comes as-is, and if there are any flaws or problems with any Gems code, nobody involved with Gems - authors, editors, publishers, or webmasters - are to be held responsible.

## Yuksel–Peters Newton-bisection baseline

`yuksel.glsl` adapts Christoph Peters's [Finding Real Polynomial Roots on GPUs](https://momentsingraphics.de/GPUPolynomialRoots.html), published 31 October 2023. Peters implements the derivative-root partitioning and bracketed Newton-bisection method of Cem Yuksel, [High-Performance Polynomial Root Finding for Graphics](https://www.cemyuksel.com/research/polynomials/), HPG 2022, DOI [10.1145/3543865](https://doi.org/10.1145/3543865).

Peters dedicates the displayed GLSL code under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). The upstream code listing was retrieved on 21 November 2026; its decoded text, beginning with `// The degree of the polynomials`, has SHA-256 `216b4382d4b84baf1e1762ba42c0ae6c5b9dd12261bafa98a9b151be4a83be64`. Attribution is retained here and in the port. This is a comparison against an adapted bounded GPU implementation, not Yuksel's complete optimized C++ library.

The port specializes degrees two, three and four at shader assembly time (`comparison-shader.mjs`), removes extension-specific loop annotations, and handles exactly zero leading coefficients, linear/constant polynomials and a quadratic double zero. It normalizes the quadratic derivative for the cancellation-resistant quadratic formula, compares signs without multiplying them, handles exact endpoint zeros, and stops on floating-point stagnation or the upstream 90-iteration limit. It uses no interval-width-scaled absolute tolerance: reciprocal roots may be arbitrarily close to zero. These choices are identical in both coordinate variants. The centered power-basis variant uses an inflated Cauchy bound computed from its GPU coefficients; the near/reciprocal variant solves four intervals covering the line. Neither uses reference roots to choose bounds.

The adapter records raw roots and roots after the same production surface refinement and residual filter. Shader and input hashes, polynomial sanity checks, and original-ray collector checks are saved in `results/pole-gpu.json`.

## Corrected Algorithm 1010 research port

The float32 factorization implementation under
[`diagnostics/algorithm1010/`](diagnostics/algorithm1010/README.md) is adapted
from Orellana and De Michele's BSD-licensed OpenMC implementation and includes
the 2024 revised correction. Its original copyright and licence are retained
in [`LICENSE`](diagnostics/algorithm1010/LICENSE); primary references,
fingerprints and shader-specific adaptations are documented in
[`SOURCES.md`](diagnostics/algorithm1010/SOURCES.md). It remains experimental,
with the [adoption decision](diagnostics/algorithm1010/final/README.md) recorded
separately. The licence attribution above covers the older comparison ports.
