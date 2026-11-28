---
title: "Glass Tori Through Infinity: Exact Ray Tracing of Rotating Hopf Tori"
author: "Tom Crosby"
---

<!-- Draft for Journal of Mathematics and the Arts (Research Article). See README.md in this folder for the journal's requirements and the submission checklist. -->

## Abstract

The Clifford torus and its relatives, the Hopf tori, are usually shown in three dimensions as polygon meshes or tubes. I describe how to ray trace their stereographic images interactively and without meshes, as glass solids and thin refracting shells, including the moments when a rotating torus passes through infinity and turns inside out. The method rests on two observations: the tori are the level sets of a single function on the three-sphere, and a straight ray in the image lifts to a circle on the sphere. Projecting that circle onto a coordinate plane turns each intersection into a crossing of an ellipse with a circle, so the intersections are roots of a quartic, and the degree cannot be lowered without giving up the conformal images. Extending a reduction of McCuan and Spietz from the Clifford torus to the whole family, I show that, up to a rigid rotation of the picture, every rotated image is determined by two numbers: the torus parameter and one entry of a projection matrix. A rotation in a single coordinate plane therefore reaches every shape, and the images form a two-parameter map. I present that map, a gallery, and an interactive web application.

**Keywords:** Hopf fibration; Clifford torus; stereographic projection; Dupin cyclide; ray tracing; four-dimensional visualization; refraction; mathematical art

## 1. Introduction

In the 1990s, as an undergraduate, I wanted to see what a torus in four-dimensional space would look like under stereographic projection. The object I had in mind was the product of two circles, $(\cos u,\sin u,\cos v,\sin v)$, which after scaling is the Clifford torus in the unit three-sphere. Its intrinsic geometry is as simple as geometry gets: it is flat. Its three-dimensional image is less simple, and when the torus is rotated in four dimensions before projection, the image bends, swells, runs off to infinity and comes back inside out.

I wanted to ray trace it.

There were already ways to draw such objects. A parametrized surface can be sampled, projected and rendered as a polygon mesh, and Banchoff's computer graphics of rotating Clifford tori made the phenomena above famous (Banchoff, 1990). Later visualizations of the Hopf fibration commonly draw its fibres as tubes, and Lyons (2003) gives an accessible account of the geometry behind them. Real-time shader demonstrations often march along each ray through a sampled distance field. Each of these approximates the surface. A mesh must also be clipped somewhere as the surface heads to infinity, and transparency exposes every facet.

Ray tracing asks a different question: where does a ray of light first meet the surface? For ordinary algebraic surfaces in space, the answer comes from substituting the ray into the surface's equation (Hanrahan, 1983). Here the surface lives on a sphere in four dimensions, and the projection bends the ray. The idea that eventually made the problem manageable was to stop treating the Clifford torus as an isolated object. It belongs to a family of tori that fills almost all of the three-sphere, so every point carries a label saying which torus it lies on. Finding an intersection becomes a matter of following that label along a ray. The ray tracing is exact in one specific sense: it works with the surface's own equation and normals, with no mesh, sampling or clipping. The arithmetic is still finite precision, and Section 5 describes where that matters.

This paper describes the geometry behind that idea and what it produces. Section 2 sets up the family and its images. Section 3 lifts a ray to the three-sphere, where it becomes a circle, and shows that the intersections are roots of a quartic, using a planar picture in which each torus is a circle and the ray is an ellipse. Section 4 turns to rotations and proves that the images are classified, up to a rigid motion, by two numbers. Section 5 explains how the equations become glass. Section 6 presents the images, organized by those two numbers, and discusses the choices behind them. The implementation, Hopf Observatory, runs in a web browser; its numerical methods and validation are described separately (Crosby, 2026).

Offline ray tracers such as POV-Ray can render any single quartic surface whose equation is supplied. What this work adds is a way of deriving those equations directly from the four-dimensional geometry, for every rotation and every member of the family at once; a rendering method that handles solids, angularly thin shells and surfaces through infinity together; and enough speed to explore the family interactively.

*Figure 1. Three nested Hopf tori after a rotation in four dimensions, rendered as tinted glass shells. [Hero render, full width.]*

## 2. A coordinate made of tori

