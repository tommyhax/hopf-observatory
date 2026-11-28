# Glass Tori Through Infinity: Ray Tracing the Rotating Hopf Family

## Abstract

The Clifford torus and its relatives, the Hopf tori, are usually visualized in three dimensions using polygon meshes or tubular approximations. I describe a method for ray tracing their stereographic images directly, producing interactive renderings of solid glass tori and thin refracting shells, including configurations in which the surfaces extend through infinity and turn inside out. The method follows from two observations: the tori are level sets of a simple function on the three-sphere, and a straight ray in three-dimensional space lifts to a circle on that sphere. Intersecting the circle with a torus reduces to solving a quartic equation. I develop the geometry, explain the origin of the quartic, and present images and an interactive application for exploring these surfaces.

## 1. An Old Idea

In the 1990s, as an undergraduate, I became interested in what a torus in four-dimensional space would look like under stereographic projection. The object I had in mind was the Clifford torus, a flat surface embedded in the unit three-sphere. Its intrinsic geometry is simple, but its three-dimensional image is less so.

I wanted to ray trace it.

There were already ways to visualize such objects. A parametrized surface could be projected and rendered as a polygon mesh, and sufficiently dense meshes could produce convincing pictures. But I wanted to work directly with the surface, without replacing it with triangles. In particular, I wanted to see what happened when the torus was rotated in four dimensions, when it passed through the point of projection, and when it was made transparent or refractive.

The difficulty was finding intersections. Ordinary ray tracing asks where a straight line meets a surface in three-dimensional space. Here the surface lives on a sphere in four dimensions, and stereographic projection changes the geometry of the ray.

What eventually made the problem manageable was to stop treating the Clifford torus as an isolated object. It belongs to a continuous family of tori that fills almost all of the three-sphere. Each point can be assigned a parameter identifying the torus on which it lies. Finding an intersection then becomes a matter of following that parameter along a ray.

The resulting calculation is algebraic, and surprisingly compact. A camera ray lifts to a circle on the three-sphere, and its intersections with a chosen torus are roots of a quartic polynomial.

The method makes it possible to render the projected surfaces directly, including their silhouettes and refractive behaviour, without constructing a mesh. It also makes visible some of the less intuitive consequences of four-dimensional rotation.

*Figure 1. Three nested Hopf tori after rotation in four dimensions, rendered as refractive glass.*

## 2. A Coordinate Made of Tori

Consider the unit three-sphere in four-dimensional Euclidean space,

$$
S^3=\{(x,y,z,w) : x^2+y^2+z^2+w^2=1\}.
$$

A useful parametrization is

$$
X(t,u,v)=
\begin{pmatrix}
\cos t\cos u\\
\cos t\sin u\\
\sin t\cos v\\
\sin t\sin v
\end{pmatrix},
$$

where $0\leq t\leq\pi/2$, and $u,v$ each run from $0$ to $2\pi$.

For a fixed value of $t$ strictly between the endpoints, the first two coordinates describe a circle of radius $\cos t$, and the last two describe a circle of radius $\sin t$. Their product is a torus,

$$
T_t=S^1(\cos t)\times S^1(\sin t).
$$

Each of these tori is flat: its induced metric is that of a product of two circles. At $t=\pi/4$, the two circles have equal radius. This is the Clifford torus, a square flat torus and the only minimal surface in the family. As $t$ approaches either endpoint, one of the circles shrinks to a point and the torus collapses to a circle.

Together, these tori fill the three-sphere, apart from the two limiting circles. Every other point belongs to exactly one member of the family.

This gives the three-sphere something like a radial coordinate, except that its level surfaces are tori rather than spheres. The value of $t$ is determined by

$$
x^2+y^2=\cos^2t.
$$

This simple equation is the basis of the ray tracer. Rather than determine whether a point lies on a complicated projected surface, I can lift it to the three-sphere and test whether its torus coordinate has the required value.

The family also has a natural interpretation through the Hopf fibration. Under the Hopf map from $S^3$ to $S^2$, each of these tori maps to a circle of latitude. They are therefore Hopf tori in Pinkall's sense: preimages of closed curves on $S^2$ [Pinkall 1985].

For the unrotated family, stereographic projection produces familiar ring tori. With the projection pole at $(0,0,0,1)$, the major and minor radii are

$$
R=\sec t,\qquad r=\tan t.
$$

