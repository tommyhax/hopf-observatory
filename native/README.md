# Native Hopf renderer

A C++17 CPU renderer with direct algebraic ray intersections, persistent worker
threads and optional SDL3 image display. This is a standalone prototype; the
production web application still uses its existing GPU renderer.

The complete-frame comparison is in
[the benchmark report](../research/diagnostics/native-renderer/README.md).
On the tested M3 Pro, the current GPU renderer is substantially faster.

## Build and render

Requires CMake, Node.js (to generate the shared optical code), a C++17 compiler
and Boost headers. SDL3 is optional; without it the renderer still writes
complete images. These dependencies were already installed on the test Mac.

From the repository root on that Mac:

```sh
cmake -S native -B native/build -DCMAKE_BUILD_TYPE=Release -DCMAKE_PREFIX_PATH=/opt/homebrew
cmake --build native/build -j 4
node native/render.mjs --scene=0 --width=1280 --height=720 --output=/tmp/hopf-frame.ppm
```

Add `--view` to display the completed image in an SDL window; any key or closing
the window dismisses it. The viewer displays a rendered still, not an interactive
camera editor. Scenes 0–3 are solid, thin shell, three shells, and shells near
the pole. `--threads=1` selects one worker; otherwise hardware concurrency is
used. `--precision=113` or `--precision=256` starts at that precision.
`--strict` disables precision escalation for numerical diagnosis.

On other platforms, point CMake at the installed Boost and SDL3 packages.
`HOPF_NATIVE_BINARY` overrides the executable path used by the Node client,
including multi-configuration build paths on Windows. The C++ source avoids
Apple-specific APIs, but only macOS has been built and tested here. A separate
build without SDL was also tested. There are no packaging/installers yet.

## Implementation

- `include/hopf/quartic.hpp`: Ferrari/Cardano formulas and stable quadratic
  extraction, adapted from the earlier native algebraic experiment. The Boost
  attribution and license are in the header and `licenses/BOOST.txt`.
- `include/hopf/renderer.hpp`: native-double camera, geometry, image formation,
  and precision selection. Ordinary queries use hardware binary64. Uncertain
  sign/cancellation decisions rebuild the original query at 113 bits, then
  256 if needed. Those higher precisions use Boost software arithmetic. There
  is no iterative root search, Newton/Halley polishing or residual rejection.
- `generate-optics.mjs`: generates C++ optical functions directly from the
  production `web/shader.js`, translating scalar types, output references and
  vector syntax. This retains its normals, material priorities, offsets,
  Fresnel/Snell behavior, absorption, lighting and bounded reflection paths.
- `include/hopf/workers.hpp`: persistent C++ threads claim independent 16×16
  tiles. A frame completes only when every worker has finished.
- `main.cpp`: JSON-line command interface, RGBA8/PPM output, timing and optional
  SDL texture upload/display. Raw RGBA rows follow OpenGL's bottom-up ordering;
  PPM and the viewer are flipped for normal viewing.
- `client.mjs`: process driver for the renderer and verification adapters.

`native/scenes/benchmark.json` holds the four recorded scenes with uniforms
rounded to the same binary32 values sent to WebGL. Renderer arithmetic is
binary64; the optional wider arithmetic covers intersections. The scene format
uses the web renderer's uniform names. The procedural environments are shared;
the texture environment currently has the neutral test texture. Importing user
environment images and the full application interface have not been ported.

The default precision guards are practical conditioning checks, not interval
certificates. They handle the observed failures, with independent exact checks
on the affected queries; they do not establish a universal quartic guarantee.

## Direct API

```js
import { openNative } from './native/client.mjs';
const renderer = await openNative({ threads: 12 });
const result = await renderer.command({
  op: 'render', uniforms, width: 1280, height: 720,
  frames: 1, warmup: 0, output: '/tmp/frame.rgba', present: true,
});
await renderer.close();
```

`present: true` uploads the frame to an SDL render target and waits for a
one-pixel readback to complete it. It does not wait for display vsync. Reported
render, upload/completion times and precision-escalation counts exclude file
encoding and process communication. Each requested frame is recomputed.
