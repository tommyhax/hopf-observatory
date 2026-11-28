# Bridges paper: outline

Working draft, 28 November 2026. Not yet started as prose.

## Target

- **Venue:** Bridges (Mathematics, Art, Music, Architecture, Culture). Check the current call at [bridgesmathart.org](https://bridgesmathart.org/). In recent years regular papers were 6 or 8 pages, due around 1 February, and short papers 2 or 4 pages, due around 1 March. At least one author is expected to attend in person.
- **Recommended format:** an 8-page regular paper. The material is visual and needs room for images.
- **Companion submission:** the juried Bridges exhibition of mathematical art takes still images and prints, under a separate call and deadline. Two or three of the renders below would suit it.
- **Audience:** mathematicians and artists. Keep numerical analysis to a paragraph and point to the JCGT paper for detail.
- **Voice:** first person. The story of an idea from the 1990s finally realized is part of the appeal.

## Working titles

- *Glass Tori Through Infinity: Exact Images of the Rotating Hopf Family*
- *A Ray Becomes a Circle: Ray Tracing Stereographic Hopf Tori*
- *Seeing the Clifford Torus Turn Inside Out*

## Pitch (one paragraph)

As an undergraduate I wanted to ray trace stereographic images of the flat torus $(\cos u,\sin u,\cos v,\sin v)$. The key was to embed it in a family, $(\cos t\cos u,\cos t\sin u,\sin t\cos v,\sin t\sin v)$, which fills the three-sphere with nested tori, so that every point has a torus label $t$. The step I could not take then was following a camera ray into four dimensions. A straight ray lifts to a circle on the three-sphere, and asking where that circle reaches a chosen $t$ gives a quartic equation. Solving it per pixel produces exact images, with no polygons or tubes. The tori become glass, nest inside one another, and turn inside out as they rotate through the projection pole into infinity.

## Draft abstract (~120 words)

> The Clifford torus and its relatives, the Hopf tori, are usually shown in three dimensions as polygon meshes or tubes. I describe how to ray trace their stereographic images exactly and interactively, as glass solids and thin shells that refract light, including the moments when a rotating torus passes through infinity and turns inside out. The method rests on two observations: the tori are the level sets of one simple function on the three-sphere, and a straight ray in the image lifts to a circle on the sphere. Where that circle meets a torus is the solution of a quartic equation. I explain the geometry, show why four is the smallest possible degree, and present images and an interactive web application.

## Section plan (8 pages)

### 1. An old idea (¾ page)

- The 1990s goal: render the flat torus in $S^3$ through stereographic projection, by ray tracing rather than meshing.
- What existing pictures look like (Banchoff's polygons; tubes; ray-marched approximations) and what they lose: true silhouettes, refraction, behaviour at infinity.
- **Figure 1 (hero):** three nested glass tori after a four-dimensional rotation. Candidate: `papers/technical-note/figures/three-tori.png`, re-rendered larger and without labels.

### 2. A coordinate made of tori (1 page)

- The family $X(t,u,v)$; each $t\in(0,\pi/2)$ gives a torus $S^1(\cos t)\times S^1(\sin t)$; together they fill $S^3$ except for two circles.
- Membership is one equation: $x^2+y^2=\cos^2 t$. This is the "find $t$, then decide" idea.
- The Hopf map sends each torus to a circle of latitude, so these are Hopf tori.
- Aligned images are ring tori with major radius $\sec t$ and minor radius $\tan t$: a satisfying closed form for readers to check.
- **Figure 2:** the aligned family as nested ring tori (new render: several $t$ values, cutaway).

### 3. A ray becomes a circle (1¼ pages)

- Inverse stereographic projection; every point of the lifted ray is already on $S^3$, so there is no "hit the sphere" step as in ordinary 3D ray tracing.
- The lift of a line is a circle through the pole (existing diagram: `papers/technical-note/figures/ray-lift.png`).
- Intersections are where the torus label along that circle equals the chosen $t$; clearing denominators gives $V^T(P-cI)V=0$, a quartic in the ray parameter.
- **The picture to show:** project the lifted circle onto the plane of the first circle and it becomes an ellipse; each torus is the circle of radius $\cos t$ about the origin. Hits are where the ellipse crosses those circles, at most four of them.
- **Figure 3 (new):** that ellipse with concentric circles for several tori, intersection points marked, beside the corresponding ray in the 3D image.
- Why four is unavoidable. Only rays through the origin lift to great circles, where the equation drops to a quadratic. The projected tori are Dupin cyclides, which are quartic surfaces. Liouville's theorem (conformal means Möbius) and Beltrami's theorem (straight geodesic images need central projection) rule out a projection that is both round-looking and quadratic. The lab's gnomonic mode could show the contrast.

### 4. Rotating in four dimensions (¾ page)

- Rotations act through the projector $P=R\,\mathrm{diag}(1,1,0,0)R^T$. Six sliders give only four effective degrees of freedom, because rotations within each circle's plane slide the torus along itself.
- The pole condition $P_{44}=\cos^2 t$: the torus passes through infinity, and its image turns inside out.
- **Figure 4:** the pole sequence (`papers/technical-note/figures/pole-sequence.png`), possibly as glass rather than normal colours.

### 5. Glass, shells and light (1 page)

- Solid tori and angular shells (a band $t\pm\Delta t/2$, as thin as $0.01^\circ$, like a soap film).
- Refraction happens in ordinary 3D; transparency lets linked and nested tori be seen through each other.
- Materials: tinted glass, crystal, chrome, ceramic; environments chosen to make bending visible.
- **Figure 5:** solid versus shell (`papers/technical-note/figures/solid-shell.png`).
- **Figure 6 (new):** three linked shells with different tints, chosen for the exhibition as well.

### 6. Making it work (½ page)

- Charts that reach infinity without a clipping sphere, so surfaces through the pole stay exact.
- Precision honestly stated: rays that just graze a torus are the hard case. Their errors come from building the quartic, not solving it, and higher precision removes them. Cite the JCGT paper for detail.
- Runs in a browser at interactive rates; link the live observatory.

### 7. Gallery (1¼ pages)

- Four to six full-width images with short captions on what each shows mathematically: passage through infinity, unbounded glass, the Clifford torus at $t=\pi/4$, extreme $t$ near the core circles, chrome reflections.
- Optionally a strip of animation frames.

### 8. Further directions (¼ page)

- Any surface given by a quadratic form on $S^3$ can be ray traced the same way, as a quartic along the lifted ray.
- Animation, prints, and an exhibition piece.

### References (~½ page)

Banchoff, *Beyond the Third Dimension* (1990); McCuan and Spietz (1998); Lyons, "An Elementary Introduction to the Hopf Fibration", *Mathematics Magazine* (2003); Hanrahan, "Ray Tracing Algebraic Surfaces" (1983); the JCGT manuscript and live application.

## Figures to make

| Figure | Status |
| --- | --- |
| Hero: three glass tori after rotation | Exists; re-render at print resolution |
| Aligned nested family, cutaway | New render |
| Ray and its lifted circle | Exists (`ray-lift.png`) |
| Ellipse-and-circles diagram | New; can be generated from the shader's geometry |
| Pole sequence | Exists; consider a glass version |
| Solid versus shell | Exists |
| Linked tinted shells | New render |
| Gallery images | New renders, chosen for composition |

## Leave out

Corpora, failure counts, solver benchmarks, float-float arithmetic and provenance. One sentence and a citation cover them.

## Checklist

- [ ] Confirm the current Bridges call, template and deadlines
- [ ] Decide regular versus short paper, and whether to enter the exhibition
- [ ] Draft sections 1–3 first; they carry the idea
- [ ] Make Figure 3 (ellipse and circles)
- [ ] Re-render the hero and gallery images at print resolution
- [ ] Write the AI-assistance statement in your own words