The identity $R^2-r^2=1$ follows immediately. As $t$ increases, the torus grows while maintaining this relationship. At the two ends of the family, the torus collapses onto the images of the two limiting circles. As $t\to0$ it shrinks onto the unit circle in the $xy$-plane. As $t\to\pi/2$ its inner wall closes in on the $z$-axis while its outer edge runs off to infinity. The unit circle and the $z$-axis link each other, just as the two limiting circles do in $S^3$.

The familiar ring torus is therefore only one view of a more general four-dimensional object. Rotating the original surface before projecting it produces a much wider range of shapes.

*Figure 2. Several members of the aligned Hopf family, shown in cutaway. Their changing radii correspond to a continuous progression through the torus coordinate $t$.*

## 3. A Ray Becomes a Circle

The central problem is to find where a camera ray intersects one of these projected tori.

Let $p=(p_1,p_2,p_3)$ be a point in ordinary three-dimensional space. Inverse stereographic projection maps it to the unit three-sphere:

$$
q(p)=\frac{1}{1+\lVert p\rVert^2}
\begin{pmatrix}
2p_1\\
2p_2\\
2p_3\\
\lVert p\rVert^2-1
\end{pmatrix}.
$$

Every finite point in three-dimensional space maps to a point of $S^3$ other than the projection pole, which corresponds to infinity. There is no separate sphere-intersection calculation to perform.

Now consider a camera ray,

$$
p(s)=o+sd,
$$

where $o$ is its origin and $d$ its direction.

A straight line in three-dimensional space does not lift to a straight line in four dimensions. Its inverse stereographic image lies on a circle passing through the projection pole. This is a standard property of stereographic projection: circles and lines correspond to circles on the sphere, with lines arising from circles that contain the pole.

So a ray-tracing problem in three dimensions becomes a problem of intersecting a circle with a torus in four dimensions.

The intersection condition is particularly simple. For the unrotated family, a point $q=(x,y,z,w)$ lies on $T_t$ when

$$
x^2+y^2=\cos^2t.
$$

Write

$$
V(s)=
\begin{pmatrix}
2p(s)\\
\lVert p(s)\rVert^2-1
\end{pmatrix},
\qquad
D(s)=1+\lVert p(s)\rVert^2,
$$

so that $q=V/D$.

Let $P$ be the matrix that selects the first two coordinates, and put $c=\cos^2t$. Since $q$ lies on the unit sphere, the torus condition can be written

$$
q^T(P-cI)q=0.
$$

Clearing the denominator gives

$$
\boxed{V(s)^T(P-cI)V(s)=0.}
$$

Each component of $p(s)$ is linear in $s$. The first three components of $V(s)$ are therefore linear, and the fourth is quadratic. The resulting equation is a polynomial of degree at most four.

Its real roots give the intersections of the ray with the projected torus. For a camera ray, only roots in the forward direction are relevant.

There is a useful geometric way to understand why the degree is four.

The lifted ray is a circle in four-dimensional space. Project that circle orthogonally onto the plane of its first two coordinates. In general, its image is an ellipse. Meanwhile, each Hopf torus is defined by a fixed distance from the origin in that plane:

$$
x^2+y^2=\cos^2t.
$$

The intersection problem has become one of finding where an ellipse crosses a circle centred at the origin. There can be four crossings, corresponding to four intersections of the original ray with the torus. Different tori are concentric circles in this picture, all crossing the same ellipse.

This picture also explains why a quadratic solver is insufficient in general. The fourth degree is not merely an artefact of clearing denominators. A generic projected torus is a quartic surface, and some rays genuinely have four intersections.

There is one special case. A ray passing through the origin of stereographic space lifts to a great circle, and its ellipse is centred on the origin. The equation then becomes a quadratic in the tangent of the angle around that circle. There can still be four intersections, but square roots alone are enough to find them. An arbitrary camera ray has no such simplification.

The quartic is thus the natural algebraic description of the problem.

It is also an attractive result computationally. The ray tracer does not need to march along a ray, sample a distance field, or refine intersections against a polygon mesh. It constructs a polynomial, finds its relevant real roots, and obtains the surface points directly.

*Figure 3. A camera ray lifts to a circle on $S^3$. Projecting this circle onto the first coordinate plane produces an ellipse. Its intersections with concentric circles identify the Hopf tori crossed by the ray.*

## 4. Rotating in Four Dimensions

The aligned family is useful for understanding the geometry, but the more interesting images appear when the tori are rotated before projection.

