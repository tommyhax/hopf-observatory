# Third-party numerical baseline

`ferrari.glsl` adapts Jochen Schwarze's **Cubic and Quartic Roots**, *Graphics Gems* (1990), pp. 404–407, from [Roots3And4.c](https://github.com/erich666/GraphicsGems/blob/master/gems/Roots3And4.c). The port uses GLSL float32, clamps the cubic `acos` argument, handles exactly zero leading coefficients, and adds the renderer's centering, scaling, homogeneous-form chart polish and acceptance checks. It uses `EQN_EPS=1e-6` for float32 and is checked on known quadratic, cubic and quartic roots before each experiment. This is one conventional baseline, not the best available quartic solver.

The original Graphics Gems code is covered by its own permission notice, not this project's MIT licence. [Upstream licence](https://github.com/erich666/GraphicsGems/blob/master/LICENSE.md), accessed 21 November 2026:

> EULA: The Graphics Gems code is copyright-protected. In other words, you cannot claim the text of the code as your own and resell it. Using the code is permitted in any program, product, or library, non-commercial or commercial. Giving credit is not required, though is a nice gesture. The code comes as-is, and if there are any flaws or problems with any Gems code, nobody involved with Gems - authors, editors, publishers, or webmasters - are to be held responsible.