Write points of the unit three-sphere as
$$
S^3=\{(x,y,z,w)\in\mathbb R^4 : x^2+y^2+z^2+w^2=1\},
$$
and consider
$$
X(t,u,v)=(\cos t\cos u,\ \cos t\sin u,\ \sin t\cos v,\ \sin t\sin v),
\qquad 0\le t\le\pi/2,\quad u,v\in[0,2\pi).
$$

For fixed $t$ strictly between $0$ and $\pi/2$, the first two coordinates trace a circle of radius $\cos t$ and the last two a circle of radius $\sin t$, so the image is the torus
$$
T_t=S^1(\cos t)\times S^1(\sin t).
$$
Each $T_t$ is flat, since its induced metric is that of a product of circles. At $t=\pi/4$ the radii are equal; this is the Clifford torus, a square flat torus, and the only member of the family that is a minimal surface in $S^3$. As $t\to0$ the second circle shrinks and $T_t$ collapses onto the great circle $C_0=\{z=w=0\}$; as $t\to\pi/2$ it collapses onto $C_1=\{x=y=0\}$.

Together the tori $T_t$ fill $S^3$ apart from $C_0$ and $C_1$, and every other point lies on exactly one of them. The parameter $t$ therefore acts like a radial coordinate whose level sets are tori rather than spheres, and it is read off by a single equation:
$$
x^2+y^2=\cos^2t. \tag{1}
$$
Equation (1) is the basis of everything that follows. To decide whether a point of the image lies on a chosen torus, I lift it to the three-sphere and check its label.

The family also has a classical interpretation. Under the Hopf map $S^3\to S^2$ (Hopf, 1931), each $T_t$ is the preimage of a circle of latitude, so these are Hopf tori in Pinkall's sense of preimages of closed curves (Pinkall, 1985). The circles $C_0$ and $C_1$ are fibres, and they link.

Let $N=(0,0,0,1)$ and let $\sigma(x,y,z,w)=(x,y,z)/(1-w)$ be stereographic projection from $N$. Its inverse is
$$
\sigma^{-1}(p)=\frac{V(p)}{D(p)},\qquad V(p)=\bigl(2p,\ \lVert p\rVert^2-1\bigr),\qquad D(p)=1+\lVert p\rVert^2. \tag{2}
$$

**Proposition 1.** *With $\rho=\sqrt{x^2+y^2}$, the image $\sigma(T_t)$ is the ring torus*
$$
(\rho-\sec t)^2+z^2=\tan^2t,
$$
*with major radius $\sec t$ and minor radius $\tan t$.*

*Proof.* By (2), a point $p=(x,y,z)$ lifts into $T_t$ exactly when $4\rho^2/D^2=\cos^2t$, that is, $2\rho=\cos t\,(1+\rho^2+z^2)$. Rearranging gives $\rho^2-2\rho\sec t+1+z^2=0$, and completing the square gives $(\rho-\sec t)^2+z^2=\sec^2t-1=\tan^2t$. $\square$

The radii satisfy $\sec^2t-\tan^2t=1$ for every $t$. As $t\to0$ the tube becomes infinitely thin around the unit circle $\sigma(C_0)$. As $t\to\pi/2$ the inner wall, at distance $\sec t-\tan t$ from the axis, closes in on the $z$-axis $\sigma(C_1)$ while the outer wall runs off to infinity. The two ends of the family are the two linked circles, seen in the image as a circle threaded by a line.

*Figure 2. The aligned family $\sigma(T_t)$ for several values of $t$, cut away to show the nesting. [New render.]*

## 3. A ray becomes a circle

A camera ray is a half-line $p(s)=o+sd$, $s\ge0$. Every point of $\mathbb R^3$ lifts by (2) to a point of $S^3\setminus\{N\}$, so the lifted ray already lies on the sphere. Unlike ray tracing a sphere in space, there is no step that intersects the ray with $S^3$. The question is where the lifted ray meets a chosen torus.

**Proposition 2.** *The lift of a line in $\mathbb R^3$, together with $N$, is a circle in $S^3$.*

*Proof.* Choose independent vectors $e_1,e_2$ perpendicular to $d$. The line is the set of $p$ with $e_i\cdot p=e_i\cdot o$. Since $p=q_{1:3}/(1-q_4)$ for $q=\sigma^{-1}(p)$, its lift satisfies
$$
e_i\cdot q_{1:3}=(e_i\cdot o)(1-q_4),\qquad i=1,2.
$$
These are two independent affine hyperplanes of $\mathbb R^4$ through $N$. Their intersection is an affine plane through $N$, which meets $S^3$ in a circle. $\square$