A rotation in four dimensions is represented by an orthogonal matrix $R$ with determinant one. Rather than rotate the points of a torus explicitly, I rotate the quadratic form that defines it.

The coordinate projector becomes

$$
P=R
\begin{pmatrix}
1&0&0&0\\
0&1&0&0\\
0&0&0&0\\
0&0&0&0
\end{pmatrix}
R^T.
$$

The same intersection equation,

$$
V^T(P-\cos^2t\,I)V=0,
$$

continues to apply.

A general rotation in four dimensions has six degrees of freedom, but only four affect a torus in this family. Rotations within either of its defining circle planes merely slide the surface along itself.

Three of the remaining four do even less to the picture. A rotation that fixes the projection pole acts on three-dimensional space as an ordinary rigid rotation, because stereographic projection commutes with it; it only turns the image. Such rotations can carry any plane to any other plane making the same angle with the pole. So, up to turning the picture, the image of a rotated torus depends on just two numbers: its parameter $t$, and the entry $P_{44}$, which measures how close the pole lies to the plane of the first circle. A rotation in the $xw$-plane alone sweeps $P_{44}$ from $0$ to $1$. Every other orientation shows the same shapes from a different direction. McCuan and Spietz reach this reduction for the Clifford torus by factoring an arbitrary rotation of the three-sphere [McCuan and Spietz 1998, Theorem 14]; the same factorization works for every member of the family.

That relationship with the pole produces one of the most striking effects in the renderer.

The projection pole is the point $(0,0,0,1)$. A rotated torus passes through it precisely when

$$
P_{44}=\cos^2t.
$$

At this configuration, part of the projected surface extends to infinity. As the rotation continues, the surface reappears from infinity with its bounded and unbounded regions exchanged.

In the three-dimensional image, the torus appears to turn inside out.

Nothing singular has happened to the torus in four dimensions. It remains a smooth, compact surface on $S^3$. The dramatic change is a consequence of the projection, which cannot represent the pole as a finite point.

This is one reason to render the surface directly. A finite polygon mesh must somehow approximate or clip the part of the surface approaching infinity. The algebraic representation has no such geometric boundary.

*Figure 4. A sequence of rotations carrying a Hopf torus through the stereographic projection pole. The surface becomes unbounded and then returns in an inverted configuration.*

## 5. Glass, Shells, and Light

Once the intersections can be found, the tori can be rendered with the same kinds of materials used for ordinary three-dimensional objects.

The simplest interpretation is a solid torus. A ray entering the surface changes direction according to the refractive indices of the surrounding medium and the material, and changes direction again when it exits. Surface normals come from the gradient of the implicit equation, rather than from interpolated polygon normals.

A second interpretation uses the torus coordinate to define a thin shell. Instead of rendering a single level surface $t=t_0$, I render the region

$$
t_0-\frac{\Delta t}{2}
\leq t\leq
t_0+\frac{\Delta t}{2}.
$$

This gives two closely spaced surfaces, each with its own entry and exit intersections. The shell can be made arbitrarily thin in the mathematical model; the implementation supports angular thicknesses down to $0.01^\circ$.

These shells resemble soap films or thin glass vessels. They also expose details that are difficult to see in opaque renderings. Refraction bends the background through the curved surface, while transparency allows the geometry of nested tori to remain visible.

Several surfaces can be rendered together. Because the members of the Hopf family do not intersect in $S^3$, they provide a natural arrangement of nested layers. Rotating the entire family preserves this relationship, even when the projected shapes become difficult to recognize.

The materials are not merely decorative. Glass reveals the interior and exterior surfaces. Reflective materials emphasize curvature. Different tints help distinguish layers that occupy overlapping regions of the image.

The lighting takes place in ordinary three-dimensional space. It is the geometry of the surfaces, not the propagation of light, that is inherited from four dimensions.

This distinction matters: the renderer is a three-dimensional optical visualization of four-dimensional geometry, not a simulation of light moving through four-dimensional space.

*Figure 5. The same Hopf torus rendered as a solid refractive body and as a thin shell.*

*Figure 6. Three nested Hopf shells with different glass tints, showing their overlapping surfaces and multiple refractions.*

## 6. Making It Work

The intersection equation is exact in the algebraic sense, but evaluating it on a GPU introduces the usual problems of floating-point arithmetic.

