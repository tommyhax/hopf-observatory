---
title: "Ray tracing stereographic Hopf tori across the projection pole"
author: "Tom Crosby"
subtitle: "Geometry, quartic intersections, and solid and shell optics in Hopf Observatory"
date: "Technical note · 21 November 2026"
lang: en
---

## Abstract

We describe an interactive GPU ray tracer for stereographic projections of rotated Hopf tori. A rank-two projector gives an implicit quartic with analytic normals. Closest-point recentering and near/reciprocal ray coordinates permit Bernstein root isolation on finite parameter intervals even when the projected surface becomes unbounded. The implementation supports three simultaneous material regions, including thin shells, with successive Euclidean reflection and refraction.

An independent exact-rational reference separates solver error from float32 input-geometry rounding. On an 867-ray corpus, the production Bernstein solver and a Yuksel–Peters Newton-bisection baseline in both centered affine and near/reciprocal coordinates each match all 1,470 distinct positive intersections at relative-distance tolerance $10^{-4}$. All roots are collected from the unchanged original ray, before and after common surface refinement. A conventional float32 Ferrari baseline fails on 378 rays after refinement. The corpus includes projection-pole sweeps, adjacent-float pole offsets, grazing rays and six-plane rotations, with intersections approximately $2.4\times10^9$ scene units away. These results support a practical implementation study; they show no completeness advantage over the modern centered-coordinate baseline at this tolerance. Input rounding, tangencies and finite-precision transport remain limitations.

A separate frozen 2,400-query stress corpus finds the same 109 grazing failures in all three modern variants at $10^{-4}$, while all 1,800 random, pole and shell-boundary queries pass. Input rounding independently changes 570 intended root sets. Twelve selected optical paths pass per solver against independent captured-ray references. The short review manuscript is supplied separately as `PAPER.md`; this document retains the extended derivation and implementation detail.

## The accompanying demonstration

The complete working demo is included in this project. From the `hopf-observatory` directory:

```sh
npm start
```

The app is served at `http://localhost:8765/`. [Open the observatory](index.html) or [the illustrated browser note](technical-note.html). The app needs WebGL 2. Opening `index.html` directly with a `file:` URL is insufficient because the app uses JavaScript modules. The note's rendered equations use native MathML and require no external mathematics service.

<div class="demo-block">
<p><a href="index.html" target="_blank" rel="noopener">Open the local demo in its own tab</a></p>
<iframe src="index.html" title="Hopf Observatory: interactive quartic ray tracer" loading="lazy" allow="fullscreen"></iframe>
</div>

Drag to orbit the 3D camera; scroll or pinch to zoom. The six rotation sliders act in XY, XZ, XW, YZ, YW, and ZW. The app initially shows the $45^\circ$ torus as a tinted shell of width $0.01^\circ$; two further tori can be enabled with checkboxes. **Selected torus** groups its geometry and material controls. **Rotation** contains the six shared angles and automatic rotation. For an otherwise aligned solid, XW rotation crosses the pole at $90^\circ-t$; a shell has two nearby crossings. High quality allows 24 main-path interactions.

The surface is never converted to a polygon mesh or point cloud. A screen-filling triangle only invokes a fragment shader; each fragment independently constructs a ray and solves its intersection equation. Polynomial evaluations during root finding are numerical equation solving, not sampling a collection of surface points or ray marching through space.

