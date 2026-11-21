# Three tori, materials and environments

Select a torus card to edit its parameter, solid/shell volume, shell width, material, tint, roughness, opacity and index. Checkboxes control visibility. All three share the six SO(4) rotations, so they remain members of the same Hopf family.

**Finish** offers tinted glass, clear crystal, chrome and ceramic. **Apply material to all three** copies the selected finish and its optical settings without changing geometry or visibility. Metallic finishes are opaque, so opacity and refractive-index controls are disabled for them. Materials follow their torus through the projection pole; chrome can become the exterior material. 

Every ray selects the nearest quartic intersection across all visible boundaries (up to six for three shells). Reflected rays also intersect the other tori. Media are classified by membership in the scalar intervals of `h = QᵀPQ`. In overlaps, the narrower interval takes precedence; equal widths use the higher-numbered slot. Thus an inner solid remains a distinct medium inside a larger solid, even when the projected inside/outside roles invert. Coincident boundaries update membership together. Boundaries between two regions with the same effective medium do not contribute an optical interface.

The three stored parameters are t = 25°, 45°, 65°. Initially only the middle torus is visible, and all three shell widths are 0.01°. Visibility checkboxes enable the others. A straight ray can cross all six walls 24 times. High quality permits 24 main-path interactions, Adaptive 16, and Fast 8. Higher budgets improve complicated glass views at a performance cost. Geometry still uses implicit quartic roots and analytic normals, without meshes or spatial ray marching.

Six procedural environments are available: midnight studio, daylight studio, coordinate grid, softbox studio, sunset horizon and window gallery. Rotation and exposure apply to background and reflections. **Load panorama** accepts local equirectangular JPEG, PNG and WebP images, ideally 2:1. Images stay in the tab, are resized to at most 4096 pixels per dimension, and use mipmaps for rough reflections. This is LDR panorama support, not an HDR/RGBE/EXR decoder.

Chrome use tinted Schlick Fresnel reflectance as a visual approximation, not measured spectral conductor indices. Roughness broadens environment reflections; geometric secondary rays remain perfect reflection directions. It is not a complete microfacet path tracer. Glass uses Snell-law directions and dielectric Fresnel weights between the actual effective media. The first dielectric reflection branch has four further interactions; later secondary branches resolve to the environment. Finite absorption and path budgets retain the limits described in the technical note.

Run `npm test` for 24 CPU tests. [GPU validation](GPU_VALIDATION.md) records native and WebGL results, methods and numerical limits.

## Thin shells

The minimum width is **0.01°**. The slider uses 0.01° steps; the **Exact width (degrees)** field makes small values easy to enter. Width readouts use two decimal places, and the boundary parameters use three. **Apply shell width to all three** copies the selected width to all slots, including hidden tori and the stored shell setting of a solid torus. It preserves their parameters, volume modes, materials and visibility. If necessary, all three receive the same smaller width to respect the most restrictive parameter endpoint.

The shader's origin offset and positive-root cutoff adapt to the closest distinct angular boundary spacing among visible tori. The offset scale is `clamp(0.05 × gapRadians, 1e-6, 4e-4)`, multiplied by `max(1, |p|)` at the hit. The root cutoff is half that scale at the ray origin. Offsets decrease with boundary spacing until the precision floor is reached. A float32 precision floor remains; this is not support for zero-thickness surfaces or arbitrarily close boundaries.

Regression checks compare analytic axis intersections with repeated CPU intersection queries using float32-rounded ray origins and the renderer's cutoffs. At a width of 0.01°, the offsets retain all eight crossings for t = 1°, 5°, 25°, 45°, 65°, 85°, 89°, and all 24 crossings for the three-torus family. Hardware checks retain all eight and 24 crossings. Instrumenting the production transport verifies both entry and exit indices, analytic normals and Snell directions for 36 paths, including oblique three-shell paths and exact pole boundaries. The 24-interaction budget still applies; a shell containing the projection pole can remain the final medium all the way to infinity, without a finite exit.