This is the familiar fact that stereographic projection carries circles on the sphere to circles or lines, with lines coming from circles through the pole. Figure 3 shows a ray and its lift in a three-dimensional section.

**Proposition 3.** *Let $c=\cos^2t$ and let $P=\mathrm{diag}(1,1,0,0)$. The ray $p(s)$ meets $\sigma(T_t)$ at parameter $s$ exactly when*
$$
f(s)=V(p(s))^{T}(P-cI)\,V(p(s))=0, \tag{3}
$$
*and $f$ is a polynomial in $s$ of degree at most four.*

*Proof.* A point $q$ of $S^3$ satisfies (1) exactly when $q^TPq=c=c\,q^Tq$, that is, $q^T(P-cI)q=0$. Substituting $q=V/D$ and multiplying by $D^2>0$ gives (3). The first three components of $V(p(s))$ are linear in $s$ and the fourth is quadratic, so $f$ has degree at most four. $\square$

Figure 4 gives a picture of why four is the right number. Let $\Pi$ be orthogonal projection of $\mathbb R^4$ onto the $xy$-plane. Equation (1) says that $q$ lies on $T_t$ when $\lVert\Pi q\rVert=\cos t$: in the $xy$-plane, every torus is simply the circle of radius $\cos t$ about the origin. Meanwhile the lifted ray is a circle in a plane of $\mathbb R^4$, and a linear map sends a planar circle to an ellipse (possibly flattened to a segment).

**Proposition 4.** *Let $E$ be the image under $\Pi$ of the lifted circle of a line. The line meets $\sigma(T_t)$ at the points lifting to $E\cap\{\lVert\xi\rVert=\cos t\}$, of which there are at most four.*

*Proof.* The first statement restates (1). The lifted circle passes through $N$, so $E$ passes through $\Pi N=0$, which is not on the circle. The ellipse and the circle are therefore distinct conics, which meet in at most four points, none of them coming from $N$. If $E$ degenerates to a segment, each point of the segment has at most two preimages, and a segment meets a circle at most twice. $\square$

All the tori share the same ellipse; they differ only in the radius of the circle. As $t$ varies, a single ray's intersections slide along one fixed ellipse, appearing and disappearing in pairs where a circle touches it.

The picture also shows when the problem is easier. If the line passes through the origin of $\mathbb R^3$, which is $\sigma(-N)$, its lift is a great circle, the ellipse is centred on the origin, and (3) becomes a quadratic in the tangent of the angle around the circle. There can still be four intersections, but square roots alone will find them. A general camera ray has no such symmetry.

Nor can a better choice of projection lower the degree while keeping these images. The surfaces $\sigma(T_t)$ are Dupin cyclides, which are quartic surfaces (Banchoff, 1990), and a line can cross one four times. By Liouville's theorem, the conformal maps from $S^3$ to $\mathbb R^3$ are stereographic projections followed by Möbius transformations; by Beltrami's theorem, the maps that send great circles to straight lines are central projections up to projective transformation, and none of these is conformal. A central (gnomonic) projection would turn the tori into quadrics with quadratic intersection equations, but it would also flatten and distort them, and it sees only half of the sphere. The round, inside-out shapes that made these tori worth drawing come with the quartic.

For rendering, (3) is a gift. Each pixel's ray yields one polynomial with five coefficients, built from a few dot products. Its smallest positive root is the visible surface point; nothing is sampled or stepped through.

*Figure 3. A straight ray and its circular lift to $S^3$, drawn in the section $z=0$. The forward ray traces an arc that approaches the pole $N$. [Existing figure: ray-lift.]*

*Figure 4. The lifted circle of one ray, projected to the $xy$-plane as an ellipse, with the circles $\lVert\xi\rVert=\cos t$ for several tori. Marked crossings are the ray's intersections with those tori. [New diagram.]*

## 4. Rotations, and the shapes they make