The difficult cases are rays that nearly graze a surface. Near a tangency, two roots approach one another, and small coefficient errors can cause them to merge or disappear. In testing, every remaining failure was traced to the construction of the quartic's coefficients, not to the root-finding method. Building the coefficients in higher precision removes these failures, but at several times the cost, so the interactive application still uses single precision by default.

The implementation also has to handle surfaces that pass through the projection pole. These are not clipped against an artificial bounding sphere. Instead, the renderer uses coordinate charts that allow it to represent the relevant intersections even when the surface is unbounded in ordinary stereographic coordinates.

The current implementation runs interactively in a web browser. Its numerical methods, validation, and performance are treated separately in the accompanying technical work. Here the important point is that direct algebraic intersection makes these images practical without a polygonal approximation to the surface.

The interactive application, *Hopf Observatory*, allows the torus parameter, four-dimensional rotation, material, and shell thickness to be changed while the scene is rendered.

## 7. Gallery

The following images illustrate different aspects of the geometry. They were produced from the same underlying family of tori; the variations come from their torus coordinates, four-dimensional orientations, and materials.

**The Clifford torus.** At $t=\pi/4$, both defining circles have radius $1/\sqrt2$. In the aligned projection this gives a ring torus with major radius $\sqrt2$ and minor radius $1$. Although the surface is intrinsically flat, its stereographic image has the familiar curvature of a ring torus.

**Approaching a core circle.** As $t$ approaches zero, one of the defining circles shrinks and the torus collapses towards a great circle of $S^3$. The projected surface becomes increasingly slender. At the opposite end of the family, the tube's inner wall closes in on the $z$-axis while its outer edge grows without bound.

**Through infinity.** A sequence of rotations carries a torus across the projection pole. The image expands into an unbounded surface and subsequently contracts into a different bounded configuration. The smooth motion in four dimensions contrasts with the abrupt change of apparent topology in ordinary three-dimensional space.

**Nested glass.** Several values of $t$ produce disjoint surfaces in four dimensions and nested surfaces in the stereographic image. Transparency and refraction expose the relationship between them, particularly after rotation obscures their original ring-torus shapes.

**Reflections.** Chrome and other reflective materials reveal the shape of the surface through reflected environmental detail. They are especially useful near regions of strong curvature, where a simple diffuse material can make a surface appear deceptively flat.

**Thin shells.** Small intervals in the torus coordinate produce layered refractive surfaces. Their near-coincident boundaries emphasize the precision needed to resolve multiple intersections along a ray.

Together, the images illustrate a single geometric construction under different viewing conditions. The renderer does not switch between separate models of bounded and unbounded surfaces, or between ordinary tori and their rotated counterparts. All are instances of the same equation.

## 8. Further Directions

The method is not restricted to Hopf tori. Any surface cut from $S^3$ by a quadric in $\mathbb R^4$, not only one defined by a quadratic form, gives a polynomial of degree at most four along a lifted camera ray. This provides a larger class of four-dimensional surfaces whose stereographic images can be rendered directly.

There is also considerable scope for animation. Continuous four-dimensional rotations produce transformations that have no close analogue in ordinary three-dimensional motion, particularly when surfaces pass through infinity.

The interactive application provides a way to explore these transformations, while still images and prints offer a different opportunity: to select moments when the geometry produces forms that are both visually compelling and mathematically revealing.

The original aim was simply to see what these tori looked like. The resulting method makes it possible to move among them, look through them, and watch them change under rotations that cannot be performed in three dimensions.

---

## References

*To be formatted for Bridges.*

- Banchoff, T. F. *Beyond the Third Dimension*. Scientific American Library, 1990.
- Hanrahan, P. "Ray Tracing Algebraic Surfaces." *Computer Graphics* 17(3), 1983, pp. 83–90.
- Lyons, D. W. "An Elementary Introduction to the Hopf Fibration." *Mathematics Magazine* 76(2), 2003, pp. 87–98.
- McCuan, J., and Spietz, L. "Rotations of the Three-Sphere and Symmetry of the Clifford Torus." arXiv:math/9810023, 1998.
- Pinkall, U. "Hopf Tori in $S^3$." *Inventiones Mathematicae* 81, 1985, pp. 379–386.
- Crosby, T. "Interactive Ray Tracing of Stereographic Hopf Tori." JCGT review draft, 2026.
- *Hopf Observatory*. [https://github.com/tommyhax/hopf-observatory](https://github.com/tommyhax/hopf-observatory)
