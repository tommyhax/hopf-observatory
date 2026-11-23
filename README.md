# Hopf Observatory

![Three translucent Hopf tori before and after a shared four-dimensional rotation, rendered directly by the application.](technical-note/figures/three-tori.png)

**[Open the live observatory](https://tommyhax.github.io/hopf-observatory/)** · **[Read the manuscript (PDF)](paper/manuscript.pdf)** · **[Read the technical note (PDF)](technical-note/technical-note.pdf)**

An interactive WebGL 2 ray tracer for stereographic projections of rotated Clifford/Hopf tori. Each surface is an implicit quartic with analytic normals and successive reflection/refraction intersections. A screen-filling triangle invokes the shader; the surface uses no mesh, point cloud or spatial ray marching.

For independent review, start with [REVIEW.md](REVIEW.md) and the [JCGT review manuscript](paper/manuscript.pdf). The detailed technical note is the **21 November 2026 baseline exposition**; its geometry and production-renderer description remain applicable. Subsequent solver conclusions are in the [completed Algorithm 1010 investigation](research/diagnostics/algorithm1010/README.md).

## Run

```sh
npm start
```

Open [the app](http://localhost:8765/) or [the illustrated technical note](http://localhost:8765/technical-note.html). The application source is in `web/` and has no runtime JavaScript dependencies or compilation step. HTTP is required for JavaScript modules. Google Fonts is optional; system-font fallbacks are supplied.

The [technical note](TECHNICAL_NOTE.md) derives the geometry, circular lift of a ray into S³, quartic intersections, normals and Euclidean optics, with experiments and prior work. Its [PDF](technical-note/technical-note.pdf) and [editable LaTeX](technical-note/main.tex) accompany the [build instructions](technical-note/README.md).

## Controls

- Drag to orbit; scroll or pinch to zoom. Keyboard arrows orbit, +/− zoom, and Space toggles animation.
- Checkboxes enable up to three tori. Select a torus to edit its parameter, volume, shell width and material. Initially only the 45° torus is visible, with lilac glass and a 0.01° shell; the other tori have seafoam and soft amber tints.
- **Solid** fills the positive-field side of one boundary. **Shell** fills the angular band between two neighboring tori. Width ranges from 0.01° to 30°, constrained by parameter endpoints. **Apply shell width to all three** copies a common feasible width, including hidden tori.
- **Material** offers tinted glass, clear crystal, chrome and ceramic. **Apply material to all three** copies optical settings while preserving geometry. Materials follow the torus through the projection pole.
- **Rotation** groups all six SO(4) plane angles and automatic rotation. Starting aligned, XW = 90°−t puts a boundary through the pole.
- **Environment** provides six procedural backgrounds and local equirectangular panorama loading, rotation and exposure.
- **Rendering** selects quality, normal/depth inspection and image export. High quality permits 24 main-path interfaces, Adaptive 16 and Fast 8.

[Materials and environments](docs/THREE_TORI.md) explains overlap priority, thin-shell offsets and optical limits.

## Numerical method

For `P = R diag(1,1,0,0) Rᵀ`, `A = P − cos²(t) I` and `V = (2p, |p|²−1)`, the surface is `VᵀAV = 0`. Substituting a ray gives a polynomial of degree at most four.

The ray line is recentered at its closest point to the origin. Each half-line uses a near coordinate `x = λ/L` and a reciprocal coordinate `x = L/λ`, each on [0,1], with `L = max(1, |C|)`. Bernstein derivative roots partition each chart into monotone intervals. Bisection and bracket interpolation find crossings; stationary candidates retain tangencies. Step-limited Newton corrections are accepted only when they reduce the computed homogeneous residual, followed by a distance-scaled residual test. The reciprocal endpoint at zero represents infinity and is excluded. There is no finite far clipping sphere.

The [completed Algorithm 1010 evaluation](research/diagnostics/algorithm1010/README.md) retains Bernstein as the production default. Corrected centered factorization passes the tested accuracy and optical checks and improves native timings, but is slower for the browser's thin-shell workloads. The controlled comparison shows that traversal expansion is not the principal cause of the shell slowdown. It remains an attributed, reproducible research variant.

Solid material is `QᵀPQ > cos²t`; shell material is `cos²(t+Δt/2) < QᵀPQ < cos²(t−Δt/2)`. Every tracing step chooses the nearest boundary across enabled tori. Reflection, Snell refraction, total internal reflection and lighting occur in projected Euclidean 3D.

## Validation

```sh
npm ci
npm run format:check
npm test
npm run build:site
npm run test:gpu   # macOS, Xcode command-line tools and graphics-driver access
```

All 24 CPU tests pass. Native Apple M3 Pro checks pass 625 solid, 403 shell, 133 three-torus and 31 focused thin-shell ray cases. Instrumented production transport passes 36 refraction paths with 392 events. At 0.01° width, single-shell axis paths retain eight interfaces and the three-shell path retains 24, with twelve entries and twelve exits. See [GPU validation](docs/GPU_VALIDATION.md) and [raw results](docs/gpu-results.json).

The [independent study](research/README.md) compares all positive roots of each original ray against exact-rational isolation. On Apple M3 Pro, the Bernstein solver and a Yuksel–Peters baseline in both centered and near/reciprocal coordinates each match all 1,470 intersections across 867 rays at tolerance 1e−4, before and after shared surface refinement. The Ferrari baseline fails on 378 rays after refinement. This corpus shows no completeness advantage over the modern centered baseline. A separate production ray-continuation regression also passes all 867 cases in WebGL 2 / ANGLE Metal. Input rounding, grazing contacts and finite transport offsets remain limits.

Refinement ablation and full-render timing experiments are also reproducible. The residual-decreasing guard reduces the rotation-subset maximum versus unguarded Newton, but does not improve every root. Both Yuksel renderer variants pass the transport checks; they are faster for the single solid in the native timing run but slower for three thin shells. The app retains Bernstein. Recorded samples and qualifications are in the research instructions and technical note.

The final [seeded stress validation](research/STRESS.md) adds 2,400 boundary queries. All modern variants pass all 1,800 random, pole and shell queries, but fail the same **109 of 600 deliberately grazing queries** at 1e−4. Input rounding separately changes 570 intended root sets. Twelve additional exact-reference transport paths pass per solver, with explicit budget/energy termination. These results qualify any broad robustness claim; representative failures and image differences are retained.

A separate [grazing diagnostic](research/diagnostics/grazing/README.md) preserves those results and traces all 600 grazing queries through construction, isolation, refinement and acceptance. Exact solving of the captured GPU coefficients fails on the same 109 IDs; disabling proximity merging changes no outputs, and residual filtering rejects no grazing candidates. The study identifies polynomial construction as a necessary target for improvement on this corpus, while retaining intermediate cancellations and instrumentation limits.

## GitHub Pages and automation

`npm run build:site` assembles `_site/` with the app, illustrated HTML note, figures, detailed PDF and canonical `paper.pdf`. All site links work below a repository subpath such as `/hopf-observatory/`.

The **Tests** workflow runs on pushes and pull requests. It checks formatting, CPU tests, independent-reference reproducibility, the offline evidence gate, site assembly and Chromium browser tests. Browser CI uses SwiftShader software WebGL with a quarter device-pixel ratio to limit CPU rendering cost while keeping the desktop layout. The render check reads an actual shader pixel; numerical checks still cover all 867 rays. The suite has a three-minute limit. Recorded Apple GPU measurements are a separate hardware result. To run the browser suite locally, install Chromium with `npx playwright install chromium`, build the site, then run `npm run test:browser`.

**Deploy GitHub Pages** is manually triggered and restricted to the default branch. It runs the checks before building and deploying. The repository's Pages source must be set to **GitHub Actions** for deployment. No deployment occurs merely by running local build or test commands.

## Maintenance and licence

[Research instructions](research/README.md) cover pinned scientific dependencies, numerical experiments, timing, figure generation and formatting. Regenerate HTML with `./scripts/build-note.sh` and the technical-note LaTeX with `python3 scripts/build-latex.py`. Rebuild the canonical JCGT manuscript with `python3 scripts/build-paper.py --pdf` ([instructions](paper/README.md)). Prepare the versioned supplementary archive from committed source with `python3 scripts/package-release.py --version v0.1.0-review.3 --source HEAD`; see [release and provenance instructions](docs/RELEASE.md).

The implementation is MIT licensed, copyright 2026 Tom Crosby. The numerical baselines retain their [upstream notices](research/THIRD_PARTY.md); the experimental Algorithm 1010 port retains its [BSD licence](research/diagnostics/algorithm1010/LICENSE).

## Limits

Float32 arithmetic and heuristic stationary-root tolerances can merge contacts or lose accuracy. Geometry rounded onto the pole cannot retain the intended remote root. Origin offsets can skip features below their scale. The shell is an angular band in S³, not a constant Euclidean thickness.

Transport uses a bounded main path and a limited reflected branch. Rough reflections, conductor Fresnel colors and absorption in unbounded material are approximations. Remaining energy resolves to the environment at the interaction limit. There are no caustics, spectral dispersion or full global illumination.