The rotations of the three-sphere and the symmetries they induce on the Clifford torus and its stereographic images are analysed by McCuan and Spietz (1998). Rotating a torus in four dimensions before projecting it changes nothing in the method. For $R\in SO(4)$, the rotated torus $RT_t$ is the set where $(R^Tq)^T\,\mathrm{diag}(1,1,0,0)\,(R^Tq)=\cos^2t$, so
$$
RT_t=\{q\in S^3 : q^TPq=\cos^2t\},\qquad P=R\,\mathrm{diag}(1,1,0,0)\,R^T, \tag{4}
$$
and (3) holds with this $P$. The matrix $P$ is orthogonal projection onto the plane $W=R(\text{$xy$-plane})$ that contains the rotated first circle.

Proposition 4 carries over, with $\Pi$ replaced by $P$, except when the pole lies on the rotated torus. The ellipse still passes through $PN$, but $PN$ is no longer the origin, and it lies on the circle $\lVert\xi\rVert=\cos t$ exactly when $N\in RT_t$, that is, when $P_{44}=\cos^2t$. Then $PN$ is a common point of the ellipse and the circle for every ray, but it lifts to $N$ rather than to a point of the line, and the ellipse may coincide with the circle. The algebra says the same: the coefficient of $s^4$ in $f$ is $(P_{44}-\cos^2t)\lVert d\rVert^4$. If $P_{44}\neq\cos^2t$, $f$ has degree four and a line meets the image in at most four points. If $P_{44}=\cos^2t$, it meets it in at most three, unless $f$ vanishes identically and the whole line lies on the surface. This does happen: after a rotation by $\pi/4$ in the $xw$-plane, the image of the Clifford torus contains the line through the origin in direction $(0,1,1)$. Such a line has no isolated crossing for a renderer to find. Corollary 1 below shows that $P_{44}=\cos^2t$ is exactly the configuration in which the image passes through infinity.

A rotation of $\mathbb R^4$ has six degrees of freedom, and the application offers one slider for each coordinate plane. By (4), however, the rotated torus depends only on the plane $W$: rotations within the plane of either defining circle slide the torus along itself. The planes through the origin of $\mathbb R^4$ form a four-dimensional space, so four degrees of freedom remain. Three more act on the picture only by turning it, as the next result shows.

Rotations of $\mathbb R^4$ that fix $N$ have the form $G=\mathrm{diag}(S,1)$ with $S\in SO(3)$, and for these
$$
\sigma(Gq)=\frac{S\,q_{1:3}}{1-q_4}=S\,\sigma(q). \tag{5}
$$
They turn the stereographic image rigidly. Let
$$
\kappa=N^TPN=P_{44}=\lVert PN\rVert^2\in[0,1],
$$
the squared cosine of the angle between the pole and the plane $W$. For $\theta\in[0,\pi/2]$, let $R_\theta$ be the rotation by $\theta$ in the $xw$-plane, which carries $(1,0,0,0)$ to $(\cos\theta,0,0,\sin\theta)$ and fixes $(0,1,0,0)$. Its plane is spanned by those two vectors, so it has $\kappa=\sin^2\theta$.

**Theorem 1.** *Let $R\in SO(4)$ have $\kappa=P_{44}$, and choose $\theta\in[0,\pi/2]$ with $\sin^2\theta=\kappa$. There is a rotation $S\in SO(3)$ such that*
$$
\sigma(RT_t)=S\,\sigma(R_\theta T_t)\qquad\text{for every }t\in(0,\pi/2).
$$
*Up to a rigid rotation of the picture, the image of the whole rotated family depends only on $\kappa$.*

Theorem 1 follows quickly from a decomposition of McCuan and Spietz (1998, Theorem 14): every rotation of $S^3$ factors as $R=R_0\,R^{xw}_\psi\,R^{zw}_\beta\,R^{xy}_\alpha$, where $R_0$ fixes $N$ and the other factors rotate within the indicated coordinate planes. In proving their symmetry theorem they use it to reduce $\sigma(RT_{\pi/4})$, the image of the rotated Clifford torus, to a rigid rotation of $\sigma(R^{xw}_\psi T_{\pi/4})$. The $xy$ and $zw$ factors preserve every $T_t$, so by (5) the same reduction holds for every $t$. The rotations $\mathrm{diag}(-1,1,-1,1)$, which fixes $N$, and $R^{xw}_\pi$ also preserve every $T_t$, and they reduce $\psi$ to $[0,\pi/2]$, where it plays the role of $\theta$. Their proof chooses $\psi$ with $\sin^2\psi=R_{41}^2+R_{42}^2$, which is $P_{44}$, so the invariant $\kappa$ is already implicit there. The proof below takes a different route, through the projector, because it shows what $\kappa$ means geometrically.