![Three tori with parameters 25°, 45°, and 65°, rendered directly by the production shader. Each has a 0.5° shell, refractive index 1.3, and a small tinted coating. The second view applies a shared four-dimensional rotation. Camera and material values are recorded with the supplementary data.](figures/three-tori.png){#fig:family width=100%}

### Contributions

This implementation combines (i) a projector-based derivation of stereographic ray intersections and normals; (ii) directly constructed Bernstein coefficients in near/reciprocal charts, with closest-point recentering and homogeneous-form polishing; (iii) multi-region solid and shell optics, including $0.01^\circ$ parameter bands; and (iv) a reproducible pole-crossing comparison that separates root-solver error from input-geometry rounding. Each ingredient has prior work. The contribution is the documented combination, implementation detail, and measured behavior under a difficult geometric condition.

## 1. A family of tori and a coordinate on the three-sphere

Write a point of $S^3\subset\mathbb R^4$ as two complex coordinates $(z_1,z_2)$, with $|z_1|^2+|z_2|^2=1$. For $0<t<\pi/2$ define

$$
X(t,a,b)=(\cos t\cos a,\ \cos t\sin a,\ \sin t\cos b,\ \sin t\sin b).
$$

For each fixed $t$, the image $T_t$ is $S^1(\cos t)\times S^1(\sin t)$. At $t=\pi/4$ this is the standard Clifford torus. Every point away from the two circles $z_1=0$ and $z_2=0$ has a unique value

$$
\tau(q)=\operatorname{atan2}\!\left(\sqrt{q_3^2+q_4^2},\sqrt{q_1^2+q_2^2}\right).
$$

With $a,b$ taken modulo $2\pi$, the parameters give coordinates on the complement of those circles. Thus the family foliates that complement by disjoint tori. The value $t$ alone labels a torus, not a point. At the endpoints a circle factor collapses, so the same coordinate description is no longer bijective there. “A family of embeddings” or “a foliation by tori away from two circles” is more precise here than treating $t$ as a bijection with $S^3$.

For the Hopf map

$$
H(z_1,z_2)=\bigl(2\operatorname{Re}(z_1\overline{z_2}),\ 2\operatorname{Im}(z_1\overline{z_2}),\ |z_1|^2-|z_2|^2\bigr),
$$

$H(T_t)$ is the latitude with third coordinate $\cos 2t$. These are therefore Hopf tori. An arbitrary rotation in $SO(4)$ transports this description to a correspondingly rotated Hopf fibration; it need not preserve the particular fixed Hopf map written above.

Recovering $t$ on $S^3$ supplies a level-set membership test. To use it for projected ray tracing, the remaining issue is the curve on $S^3$ corresponding to a straight ray in the projected scene.

## 2. Lifting a 3D ray: a circle, not a straight 4D ray

Use the north pole $N=(0,0,0,1)$ and stereographic projection

$$
\sigma(q)=\frac{q_{1:3}}{1-q_4}.
$$

For $p=(x,y,z)$, let $D=1+|p|^2$ and

$$
V(p)=(2x,2y,2z,|p|^2-1),\qquad Q(p)=\frac{V(p)}D.
$$

Direct substitution gives $|Q(p)|=1$ and $\sigma(Q(p))=p$. Therefore every point on the lifted ray $Q(o+s d)$ is already on $S^3$. Intersecting a straight 4D ray with the hypersphere and then testing one or two sphere hits would not solve the projected ray-tracing problem.

The lift of the complete 3D line, together with $N$, is a circle. To see this, choose independent vectors $e_1,e_2$ perpendicular to its direction $d$. The line obeys $e_i\cdot p=e_i\cdot o$, so its lift obeys

$$
e_i\cdot q_{1:3}=(e_i\cdot o)(1-q_4),\qquad i=1,2.
$$

These are two affine hyperplanes in $\mathbb R^4$, both containing $N$. Their common two-plane cuts the unit sphere in a circle. A forward camera ray lifts to an arc ending at $N$ as $s\to+\infty$.

The desired intersections are precisely the points along this arc at which the torus coordinate has the chosen value. The rational map $Q$ turns that test into the ray polynomial below.

![A straight ray and its circular lift. This diagram uses the section $p=(s,b,0)$, so $q_3=0$ and the relevant part of $S^3$ can be drawn with coordinates $(q_1,q_2,q_4)$. The forward arc approaches the projection pole N. The diagram illustrates the mapping; it is not a surface-rendering approximation.](figures/ray-lift.png){#fig:lift width=100%}

## 3. Rotation and the implicit quartic

Let $R\in SO(4)$ and

$$
P_0=\operatorname{diag}(1,1,0,0),\qquad P=RP_0R^T,\qquad c=\cos^2t.
$$

The rotated torus is characterized by $q^TPq=c$ on $S^3$. The matrix $P$ is a symmetric rank-two orthogonal projector: $P^T=P$, $P^2=P$, and $\operatorname{tr}P=2$.

The implementation constructs $R$ by successively left-multiplying rotations in the six coordinate planes. Changing their order generally changes the result. Every supported rotation still uses the same projector and intersection formulas.

The six rotation parameters do not give six independent geometric degrees of freedom for the torus. For $H=\operatorname{diag}(H_1,H_2)$ with $H_1,H_2\in SO(2)$,

$$
HP_0H^T=P_0,\qquad (RH)P_0(RH)^T=RP_0R^T.
$$

These two rotations shift the circle phases $a,b$ without changing the surface. The full stabilizer of $P_0$ within $SO(4)$ is $S(O(2)\times O(2))$, the block-diagonal orthogonal matrices with total determinant one; its identity component is $SO(2)\times SO(2)$. Thus the projectors form the unoriented Grassmannian of two-planes in $\mathbb R^4$,

$$
\operatorname{Gr}_2(\mathbb R^4)\cong SO(4)/S(O(2)\times O(2)),\qquad
\dim\operatorname{Gr}_2(\mathbb R^4)=6-2=4.
$$

This is the standard projector/quotient description of the Grassmannian [10]. At fixed $t$, the torus therefore has four continuous rotational degrees of freedom; allowing $t$ to vary adds one. At $t=\pi/4$, $P$ and $I-P$ additionally describe the same boundary, a discrete identification that leaves the dimension unchanged but reverses the field sign used to select a solid's material side. The six sliders provide a convenient redundant description of $R$; the redundancy need not correspond to two individual sliders in an ordered product of fixed-plane rotations.

Substitute $q=Q(p)$ and multiply by the strictly positive $D^2$:

$$
\boxed{f_c(p)=V(p)^TPV(p)-c(1+|p|^2)^2=0.}
$$

Since $V^TV=D^2$, it is convenient to put $A_c=P-cI$ and write $f_c=V^TA_cV$. This is a polynomial of degree at most four; no approximation has been introduced by clearing the denominator. In computation the bounded field

$$
F_c(p)=Q(p)^TA_cQ(p)=\frac{f_c(p)}{D^2}
$$

has the same zero set and sign, while avoiding the quartic growth of $f_c$ far from the origin.

As a useful check, with $R=I$ and $\rho=\sqrt{x^2+y^2}$ the equation is

$$
4\rho^2=c(1+\rho^2+z^2)^2.
$$

Taking the nonnegative square root and completing the square gives

$$
(\rho-\sec t)^2+z^2=\tan^2t.
$$

Thus the aligned projection is an ordinary ring torus with major radius $\sec t$ and minor radius $\tan t$.

## 4. Exact normals

Differentiate the quadratic form, using symmetry of $P$, $\partial V/\partial p_i=2e_i+2p_i e_4$, and $\partial D/\partial p_i=2p_i$. The result is

$$
\boxed{\nabla f_c=4\left[(PV)_{1:3}+p\bigl((PV)_4-cD\bigr)\right].}
$$

Equivalently,

$$
\nabla f_c=4D\left[(A_cQ)_{1:3}+p(A_cQ)_4\right].
$$

The shader normalizes the expression in brackets. Its positive omitted factor does not affect the normal direction. On the surface, $\nabla F_c=\nabla f_c/D^2$, so either field yields the same orientation.

For $0<c<1$, the level is regular on $S^3$: the tangential gradient of $q^TPq$ is $2(Pq-cq)$, whose squared norm on the level is $4c(1-c)>0$. Stereographic projection is a smooth coordinate map at every finite point. The finite projected surface is consequently smooth even when another part of it passes through infinity. A tangent ray is a multiple polynomial root, not a singular point of the surface.

## 5. The ray polynomial

For a unit direction $d$, write $p(s)=o+s d$ and

$$
v_0=(2o,|o|^2-1),\qquad v_1=(2d,2o\cdot d),\qquad v_2=(0,0,0,1).
$$

Then $V(p(s))=v_0+s v_1+s^2v_2$. For the symmetric bilinear form $B(a,b)=a^TA_cb$,

$$
f_c(o+s d)=a_0+a_1s+a_2s^2+a_3s^3+a_4s^4,
$$

where

$$
\begin{aligned}
a_0&=B(v_0,v_0), & a_1&=2B(v_0,v_1),\\
a_2&=B(v_1,v_1)+2B(v_0,v_2), & a_3&=2B(v_1,v_2),\\
a_4&=B(v_2,v_2)=P_{44}-c.
\end{aligned}
$$

Positive real roots are forward intersections. A generic line has at most four intersections with one boundary. Reflection or refraction changes the direction, after which the same calculation is repeated for the new ray. A shell uses two such quartics and can have eight crossings along a single straight line.

## 6. The projection pole and apparent eversion

The pole lies on the rotated torus exactly when

$$
N^TPN=c\quad\Longleftrightarrow\quad P_{44}=c.
$$

This is also exactly the condition $a_4=0$. The ray polynomial then has degree at most three, with further reductions possible for special rays. Finite roots remain legitimate intersections; a root at the compactified endpoint representing infinity is not a finite hit.

The torus remains embedded and smooth in $S^3$ throughout the rotation. Its Euclidean projection becomes unbounded when the pole is on the surface. Passing through that configuration can exchange the bounded and unbounded sides of the selected material. The resulting inside-out motion is not an eversion through a self-intersecting family of compact tori in $\mathbb R^3$: the family passes through infinity.

This visualization has clear antecedents. Banchoff describes the stereographic images of rotated Clifford tori as Dupin cyclides, explicitly including passage through infinity and interchange of latitude and longitude. The UCI/3D-XplorMath gallery also displays this inside-out deformation. These effects are prior work, not discoveries of this implementation. [Banchoff, *Beyond the Third Dimension*, online chapter](https://www.math.brown.edu/tbanchof/Beyond3D.new/chapter6/s6_8.html); [3D-XplorMath Clifford torus gallery](https://webapps.math.uci.edu/~vmm/Surface/clifford_torus/clifford_torus.html).

![An XW rotation through the pole for the Clifford torus, at a fixed camera. The central panel has $P_{44}=\cos^2t$ in exact arithmetic. Colors encode the oriented analytic normal; the visible boundary leaves the image and returns with the material orientation carried through the rotation. These are ray-traced images, including at the unbounded configuration.](figures/pole-sequence.png){#fig:pole width=100%}

## 7. Numerical intersection method used by the demo

### Recenter the line

Expanded camera-origin coefficients can be poorly conditioned when a small torus feature is far along a ray. The implementation first sets

$$
k=o\cdot d,\qquad C=o-kd,\qquad p(s)=C+(k+s)d.
$$

Thus $C$ is the closest point of the line to the origin. The line is split into $C+\lambda e$ with $e=d$ or $e=-d$ and $\lambda\geq0$. Candidates map back to $s=\lambda-k$ or $s=-\lambda-k$ and are filtered and ordered in the original forward-ray coordinate.

### Cover each half-line with two finite charts

Let $L=\max(1,|C|)$. Use $x=\lambda/L$ on $0\leq\lambda\leq L$, and $x=L/\lambda$ on $L\leq\lambda<\infty$. Both coordinates lie in $[0,1]$, but $x=0$ in the reciprocal chart denotes infinity and is excluded. No finite far clipping sphere is introduced. The coordinate $x=1$ is the common chart boundary; repeated intersection queries apply the ordinary positive-distance cutoff there.

Define

$$
a=(2C/L^2,(|C|^2-1)/L^2),\quad
b=(2e/L,2C\cdot e/L),\quad c_2=(0,0,0,e\cdot e).
$$

The near numerator is $W(x)=a+bx+c_2x^2=V(C+Lxe)/L^2$. The reciprocal numerator reverses the coefficients: $W(x)=c_2+bx+ax^2=x^2V(C+Le/x)/L^2$. Thus $g(x)=W(x)^TA_cW(x)$ has exactly the finite intersections of its chart. The common scale $L^{-2}$ limits coefficient growth. Although $C\cdot e=0$ and $e\cdot e=1$ in exact arithmetic, the code retains their computed values.

For either chart write $W=a'+b'x+c'x^2$ and set $w_0=a'$, $w_1=a'+b'/2$, $w_2=a'+b'+c'$. Its quartic Bernstein coefficients are

$$
\begin{aligned}
b_0&=B(w_0,w_0), & b_1&=B(w_0,w_1),\\
b_2&=\bigl(B(w_0,w_2)+2B(w_1,w_1)\bigr)/3,\\
b_3&=B(w_1,w_2), & b_4&=B(w_2,w_2).
\end{aligned}
$$

A strictly one-signed coefficient set rejects the chart by the Bernstein convex-hull property. Degree reduction needs no division by a small leading monomial coefficient. In the reciprocal chart, a relative perturbation of $x$ gives approximately the same relative perturbation of $\lambda=L/x$; distant intersections therefore retain relative coordinate resolution as they approach $x=0$.

### Isolate and polish roots

A real polynomial is monotone between consecutive roots of its derivative. The solver obtains the derivative roots recursively, starting with a linear equation, then partitions the quadratic, cubic and quartic into monotone intervals. Coefficient differences supply Bernstein derivatives; omitted positive degree factors do not affect their zeros. De Casteljau evaluation is used throughout.

Opposite signs at interval ends bracket a crossing. Up to 25 bisection steps are followed by secant interpolation inside the final bracket, preserving relative accuracy for roots near zero. Near-zero stationary values supply even-multiplicity candidates only when adjacent intervals do not already contain crossings. Endpoints require exact zero. Coefficients are rescaled, and duplicate candidates are compared relative to their chart coordinates.

Up to four bounded Newton steps polish each candidate against the homogeneous form itself:

$$
g=W^TA_cW,\qquad g'=2(b'+2xc')^TA_cW.
$$

A proposal is accepted only if it stays in $[0,1]$, moves by at most $0.05\max(x,10^{-6})$, and strictly decreases the computed $|g|$. Refinement stops at a computed zero, zero derivative, float stagnation or rejected proposal; nonfinite residuals cannot pass the decrease test. This guard retains the previous candidate when progress is unresolved. It does not preserve the isolator's final bracket, and a decrease in a rounded residual does not certify a smaller geometric distance error. Define $M=|W|^T|A_c||W|$, where absolute values are componentwise. The acceptance residual is

$$
\rho=\frac{|g|}{M+|g'|h},\qquad
h=\begin{cases}1&\text{near chart},\\x&\text{reciprocal chart}.\end{cases}
$$

The shader requires $\rho<2\times10^{-6}$, a finite converted distance, and a forward hit beyond the self-intersection cutoff. The reciprocal factor $x$ scales the derivative term to relative distance error. This is a conditioning-aware heuristic, not a certified distance-error bound. Charts are visited in ray order: negative reciprocal, negative near, positive near, positive reciprocal, omitting the negative half when it lies behind the origin.

### What robustness means here

This is a practical float32 solver, not an exact-arithmetic certificate. The stationary-point tolerance called `errorBound` in the shader is a heuristic, not a proved interval bound. Close roots can merge; near tangencies can be ambiguous; extremely distant roots remain subject to float32 underflow, overflow and coordinate precision. Near the pole, tiny changes to float32 rotation or level values may move a remote root substantially. An identically zero ray polynomial describes a line contained in the surface and has no isolated first crossing; the solver does not resolve that exceptional case as a continuum of hits.

Let $\gamma$ be the smallest distinct angular boundary separation among enabled tori. The bias scale is $\beta=\operatorname{clamp}(0.05\gamma,10^{-6},4\times10^{-4})$, with $\gamma$ in radians; a lone solid uses the upper limit. The ray-distance cutoff is $\beta\max(1,|o|)/2$ and the post-hit offset is $\beta\max(1,|p|)$. These suppress self-intersections while retaining the tested $0.01^\circ$ walls. Features below the offset and float32 resolution remain unresolved. “No finite clipping sphere” therefore does not mean unlimited numerical reach or guaranteed detection of every mathematical root.

## 8. A solid and a shell are different material choices

An implicit equation specifies a boundary. Refraction also requires a choice of which side contains which medium.

### Solid mode: one torus boundary

Solid mode chooses glass where $F_c>0$, equivalently $q^TPq>c$. In the unrotated case this is the familiar filled tube bounded by the ring torus. In $S^3$ it is the side $\tau<t$, whose closure is a solid torus. Its outward normal is

$$
n_{\mathrm{out}}=-\frac{\nabla f_c}{|\nabla f_c|}.
$$

A single closed torus boundary is sufficient to define this solid. A ray can enter the tube and later exit through another point on the same boundary. A second torus is not needed to obtain entry and exit intersections.

When $P_{44}>c$, the pole is inside the chosen material region, so its projection includes the exterior of a sufficiently large ball. The definition of the material is held fixed during animation; the program does not silently swap glass and air to keep glass bounded.

### Shell mode: two neighboring tori

Set $t_-=t-\Delta t/2$ and $t_+=t+\Delta t/2$, with both in $(0,\pi/2)$, and define

$$
c_{\mathrm{low}}=\cos^2t_+,\qquad c_{\mathrm{high}}=\cos^2t_-.
$$

Because cosine squared decreases on this interval, $c_{\mathrm{low}}<c_{\mathrm{high}}$. Glass now occupies

$$
\boxed{c_{\mathrm{low}}<Q(p)^TPQ(p)<c_{\mathrm{high}}.}
$$

Equivalently, glass is $t_-<\tau(R^TQ(p))<t_+$. Both adjoining regions are air. The shell is bounded by the two independently solved quartics $f_{c_{\mathrm{low}}}=0$ and $f_{c_{\mathrm{high}}}=0$. Each tracing step selects the nearest positive hit from either equation. At the low boundary the outward normal is the **negative** gradient; at the high boundary it is the **positive** gradient. Those opposite signs make cavity entry and exit obey the same optical code as outer-wall entry and exit.

This is an exact parameter-band shell, not a constant-thickness Euclidean offset surface. In $S^3$, the $t$ direction is normal to the tori and $|\partial X/\partial t|=1$, so $\Delta t$ has a natural angular thickness interpretation. Stereographic projection has metric factor $2/(1+|p|^2)$: a sufficiently thin shell has local Euclidean normal thickness approximately $(1+|p|^2)\Delta t/2$, with $\Delta t$ in radians. Near infinity that local approximation is not uniform.

The UI defaults to the minimum width of $0.01^\circ$, and caps width at $30^\circ$ or the smaller amount needed to keep both endpoints between $0.25^\circ$ and $89.75^\circ$. A boundary reaches infinity when $P_{44}$ equals its level. Glass itself extends to infinity when $P_{44}$ lies strictly between the two levels; in that case both boundary surfaces can be bounded while the region between them through infinity is unbounded.

![A single solid torus and a shell between two nearby tori, with the same camera, central parameter t = 45°, refractive index 1.45, environment, and coating setting. The shell width here is 3° to make the two-wall structure visible. Entry and exit use genuine intersections with the respective material boundaries.](figures/solid-shell.png){#fig:materials width=90%}

### Several material regions

Up to three tori share the same $P$ but have independent parameter intervals and optical properties. At each step, the nearest boundary among the enabled regions is selected. When regions overlap, the narrower interval in $Q^TPQ$ takes precedence; the higher-numbered slot breaks ties. Coincident level boundaries update membership together. This explicit convention preserves nested media as their projections change orientation; it is an application choice, not a geometric necessity. Chrome follows the same material region through the pole and may become the exterior medium.

## 9. All the optics occur in ordinary 3D

The four-dimensional geometry defines the surface and material membership. Camera rays, distances, illumination, normals, reflection, absorption, and refraction are evaluated in Euclidean $\mathbb R^3$. Stereographic projection preserves angles, but the implementation does not transport a physical 4D optical simulation into 3D.

For unit incident direction $d$, orient the surface normal $n$ against the ray and let $c_i=-n\cdot d$. With refractive indices $n_1$ and $n_2$ on the incident and transmitted sides, put $\eta=n_1/n_2$. Then

$$
r=d+2c_i n,\qquad K=1-\eta^2(1-c_i^2).
$$

If $K<0$, total internal reflection occurs. Otherwise the transmitted direction is

$$
d_{\mathrm{tr}}=\eta d+(\eta c_i-\sqrt K)n.
$$

This is Snell's law in vector form. The shader uses the unpolarized dielectric Fresnel reflectance, averaging the squared s- and p-polarization amplitudes, and follows the resulting reflected and transmitted directions. Medium membership is initialized from the ray origin. A crossing updates it using the outward normal; a grazing contact is treated as a silhouette contact without toggling the medium. Numerical grazing thresholds remain approximations.

The procedural angular environment has a grid, checker pattern, bright strips, and colored lights that make bending visible. It is a direction-dependent distant environment, not a finite checkerboard floor. Opacity blends a locally lit colored coating at each interface and also scales Beer-style absorption in glass. It is consequently not a pure bulk extinction coefficient or a physically complete material parameterization.

The main path allows 8, 16, or 24 interactions according to quality. At the first interface, the reflected branch can intersect the object for up to four further interfaces; later reflection contributions use the environment directly. Total internal reflection continues within the same medium. Remaining energy after the transport budget is resolved to the environment. Segment absorption is capped, and rays remaining in an unbounded material use finite absorption. There is no complete recursive ray tree, spectral dispersion, global illumination, or caustic calculation. Exact surface equations and Snell-law directions should not be confused with exact light transport.

## 10. Experimental validation

### Regression checks and thin-shell optics

All 24 JavaScript CPU tests pass. Five independent-reference tests also pass, including an exact double tangent with rational coefficients. Five analysis tests check matching completeness, close-root assignment and failure accounting. These check projector invariants, polynomial identities, finite-difference normals, analytic ring-torus roots, tangencies, degree reduction, material membership and thin-wall origin offsets. The native offscreen GPU suite on an Apple M3 Pro passes 625 solid, 403 shell, and 133 three-torus ray cases, plus 31 focused thin-shell cases. One solid and six shell cases consolidate a same-boundary grazing root pair below the regression suite's float32 resolution threshold. Different shell boundaries are never consolidated. The independent comparison below uses its own matching rule and does not import those exceptions.

Instrumenting the production transport checks hit positions, successive effective media, refractive indices, analytic normals, Snell directions, and total internal reflection. All 36 paths pass, covering 392 events. At $\Delta t=0.01^\circ$, aligned single shells at $t=1^\circ,5^\circ,25^\circ,45^\circ,65^\circ,85^\circ,89^\circ$ retain eight crossings each. Three shells retain 24 crossings, with twelve entries and twelve exits. Oblique paths and both pole-crossing boundaries are included. Some rays enter an unbounded material region and have no finite exit. Maximum measured Snell residual is $1.05\times10^{-7}$ and maximum normal-vector error is $9.74\times10^{-8}$. Thirty-one index-one, opacity-zero checks have zero measured linear-color discrepancy. Full event counts and source hashes are supplied in `docs/gpu-results.json`.

### Independent reference and comparison protocol

The independent reference expands $V(o+sd)^T(P-cI)V(o+sd)$ in exact rational arithmetic and uses SymPy 1.14's continued-fraction real-root isolator [9]. Rational isolating intervals have width at most $10^{-30}$; multiplicities and brackets are retained. It imports no production root-finding code. A separate input construction uses 90-digit arithmetic rounded to 80 decimal digits to approximate the intended geometric data. Two references distinguish the resulting questions:

1. **Solver evaluation:** exact roots of the float32-rounded uniforms actually supplied to the GPU.
2. **Input sensitivity:** roots of those uniforms compared with roots of the 80-digit geometric approximation.

The pole corpus contains 600 rays: $t=25^\circ,45^\circ,65^\circ$ with an XW pole crossing, plus $t=45^\circ$ with an additional spatial rotation; six axial-direction rays sample different line offsets and both directions. Each configuration uses $\delta=0$ and $\delta=\pm10^{-k}$ for $k=1,\ldots,12$. Axial directions avoid introducing direction-normalization differences into this experiment. Nineteen additional rays approach the aligned Clifford torus's outer silhouette from either side. A further 176 cases include 168 adjacent-float pole tests ($t=1^\circ,5^\circ,25^\circ,45^\circ,65^\circ,85^\circ,89^\circ$, two spatial tilts, both adjacent float32 values of $P_{44}$ around $c$, and six rays) plus eight exact chart-boundary, origin and contained-line cases. Another 72 rays use twelve seeded six-plane rotations. The full corpus has 867 rays. The exact input arrays and both reference root sets are in `research/results/reference.json`.

The modern baseline adapts Peters's CC0 GLSL implementation [11] of Yuksel's derivative-partitioned Newton-bisection method [5]. The same solver is evaluated in two coordinate systems: the centered affine coordinate $x=\lambda/L$, with a coefficient-only Cauchy bound, and the four bounded near/reciprocal charts. Both variants construct power-basis coefficients directly from the homogeneous quadratic vectors. Exact leading-zero degree reduction, stable quadratic initialization, exact endpoint handling and a 90-iteration limit with float-stagnation stopping are shared. There is no interval-width-scaled absolute stopping tolerance that could erase tiny reciprocal roots. This is an adapted GPU baseline, not Yuksel's complete optimized C++ implementation. Source provenance and all adaptations are recorded in `research/THIRD_PARTY.md`.

A conventional baseline adapts Schwarze's Ferrari/Cardano solver [8] to float32, with a $10^{-6}$ near-zero tolerance and exact leading-zero degree reduction. It solves the same centered power polynomial as the affine Yuksel–Peters variant. Eleven polynomial checks validate the Newton-bisection port and three validate the Ferrari port. Thirty-two further method/stage fixtures record original-ray collection behavior at chart junctions, at the origin, below the rendering bias, and on a contained line; numerical failures in those fixtures remain in the report.

All four methods enumerate distinct positive roots of the **unchanged original ray**. There is no origin advance, positive-distance bias or finite scene far cutoff. The chart junction belongs to both adjacent intervals, because independently rounded polynomials can retain its root on only one side. Far-chart zero denotes infinity and is excluded. Identical float hit positions are consolidated; no proximity threshold merges neighboring contacts. Up to sixteen outputs are retained, so spurious candidates are not truncated to the quartic's theoretical root count. The contained-line case has no isolated roots and is classified separately by the reference.

Every method reports raw results and results after the same residual-decreasing homogeneous refinement (up to four steps) and conditioned residual filter. Matching maximizes the number of one-to-one assignments satisfying $|s_{\mathrm{GPU}}-s_{\mathrm{ref}}|/\max(1,s_{\mathrm{ref}})\leq10^{-4}$, then minimizes total error among equally complete assignments. A ray fails if any reference root or output is unmatched; nonfinite outputs fail too. Algebraic multiplicities are recorded but repeated copies of the same intersection are not required. The two Yuksel variants isolate a coordinate change while holding the solver and power-basis construction fixed. Comparing them with Bernstein also changes polynomial representation and isolation details.

### Numerical results and input sensitivity

The following all-roots results use native offscreen OpenGL on Apple M3 Pro. Each row covers all 867 rays and 1,470 expected roots. “Refined” includes both the shared Newton steps and residual acceptance filter.

| Method | Stage | Failed rays | Matched roots | Unmatched outputs |
|---|---|---:|---:|---:|
| Bernstein near/reciprocal | Raw | 0 | 1,470 | 0 |
| Bernstein near/reciprocal | Refined | 0 | 1,470 | 0 |
| Yuksel–Peters, centered | Raw | 0 | 1,470 | 0 |
| Yuksel–Peters, centered | Refined | 0 | 1,470 | 0 |
| Yuksel–Peters, near/reciprocal | Raw | 0 | 1,470 | 0 |
| Yuksel–Peters, near/reciprocal | Refined | 0 | 1,470 | 0 |
| Ferrari, centered | Raw | 428 | 682 | 223 |
| Ferrari, centered | Refined | 378 | 740 | 13 |

![All-roots comparison versus nominal distance from the projection pole; each nonzero magnitude contains 48 rays. Left: failed-ray percentage after common refinement, with the three iterative variants overlapping at zero. Middle: largest returned-root relative error after refinement; missing roots must be read with the left panel. Right: disagreement caused by input rounding alone, and the proportion of uploaded inputs whose $\delta$ is exactly zero.](figures/pole-errors.png){#fig:errors width=100%}

The three iterative variants match all reference roots before and after refinement. All have maximum relative-distance error $7.56\times10^{-5}$, from the grazing corpus. In the pole sweep, refined Bernstein reaches $1.63\times10^{-7}$ and both Yuksel variants $2.45\times10^{-7}$. Such small error differences on a structured corpus do not establish superiority. The farthest reference intersection is approximately $2.3983\times10^9$ scene units. The Ferrari port's refined failures comprise 227 pole rays, 13 grazing rays and 138 precision cases; its retained outputs must be considered alongside its missing and spurious roots.

Refinement is not uniformly beneficial: in the six-plane rotation subset, Bernstein's maximum error changes from $8.69\times10^{-7}$ raw to $5.84\times10^{-6}$ refined, while centered Yuksel–Peters changes from $4.12\times10^{-6}$ to $2.50\times10^{-6}$. Both remain within the matching tolerance. `research/results/pole-gpu.json` and `analysis.json` retain raw outputs, per-family errors and source hashes.

This experiment demonstrates **no root-completeness advantage for the near/reciprocal formulation over the centered Yuksel–Peters baseline** at the stated tolerance. The all-roots experiment measures accuracy; the full-render comparison below measures cost. Broader independent cases, tolerance sweeps and additional GPU/compiler stacks are needed to assess accuracy–cost tradeoffs.

A separate ray-continuation regression executes the production GLSL ES intersection function through WebGL 2 / ANGLE Metal. It passes all 867 rays and matches 1,470 roots at the same tolerance, with maximum relative-distance error $7.56\times10^{-5}$. Unlike the all-roots comparison, it advances the origin using the production bias. `research/results/webgl-validation.json` records its browser, renderer and source hashes. It checks the production browser compilation path on the same GPU; it is not a WebGL execution of the four-method comparison.

At nominal $|\delta|\leq10^{-9}$, every tested pole-sweep input rounds to $P_{44}=c$. The remote root of the intended geometry can disappear from the uploaded polynomial. All 24 nominal exact-pole cases pass against the rounded-input reference, but this cannot recover geometric information lost before root finding. Across the pole corpus, input rounding alone changes the root set beyond the matching tolerance on 210 of 600 rays. The adjacent-float tests specifically exercise small nonzero *representable* pole offsets. The grazing cases likewise distinguish intended contact from the exact geometry represented by float32 inputs.

### Final independent stress validation

The frozen production revision was evaluated on 2,400 seeded boundary queries: 600 random, 600 pole, 600 exact/near-tangent, and 600 thin-shell boundary cases. The tangent construction has 200 exact rational intended double contacts and two nearby rays per contact. The shell queries form 100 groups with three 0.01° shells, including overlapping material bands. Independent exact-rational isolation evaluates both intended and represented inputs. No production solver was changed during this pass.

At relative-distance tolerance $10^{-4}$, all three modern variants fail on the same 109 grazing query IDs and pass all 1,800 other queries. Bernstein matches 3,166/3,314 represented roots, with 148 missing and 137 unmatched outputs; the Yuksel variants each match 3,165, with 149 missing and 137 unmatched outputs. For each method, failures comprise 40 count shortfalls, 34 count excesses and 35 equal-count position failures. At tolerances $10^{-5}$ and $10^{-6}$, failed-query counts are 197/195/195 and 294/292/292, respectively, for Bernstein/centered Yuksel/chart Yuksel. Input rounding separately changes 570 intended root sets beyond $10^{-4}$; these are distinct comparisons with potentially overlapping failures.

All 100 shell groups retain boundary order at the principal tolerance. Twelve predetermined paths pass independent captured-ray intersection, normal, medium and Snell checks per solver: 167 boundaries, including 158 optical events and nine hidden boundaries. One path reaches the boundary cap and one the energy cutoff; neither is claimed complete. The remaining terminal misses are checked for further intersections. Thirty full-image comparisons have maximum frame-mean RGB error $2.82\times10^{-6}$; one pixel differs by 0.341, so close agreement is not exact equivalence.

`research/STRESS.md` supplies the constructions, tighter-tolerance results, conditioning diagnostics, absolute and relative position errors, representative failures and reproduction commands. The original corpus's complete matching does not extend to the deliberately grazing corpus. The evidence supports an evaluated implementation, not a certified robust solver or a claim of superior completeness.

### Refinement ablation

Four policies use the same Bernstein candidates and residual acceptance filter: no Newton correction; step-limited Newton without a decrease test; the production residual-decreasing guard; and a conservative noise-aware guard. The last requires $|g_{\mathrm{new}}|+8\epsilon M_{\mathrm{new}}<|g|-8\epsilon M$, where $\epsilon=2^{-23}$ and $M$ is the absolute quadratic-form magnitude. This error floor is a heuristic, not interval arithmetic. All four policies match all 1,470 roots. Maximum relative-distance errors in three subsets are:

| Refinement policy | Pole sweep | Precision cases | Six-plane rotations |
|---|---:|---:|---:|
| None | $2.37\times10^{-7}$ | $2.35\times10^{-6}$ | $8.69\times10^{-7}$ |
| Step-limited, no decrease test | $1.63\times10^{-7}$ | $1.75\times10^{-7}$ | $1.23\times10^{-5}$ |
| Residual-decreasing (production) | $1.63\times10^{-7}$ | $1.58\times10^{-7}$ | $5.84\times10^{-6}$ |
| Noise-aware | $2.37\times10^{-7}$ | $2.35\times10^{-6}$ | $8.69\times10^{-7}$ |

The production guard reduces the worst rotation error relative to step-limited Newton while retaining the improvements in the pole and precision subsets. It still has a larger rotation maximum than no correction. The noise-aware policy returns exactly the unrefined roots throughout this corpus, foregoing the precision-subset improvements. The global maximum remains $7.56\times10^{-5}$, from grazing rays, for all policies. These results motivate a limited safeguard, not a claim of uniformly improved accuracy. `refinement-gpu.json` and `refinement-analysis.json` retain the ablation data.

### Full-render solver comparison

The native renderer comparison replaces only intersection and refinement functions in the production optical shader. Both Yuksel variants use the production residual-decreasing guard, residual acceptance, medium transitions, offsets and transport budgets. The bounded-chart variant also shares the Bernstein convex-hull rejection and chart traversal. The centered variant solves a single Cauchy-bounded polynomial per query. Thus timings include coefficient construction, rejection, root finding and the resulting optical paths; they are not isolated polynomial-solver throughput measurements.

On Apple M3 Pro, each scene/resolution/variant has three blocks of five warmup and ten measured frames. Variant order rotates between blocks and scenes. Timing surrounds draw plus `glFinish`, excluding compilation, readback, UI and vsync. The following pooled medians use 1280 × 720 buffers and a 24-interaction cap:

| Scene | Bernstein (production) | Yuksel, centered | Yuksel, charts |
|---|---:|---:|---:|
| One solid torus | 3.13 ms | 2.86 ms | 2.88 ms |
| One 0.01° shell | 5.63 ms | 6.38 ms | 5.55 ms |
| Three 0.01° shells, aligned | 19.78 ms | 33.02 ms | 22.27 ms |
| Three 0.01° shells, XW = 45° | 38.45 ms | 67.69 ms | 45.74 ms |

Yuksel is faster for the single solid in this run, but neither variant is consistently faster for the shell scenes. At 640 × 360 the centered variant is approximately 34% slower for three aligned shells and 55% slower near the pole; the chart variant is approximately 7% and 14% slower. These measurements support retaining Bernstein for the application's thin-shell workload. They do not establish general solver superiority: this is an adapted baseline, a small scene set and one GPU/compiler stack. Scheduling and thermal variation are visible between blocks, particularly at 1280 × 720. Raw samples, block medians, interquartile ranges, uniforms and source hashes are in `renderer-benchmark.json`, including the two additional refinement controls.

Both complete Yuksel renderer variants pass the same native transport suite as production: 31 focused thin-shell cases, 36 refraction paths with 392 events, 31 index-one checks, 625 solid, 403 shell and 133 multi-torus cases, and eight full-fragment smoke checks. The 0.01° single-shell and three-shell paths retain their eight and 24 interfaces. Separate variant reports record normals, Snell residuals and medium transitions. The application continues to use Bernstein; the alternatives are reproducible research variants rather than user-facing settings.

### Browser rendering cost

Measurements use an **Apple M3 Pro** on macOS, with the in-app Chromium browser reporting **Chrome/157.0.0.0**, WebGL 2, GLSL ES 3.00, and **ANGLE Metal Renderer: Apple M3 Pro**. This is the embedded Chromium browser, not a separately tested Google Chrome application. Each configuration uses five warmup frames and 30 recorded frames. Drawing-buffer dimensions are fixed, independent of display scaling or adaptive resolution. Browser times surround a draw plus a synchronous one-pixel readback, which forces completion and adds readback overhead. They exclude shader compilation, UI work and display refresh. The complete user-agent string, uniforms and samples are saved in `research/results/webgl-benchmark.json`.

| Scene, 24-interaction cap | 640 × 360 median | 1280 × 720 median |
|---|---:|---:|
| One solid torus | 3.30 ms | 5.30 ms |
| Three 0.01° shells, aligned | 12.40 ms | 36.40 ms |
| Three 0.01° shells, XW = 45° | 25.00 ms | 91.90 ms |

![Browser draw-and-readback timings on Apple M3 Pro. Lines show medians; shading shows the interquartile range of 30 samples. The interaction count is a maximum budget, not a claim that every pixel encounters that many interfaces. Fixed-scene timings are sensitive to scheduling and thermal state; the nonmonotonic small differences should not be treated as algorithmic speedups.](figures/performance.png){#fig:performance width=100%}

An independent native offscreen run uses OpenGL 4.1 Metal 90.5 and changes only the shader version directive to GLSL 4.10. Its production draw-and-`glFinish` timings omit readback and browser overhead and are retained separately in `research/results/rendering.json`; the repeated variant comparison is in `renderer-benchmark.json`. Native and browser timings should not be conflated. This is a single-device study, not a portability or cross-vendor performance claim. Ferrari is evaluated numerically, not timed in the full renderer.

## 11. Reproducibility

The companion package contains the buildless application, CPU/GPU tests, independent reference, baseline source and attribution, raw result JSON, figure recipes, LaTeX source and PDF. `research/README.md` gives exact commands and pinned Python package versions. `npm test` runs the CPU suite; `npm run test:gpu` runs native macOS hardware checks. `research/verify.html` checks the independent corpus in WebGL; `research/benchmark.html` runs the browser timing protocol when the project root is served locally. Figure renders are generated by the production shader into an offscreen framebuffer.

The implementation is MIT licensed, copyright Tom Crosby, 2026. The adapted Graphics Gems baseline retains its upstream permission notice. A per-file SHA-256 manifest identifies the exact contents of the supplementary package.

## 12. Related work and scope

The following sources establish that the main geometric and rendering ingredients predate this project. This is a focused literature check, not an exhaustive priority search.

| Topic | Relevant prior work | Consequence for this note |
|---|---|---|
| Rotated Clifford tori, cyclides, and passage through infinity | Banchoff's online *Beyond the Third Dimension* chapter; the book was first published in 1990. The online edition also has a later preface. The 3D-XplorMath gallery provides another explicit inside-out demonstration. | The geometry and inside-out animation are established. |
| Four-dimensional rotations and stereographic Clifford-torus geometry | McCuan and Spietz (1998) analyze rotations and symmetries under stereographic projection. | The geometric exposition builds on these established results. |
| Ray tracing implicit algebraic surfaces | Hanrahan (1983) derives ray-polynomial intersections and shading for algebraic surfaces. | Quartic ray substitution, analytic normals, and secondary rays are established techniques. |
| GPU ray tracing in Bernstein form | Seland and Dokken, *Real-Time Algebraic Surface Visualization*, construct per-ray Bernstein polynomials and find roots on the GPU using Bézier subdivision. | Neither GPU algebraic ray tracing nor use of Bernstein coefficients is new here. |
| Root isolation through derivative roots | Yuksel (2022) uses derivative-root intervals and a robust iterative solver for polynomial roots in graphics. | The monotone-interval idea is prior work; this implementation uses Bernstein evaluation and bisection and bracket interpolation followed by homogeneous-form polishing. |
| Robust roots evaluated against the surface | Szente, Karikó, and Valasek (2026) combine GPU polynomial representations with refinement against the original implicit function. | Refinement against the implicit field predates this implementation. |

Sources for the table: [Banchoff chapter](https://www.math.brown.edu/tbanchof/Beyond3D.new/chapter6/s6_8.html), [book publication record](https://www.math.brown.edu/tbanchof/howison/newbanchoff/oldpubs/52.php), [online preface](https://www.math.brown.edu/tbanchof/Beyond3D.new/preface.html), [3D-XplorMath gallery](https://webapps.math.uci.edu/~vmm/Surface/clifford_torus/clifford_torus.html), [McCuan and Spietz](https://arxiv.org/abs/math/9810023), [Hanrahan paper](https://www.cs.drexel.edu/~deb39/Classes/Papers/p83-hanrahan.pdf), [Seland and Dokken preprint](https://www.sintef.no/globalassets/project/heterogeneous-computing/preprints/algebraic_surface_springer.pdf), [Yuksel paper](https://www.cemyuksel.com/research/polynomials/polynomial_roots_hpg2022.pdf), and [Szente, Karikó, and Valasek author-uploaded paper](https://www.researchgate.net/publication/410684146_Robust_Ray-Surface_Intersections_for_Algebraic_Surfaces).

The comparison supports a narrower engineering conclusion: for the sampled configurations, both the Bernstein near/reciprocal implementation and the modern centered Newton-bisection baseline retain more reference intersections than the tested Ferrari port. The coordinate comparison does not demonstrate an advantage in completeness at the tested tolerance. It does not establish priority for compactification, Bernstein evaluation, derivative-root isolation, direct-field polishing, Hopf-torus visualization, or refractive ray tracing. The modern baseline matches the same corpus completely; comparisons on broader independent data, alternative compactifications and additional GPUs remain necessary before claiming a broadly superior numerical method.

## 13. Limitations

The renderer uses float32 and heuristic stationary-root tolerances. It can merge close contacts, skip features below the origin offset, or lose accuracy for ill-conditioned or extremely distant hits. It does not resolve a ray lying entirely in the surface as a continuum of intersections. Input rounding itself can change topology at the pole. The final stress corpus contains 109 grazing failures per modern variant at the principal tolerance. The experiments use finite, structured corpora and one GPU; they neither certify arbitrary rotations nor cover every grazing or overlapping-shell configuration.

Optics use a bounded main path and a limited reflected branch, approximate metal Fresnel colors and rough environment reflections, finite absorption for unbounded paths, and no caustics, spectral dispersion or global illumination. The shell is an angular band in $S^3$, not a constant Euclidean wall thickness. Overlapping materials follow an explicit interval-priority rule. Exact surface equations should not be confused with exact numerical roots or complete physical light transport.

## Assistance and responsibility

Tom Crosby supplied the geometric motivation, directed the project and evaluated the interactive results. OpenAI Codex assisted with derivations, implementation, experiment design and execution, figure-generation code, literature checking, and manuscript drafting and revision. The automated checks and independent reference calculations described above provide the recorded verification; they do not substitute for human review. Codex is identified as an AI tool rather than a human author. Tom Crosby is responsible for the interpretation and conclusions. The rendered figures and plots are deterministic outputs of the supplied code and data, not AI-generated illustrations.

## References

1. Thomas F. Banchoff. *Beyond the Third Dimension*. Scientific American Library, 1990. Consulted: [online chapter, “Stereographic Projection from Four-Space”](https://www.math.brown.edu/tbanchof/Beyond3D.new/chapter6/s6_8.html). The date of the book should not be read as verification that every sentence of the later online edition appeared unchanged in 1990.
2. John McCuan and Lafe Spietz. “Rotations of the three-sphere and symmetry of the Clifford torus.” MSRI Preprint 1998-052, arXiv:math/9810023, 1998. [Primary record](https://arxiv.org/abs/math/9810023).
3. Pat Hanrahan. “Ray Tracing Algebraic Surfaces.” *Computer Graphics* 17(3), SIGGRAPH 1983, pp. 83–90. [DOI: 10.1145/964967.801136](https://doi.org/10.1145/964967.801136). [Paper scan](https://www.cs.drexel.edu/~deb39/Classes/Papers/p83-hanrahan.pdf).
4. Johan Simon Seland and Tor Dokken. “Real-Time Algebraic Surface Visualization.” *Geometric Modelling, Numerical Simulation, and Optimization*, Springer, 2007, pp. 163–183. [DOI: 10.1007/978-3-540-68783-2_6](https://doi.org/10.1007/978-3-540-68783-2_6). [SINTEF preprint](https://www.sintef.no/globalassets/project/heterogeneous-computing/preprints/algebraic_surface_springer.pdf).
5. Cem Yuksel. “High-Performance Polynomial Root Finding for Graphics.” *Proceedings of the ACM on Computer Graphics and Interactive Techniques* 5(3), Article 7, 2022. [DOI: 10.1145/3543865](https://doi.org/10.1145/3543865). [Author's PDF](https://www.cemyuksel.com/research/polynomials/polynomial_roots_hpg2022.pdf).
6. Péter Szente, Csongor Csanád Karikó, and Gábor Valasek. “Robust Ray–Surface Intersections for Algebraic Surfaces.” *Eurographics 2026 — Short Papers*. [DOI: 10.2312/egs.20261027](https://doi.org/10.2312/egs.20261027). [Author-uploaded full text](https://www.researchgate.net/publication/410684146_Robust_Ray-Surface_Intersections_for_Algebraic_Surfaces).
7. 3D-XplorMath / Virtual Math Museum. [“Clifford Torus” gallery](https://webapps.math.uci.edu/~vmm/Surface/clifford_torus/clifford_torus.html). Undated web demonstration; consulted November 2026.
8. Jochen Schwarze. “Cubic and Quartic Roots.” In *Graphics Gems*, edited by Andrew S. Glassner, Academic Press, 1990, pp. 404–407. [Maintained source repository](https://github.com/erich666/GraphicsGems/blob/master/gems/Roots3And4.c).
9. Aaron Meurer et al. “SymPy: symbolic computing in Python.” *PeerJ Computer Science* 3:e103, 2017. [DOI: 10.7717/peerj-cs.103](https://doi.org/10.7717/peerj-cs.103). The experiments use SymPy 1.14.0 and its exact-rational real-root isolation.
10. Thomas Bendokat, Ralf Zimmermann, and P.-A. Absil. “A Grassmann manifold handbook: basic geometry and computational aspects.” *Advances in Computational Mathematics* 50, Article 6, 2024. [DOI: 10.1007/s10444-023-10090-8](https://doi.org/10.1007/s10444-023-10090-8). [Author preprint](https://arxiv.org/abs/2011.13699), Section 2.
11. Christoph Peters. “Finding Real Polynomial Roots on GPUs.” *Moments in Graphics*, 31 October 2023. [Author's implementation and discussion](https://momentsingraphics.de/GPUPolynomialRoots.html). The accompanying GLSL code is dedicated under CC0 1.0.

## Implementation map

| File | Purpose |
|---|---|
| `web/math.js` | Rotation/projector construction, CPU field and root reference, shell levels and merged shell roots. |
| `web/shader.js` | Quartic coefficients, root isolation, boundary selection, analytic normals, and optical tracing. |
| `web/app.js` | Camera, animation, six angles, material controls, pole indicators, and WebGL uniforms. |
| `web/index.html`, `web/style.css` | Interactive application and in-app mathematical explanation. |
| `tests/math.test.js` | Twenty-four CPU verification tests. |
| `web/verify.html`, `web/verify-shell.html`, `web/verify-scene.html` | Browser-executed GLSL verification reports. |
| `research/` | Independent reference, baseline, numerical experiments, benchmarks and figure generation. |
| `TECHNICAL_NOTE.md` | Editable source of this note. |
| `scripts/build-note.sh`, `docs/note.css` | Generate and style the standalone HTML note using Pandoc. |