*Proof.* By (4) and (5), it suffices to find $G=\mathrm{diag}(S,1)$ carrying the plane $W_\theta$ of $R_\theta$ to the plane $W$ of $R$. Then $G$ maps each torus of the first family onto the torus with the same $t$ in the second, and $\sigma$ turns $G$ into $S$.

Write $\mathbb R^3=N^\perp$. Suppose first that $0<\kappa<1$. Then $PN\neq0$; put $w_1=PN/\lVert PN\rVert$, a unit vector in $W$. Since $N\cdot w_1=\lVert PN\rVert=\sqrt\kappa$, we can write $w_1=\sqrt\kappa\,N+\sqrt{1-\kappa}\,a$ with $a$ a unit vector in $\mathbb R^3$. Let $w_2$ be a unit vector in $W$ orthogonal to $w_1$. Then $N\cdot w_2=(PN)\cdot w_2=\lVert PN\rVert\,w_1\cdot w_2=0$, so $w_2\in\mathbb R^3$. Also $0=w_1\cdot w_2=\sqrt{1-\kappa}\,a\cdot w_2$, so $a\perp w_2$. Thus
$$
W=\operatorname{span}\bigl(\sqrt\kappa\,N+\sqrt{1-\kappa}\,a,\ w_2\bigr)
$$
with $(a,w_2)$ orthonormal in $\mathbb R^3$. The plane $W_\theta$ has the same form, with $(a,w_2)$ the first two standard basis vectors $(e_1,e_2)$. Let $S\in SO(3)$ send $e_1\mapsto a$ and $e_2\mapsto w_2$; it exists because $SO(3)$ acts transitively on orthonormal pairs. Then $G=\mathrm{diag}(S,1)$ fixes $N$ and carries $W_\theta$ to $W$.

If $\kappa=1$, then $N\in W$ and $W=\operatorname{span}(N,w_2)$ with $w_2$ a unit vector in $\mathbb R^3$; take $S$ with $Se_2=w_2$. If $\kappa=0$, then $W\subset\mathbb R^3$; take $S$ carrying the $e_1e_2$-plane to $W$. $\square$

The projector argument is elementary, and I include it because $\kappa$ organizes everything that follows. Its practical meaning is striking: one slider, the $xw$ rotation, reaches every shape the six sliders can produce, and the others change only the direction from which it is seen. (The lighting does not rotate with the surface, so the pictures differ, but the geometry does not.)

The endpoints of the $\kappa$-range are easy to identify. At $\kappa=0$ the family is aligned, and Proposition 1 applies. At $\kappa=1$ the plane $W$ contains $N$. Taking $W=\operatorname{span}(N,e_2)$ in Theorem 1, $T_t$ becomes $\{w^2+y^2=\cos^2t\}=\{x^2+z^2=\sin^2t\}$, which is the aligned torus with parameter $\pi/2-t$, turned in $\mathbb R^3$.

**Corollary 1.** *As $\kappa$ increases from $0$ to $1$, the image of $T_t$ changes, up to a rigid rotation, from the ring torus with radii $(\sec t,\tan t)$ to the ring torus with radii $(\csc t,\cot t)$. It passes through infinity exactly once, at $\kappa=\cos^2t$. The solid region $\{q^TPq>\cos^2t\}$, a bounded tube at $\kappa=0$, contains a neighbourhood of infinity for $\kappa>\cos^2t$.*

*Proof.* The endpoints were identified above. $N$ lies on $RT_t$ exactly when $N^TPN=\cos^2t$, which is the only configuration in which the image is unbounded. The pole lies inside the solid region exactly when $\kappa>\cos^2t$, and points near $N$ project to points near infinity. $\square$

This is the inside-out motion. Nothing singular happens in $S^3$: the torus remains smooth and compact, and only the projection, which cannot place $N$ at a finite point, makes the motion look abrupt. Theorem 1 says that this single passage, run for each $t$, is the whole story. Figure 5 lays it out as a map with $t$ on one axis and $\kappa$ on the other. The curve $\kappa=\cos^2t$ crossing the map separates the tori whose solid region is bounded from those whose solid region is unbounded, and along that curve the surfaces open to infinity.

*Figure 5. The map of shapes. Rows: $t=15^\circ,30^\circ,45^\circ,60^\circ,75^\circ$. Columns: $\kappa$ from $0$ to $1$. The curve $\kappa=\cos^2t$ marks passage through infinity. Every rotated image of every member of the family is, up to rotation, one of these. [New figure: grid of renders.]*

*Figure 6. Passage through the pole for the Clifford torus, under $xw$ rotations of $30^\circ$, $42^\circ$, $45^\circ$, $48^\circ$ and $60^\circ$ ($\kappa\approx0.25, 0.45, 0.50, 0.55, 0.75$). The middle surface is unbounded. [Existing pole-sequence figure, possibly re-rendered in glass.]*

## 5. From equations to glass

### Solids and shells

An equation describes a surface; refraction also needs to know which side is glass. The simplest choice is a solid torus, the region $q^TPq>\cos^2t$, which in the aligned image is the familiar filled tube. A second choice uses the coordinate $t$ itself. The shell
$$
\cos^2(t+\Delta t/2)<q^TPq<\cos^2(t-\Delta t/2)
$$
is the band of $S^3$ between two neighbouring tori, a set of constant angular thickness $\Delta t$ in the sphere. Its image is bounded by two nearby cyclides, each crossed separately by a passing ray. The shell can be as thin as one likes in the mathematics; the application goes down to $0.01^\circ$. Because the tori never meet in $S^3$, several shells nest without intersecting, and they stay nested under every rotation.

### Light in three dimensions

The geometry comes from four dimensions, but the light does not. Each ray travels in straight lines in the three-dimensional image, meets the nearest boundary, and reflects or refracts by Snell's law there, using the surface normal. The normal is the gradient of (3) viewed as a function of $p$:
$$
\nabla f=4\Bigl[(PV)_{1:3}+p\bigl((PV)_4-c\,D\bigr)\Bigr],
$$
exact at every point rather than interpolated across facets. The renderer is therefore a three-dimensional optical picture of four-dimensional geometry, not a simulation of light in $S^3$. In a companion experiment I also traced light along great circles inside $S^3$, which is a different and much less familiar-looking world. The projected view is the one that shows the shapes people recognize.

### Making it work

Two practical problems had to be solved. The first is infinity. Near the configurations of Corollary 1, a surface can be hit $10^9$ units away along a ray. The renderer covers each ray with two coordinates, one for the near part and a reciprocal one for the far part, so the polynomial always lives on a bounded interval and no artificial bounding sphere clips the scene.

The second is precision. Graphics hardware computes in single precision, and rays that nearly graze a surface are delicate: a pair of intersections can merge, vanish or appear. Against an exact reference, every such failure in my tests arose while building the polynomial's coefficients, not while solving it. Building the coefficients in higher precision removes them, at several times the cost, so the interactive default stays in single precision. In the scenes compared, images computed at the two precisions are visually indistinguishable. The details, including a comparison of iterative and closed-form quartic solvers, are in Crosby (2026).

The application runs in any browser with WebGL 2. One shader invocation per pixel builds and solves the quartics and follows the light through up to 24 interfaces, at interactive frame rates on a laptop.

## 6. Images

### The map of shapes

Figure 5 is the most useful single picture I know of for this family. Along its left edge the aligned ring tori grow from thin tubes around the unit circle to fat tori whose hole closes onto the axis. Along its right edge the same tori reappear with the roles of $t$ and $\pi/2-t$ exchanged. Between them the cyclides tilt, thicken on one side and thin on the other, until the curve $\kappa=\cos^2t$ is reached and the surface opens to infinity. Past that curve the glass that formed the tube is now the outside world, and the empty interior has become a solid tube of air inside glass that fills the rest of space.

### Through infinity

At $\kappa=\cos^2t$ the image is unbounded, and no finite camera can frame all of it. The frames in Figure 6 bracket that moment. A mesh would need a clipping boundary here, and its silhouette would betray where the mesh stopped. The ray-traced image has no edge: the surface simply leaves the frame and, at the next frame, returns.

### Nested glass

With three tori sharing one rotation (Figure 1), transparency shows how the layers sit inside one another, and tints keep them distinguishable where they overlap in the image. Refraction is the reason to use glass rather than translucency alone. Each boundary bends the background a little, so the curvature of every layer is visible in the distortion it causes, even where the layers' outlines coincide.

### Thin shells

At widths of a fraction of a degree, a shell looks like a soap film; Figure 7 uses a wider shell so that both walls are visible. Light crosses both walls almost undeflected, so the shell is visible mainly through reflection and through the small displacement of the background along its silhouette. Three nested thin shells give up to 24 crossings along a single ray, each of which the renderer finds separately.

### Materials and environment

The environment matters as much as the material. A uniform backdrop makes glass invisible, and a photographic one makes the geometry hard to read. The procedural studio used here has bright strips, a faint grid and coloured lights at known directions, chosen so that bending, reflection and total internal reflection each leave a recognizable trace. Chrome emphasizes curvature by reflecting the strips; ceramic shows the silhouette alone, which is useful for comparing shapes across the map.

### An instrument and a print

The interactive application and the still image serve different purposes. Interactively, the sliders let a viewer feel how a rotation in a plane they cannot see changes the shape they can see, and Theorem 1 explains why the experience is richer than its one-parameter geometry would suggest: each new view of the same shape still teaches something. A still image is a choice of moment, a point on the map where the geometry is legible and the composition works. The gallery that follows (Figures 8–10) records some of those choices.

*Figure 7. The Clifford torus as a solid and as a $3^\circ$ shell, with the same camera and material. [Existing solid-shell figure.]*

*Figures 8–10. Gallery: three tinted shells after rotation; chrome near $\kappa=\cos^2t$; a thin shell seen edge-on. [New renders.]*

## 7. Further directions

The method is not specific to Hopf tori. Any surface cut from $S^3$ by a quadric in $\mathbb R^4$, $q^TMq+b^Tq+k=0$, gives a quartic along a lifted ray after substituting $q=V/D$ and multiplying by $D^2$. These include many other cyclides, and the same renderer could show them with no change beyond the coefficients.

Theorem 1 also suggests a simpler interface: a single 'shape' dial for $\kappa$, with the camera responsible for everything else. Conversely, the rotations that leave the image's shape unchanged could be used deliberately in animation, turning the picture without changing it, so that the viewer's attention goes to the one parameter that matters.

The original aim was to see what these tori looked like. The method in this paper makes it possible to move among them, look through them, and watch them pass through infinity, under rotations that cannot be performed in three dimensions.

## Acknowledgements

[To be added.]

## Disclosure statement

The author reports there are no competing interests to declare.

## Funding

[State any funding, or: No funding was received for this work.]

## Declaration of generative AI use

[Draft for the author to confirm.] OpenAI Codex and Anthropic Claude, AI coding and writing assistants, were used to help implement the software, design and run numerical experiments, search the literature, and draft and revise this manuscript. The author conceived the geometric approach, directed the work, checked the mathematics and the results, and takes full responsibility for the content.

## Data availability statement

The source code of Hopf Observatory, the scene settings used for every figure, and the recorded test results are openly available at https://github.com/tommyhax/hopf-observatory. [Add the DOI of an archived release, for example from Zenodo, before submission.]

## Supplemental material

[Planned: a short video of the passage through infinity along a row of Figure 5, and a link to the interactive application.]

## References

Banchoff, T. F. (1990). *Beyond the third dimension: Geometry, computer graphics, and higher dimensions*. Scientific American Library.

Crosby, T. (2026). *Interactive ray tracing of stereographic Hopf tori* [Manuscript in preparation].

Hanrahan, P. (1983). Ray tracing algebraic surfaces. *Computer Graphics, 17*(3), 83–90. https://doi.org/10.1145/964967.801136

Hopf, H. (1931). Über die Abbildungen der dreidimensionalen Sphäre auf die Kugelfläche. *Mathematische Annalen, 104*, 637–665.

Lyons, D. W. (2003). An elementary introduction to the Hopf fibration. *Mathematics Magazine, 76*(2), 87–98.

McCuan, J., & Spietz, L. (1998). *Rotations of the three-sphere and symmetry of the Clifford torus* (arXiv:math/9810023). arXiv.

Pinkall, U. (1985). Hopf tori in $S^3$. *Inventiones Mathematicae, 81*(2), 379–386.
