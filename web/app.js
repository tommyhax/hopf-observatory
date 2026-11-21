import { projector, shellLevels } from './math.js';
import { vertex, fragment } from './shader.js';
import {
  MATERIALS,
  applyMaterial,
  scenePreset,
  objectLevels,
  linearColor,
  rayBiasScale,
  applyShellWidthToAll,
} from './scene.js';
const $ = (id) => document.getElementById(id),
  rad = Math.PI / 180;
// Initial UI state is separate from the all-visible numerical test fixtures.
function defaultObjects() {
  const objects = scenePreset('glass');
  objects.forEach((o, i) => {
    o.enabled = i === 1;
    o.shellWidth = 0.01;
  });
  // Use the glass optics while preserving the family's seafoam/lilac/amber tints.
  const tint = objects[1].color;
  applyMaterial(objects[1], 'glass');
  objects[1].color = tint;
  return objects;
}
const canvas = $('canvas'),
  state = {
    angles: [0, 0, 0, 0, 0, 0],
    objects: defaultObjects(),
    active: 1,
    playing: false,
    plane: 2,
    speed: 12,
    environment: 3,
    envRotation: 0,
    exposure: 0,
    mode: 0,
    quality: 'adaptive',
  };
const active = () => state.objects[state.active];
let environmentTexture,
  environmentImage = null,
  mapMaxLod = 0;
const camera = { yaw: 0.42, pitch: 0.43, distance: 6.8 };
let gl,
  program,
  uniforms = {},
  dirty = true,
  last = performance.now(),
  fpsStart = last,
  frames = 0,
  scale = 0.65,
  slowFrames = 0,
  drag = null,
  pinch = null,
  animationId;
const pointerMap = new Map();
const labels = ['XY', 'XZ', 'XW', 'YZ', 'YW', 'ZW'];
labels.forEach((label, i) => {
  const div = document.createElement('div');
  div.className = label.includes('W') ? 'extra' : '';
  div.innerHTML = `<div class="range-label"><label for="angle-${i}">${label}</label><output id="angle-${i}-value" for="angle-${i}">0°</output></div><input type="range" id="angle-${i}" min="-180" max="180" value="0" step="0.1" aria-label="${label} rotation in degrees">`;
  $('angles').appendChild(div);
  $(`angle-${i}`).addEventListener('input', (e) => {
    state.angles[i] = +e.target.value;
    sync();
    updateSceneLabel();
  });
});
function fill(input) {
  input.style.setProperty(
    '--fill',
    `${(100 * (+input.value - +input.min)) / (+input.max - +input.min)}%`,
  );
}
// Reflect the selected object and shared scene state into the controls.
function sync() {
  state.objects.forEach((object, i) => {
    const button = $(`select-torus-${i}`);
    button.setAttribute('aria-pressed', state.active === i);
    button.querySelector('.torus-swatch').style.background = object.color;
    button.querySelector('.torus-summary').textContent =
      `${object.t.toFixed(1)}° · ${MATERIALS[object.material]?.label || 'Custom'}`;
    $(`visible-${i}`).checked = object.enabled;
  });
  $('selected-torus').textContent = `Torus ${state.active + 1}`;
  $('material-preset').value = active().material;
  $('material-color').value = active().color;
  $('roughness').value = active().roughness;
  $('roughness-value').textContent = active().roughness.toFixed(2);
  $('opacity').disabled = $('ior').disabled = active().metallic > 0.5;
  $('material-hint').textContent =
    active().metallic > 0.5
      ? 'Opaque metal. Tint and roughness control its reflections.'
      : 'Opacity adds a colored coating and absorption; index controls refraction.';
  $('environment').value = state.environment;
  $('env-rotation').value = state.envRotation;
  $('env-rotation-value').textContent = `${Math.round(state.envRotation)}°`;
  $('exposure').value = state.exposure;
  $('exposure-value').textContent =
    `${state.exposure > 0 ? '+' : ''}${state.exposure.toFixed(1)} EV`;
  const shown = state.objects.filter((o) => o.enabled).length;
  $('scene-count').textContent = `${shown} / 3 visible`;

  for (let i = 0; i < 6; i++) {
    $(`angle-${i}`).value = state.angles[i];
    $(`angle-${i}-value`).textContent = `${state.angles[i].toFixed(0)}°`;
  }
  $('torus').value = active().t;
  $('torus-value').textContent = `${active().t.toFixed(1)}°`;
  $('opacity').value = active().opacity;
  $('opacity-value').textContent = `${Math.round(active().opacity * 100)}%`;
  $('ior').value = active().ior;
  $('ior-value').textContent = active().ior.toFixed(2);
  const band = shellLevels(active().t, active().shellWidth);
  active().shellWidth = band.width;
  $('material-shape').value = active().shell ? 'shell' : 'solid';
  $('shell-controls').hidden = !active().shell;
  $('shell-width').max = band.maxWidth;
  $('shell-width').value = active().shellWidth;
  $('shell-width-number').max = band.maxWidth;
  // Animation also calls sync(); do not overwrite a number while it is being typed.
  if (document.activeElement !== $('shell-width-number')) {
    $('shell-width-number').value = active().shellWidth;
  }
  $('shell-width-value').textContent = `${active().shellWidth.toFixed(2)}°`;
  $('shell-limits').textContent =
    `t₋ = ${band.lowerT.toFixed(3)}° · t₊ = ${band.upperT.toFixed(3)}°`;
  $('material-chip').textContent =
    active().metallic > 0.5 ? 'METAL' : active().shell ? 'SHELL' : 'SOLID';
  $('speed-value').textContent = `${state.speed}°/s`;
  document.querySelectorAll('input[type=range]').forEach(fill);
  const P = projector(state.angles.map((a) => a * rad)),
    pole = P[3][3] - Math.cos(active().t * rad) ** 2;
  const near = active().shell ? Math.min(0.008, (band.cHigh - band.cLow) * 0.1) : 0.008;
  const poleLow = P[3][3] - band.cLow,
    poleHigh = P[3][3] - band.cHigh;
  const atPole = active().shell
    ? Math.min(Math.abs(poleLow), Math.abs(poleHigh)) < near
    : Math.abs(pole) < near;
  $('pole-label').textContent =
    `Torus ${state.active + 1} · ` +
    (active().shell
      ? atPole
        ? 'Shell boundary at pole'
        : poleLow > 0 && poleHigh < 0
          ? 'Shell extends to infinity'
          : 'Bounded shell'
      : atPole
        ? 'At the projection pole'
        : pole > 0
          ? 'Inside-out projection'
          : 'Bounded projection');
  $('pole-value').textContent = active().shell
    ? `P₄₄ = ${P[3][3].toFixed(4)} · band ${band.cLow.toFixed(4)}–${band.cHigh.toFixed(4)}`
    : `P₄₄ − cos²t = ${pole < 0 ? '−' : '+'}${Math.abs(pole).toFixed(4)}`;
  $('infinity-status').classList.toggle('at-pole', atPole);
  $('play').setAttribute('aria-pressed', state.playing);
  $('play').setAttribute('aria-label', state.playing ? 'Pause animation' : 'Play animation');
  $('play-icon').textContent = state.playing ? 'Ⅱ' : '▶';
  dirty = true;
}
function updateSceneLabel() {
  const shown = state.objects.filter((o) => o.enabled),
    count = shown.length;
  $('view-title').textContent =
    count > 1
      ? `${count} Hopf tori`
      : count === 0
        ? 'Environment'
        : Math.abs(shown[0].t - 45) < 0.01
          ? 'Clifford torus'
          : 'Hopf torus';
  $('view-description').textContent = 'Rotate in four dimensions.';
}
for (const [id, key] of [
  ['torus', 't'],
  ['opacity', 'opacity'],
  ['ior', 'ior'],
  ['shell-width', 'shellWidth'],
  ['roughness', 'roughness'],
])
  $(id).addEventListener('input', (e) => {
    active()[key] = +e.target.value;
    if (id === 'torus' || id === 'shell-width') updateSceneLabel();
    sync();
  });
for (const [id, key] of [
  ['speed', 'speed'],
  ['env-rotation', 'envRotation'],
  ['exposure', 'exposure'],
])
  $(id).addEventListener('input', (e) => {
    state[key] = +e.target.value;
    sync();
  });
for (const [id, key] of [
  ['animate-plane', 'plane'],
  ['environment', 'environment'],
  ['mode', 'mode'],
])
  $(id).addEventListener('change', (e) => {
    state[key] = +e.target.value;
    dirty = true;
  });
$('shell-width-number').addEventListener('input', (e) => {
  if (e.target.validity.valid && Number.isFinite(e.target.valueAsNumber)) {
    active().shellWidth = e.target.valueAsNumber;
    sync();
  }
});
$('shell-width-number').addEventListener('change', (e) => {
  const width = e.target.valueAsNumber;
  if (Number.isFinite(width)) active().shellWidth = shellLevels(active().t, width).width;
  e.target.value = active().shellWidth;
  updateSceneLabel();
  sync();
});
$('apply-shell-width-all').onclick = () => {
  // Read the field directly so a click also commits the latest typed value.
  const entered = $('shell-width-number').valueAsNumber;
  const requested = Number.isFinite(entered)
    ? shellLevels(active().t, entered).width
    : active().shellWidth;
  const shared = applyShellWidthToAll(state.objects, requested);
  updateSceneLabel();
  sync();
  toast(
    shared < requested
      ? `All three widths set to ${shared.toFixed(2)}° to fit their parameters.`
      : `Shell width ${shared.toFixed(2)}° applied to all three.`,
  );
};
$('material-shape').addEventListener('change', (e) => {
  active().shell = e.target.value === 'shell';
  updateSceneLabel();
  sync();
});
$('material-preset').addEventListener('change', (e) => {
  applyMaterial(active(), e.target.value);
  sync();
});
$('material-color').addEventListener('input', (e) => {
  active().color = e.target.value;
  sync();
});
$('apply-material-all').onclick = () => {
  const source = active();
  for (const object of state.objects)
    for (const key of ['material', 'color', 'opacity', 'ior', 'roughness', 'metallic'])
      object[key] = source[key];
  sync();
  toast('Material applied to all three tori.');
};
for (let i = 0; i < 3; i++) {
  $(`select-torus-${i}`).onclick = () => {
    state.active = i;
    $('torus-panel').open = true;
    sync();
  };
  $(`visible-${i}`).onchange = (e) => {
    state.objects[i].enabled = e.target.checked;
    updateSceneLabel();
    sync();
  };
}
$('quality').addEventListener('change', (e) => {
  state.quality = e.target.value;
  scale = state.quality === 'high' ? 1 : state.quality === 'fast' ? 0.45 : 0.65;
  dirty = true;
});
$('play').onclick = () => {
  state.playing = !state.playing;
  sync();
};
$('clifford-t').onclick = () => {
  active().t = 45;
  updateSceneLabel();
  sync();
};
$('zero-angles').onclick = () => {
  state.angles.fill(0);
  state.playing = false;
  updateSceneLabel();
  sync();
};
function resetCamera() {
  Object.assign(camera, {
    yaw: 0.42,
    pitch: 0.43,
    distance: state.objects.filter((o) => o.enabled).length > 1 ? 10.5 : 6.8,
  });
  dirty = true;
}
$('reset-camera').onclick = resetCamera;
$('reset').onclick = () => {
  Object.assign(state, {
    speed: 12,
    environment: 3,
    envRotation: 0,
    exposure: 0,
    mode: 0,
    quality: 'adaptive',
  });
  scale = 0.65;
  $('speed').value = 12;
  $('mode').value = 0;
  $('quality').value = 'adaptive';
  state.objects = defaultObjects();
  state.active = 1;
  state.playing = false;
  state.plane = 2;
  state.angles.fill(0);
  $('animate-plane').value = '2';
  updateSceneLabel();
  sync();
  resetCamera();
};
$('environment-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      throw new Error('Choose a JPEG, PNG, or WebP panorama.');
    if (file.size > 32 * 1024 * 1024) throw new Error('Choose an image smaller than 32 MB.');
    const bitmap = await createImageBitmap(file),
      maxSize = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    const ratio = Math.min(1, maxSize / bitmap.width, maxSize / bitmap.height),
      imageCanvas = document.createElement('canvas');
    imageCanvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    imageCanvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    imageCanvas.getContext('2d').drawImage(bitmap, 0, 0, imageCanvas.width, imageCanvas.height);
    bitmap.close();
    environmentImage = imageCanvas;
    uploadEnvironment();
    state.environment = 6;
    $('custom-environment').disabled = false;
    $('environment-file-name').textContent =
      `${file.name} · ${imageCanvas.width} × ${imageCanvas.height}`;
    sync();
  } catch (error) {
    toast(error.message);
  } finally {
    e.target.value = '';
  }
});
function uploadEnvironment() {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, environmentTexture);
  if (environmentImage) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, environmentImage);
    mapMaxLod = Math.floor(Math.log2(Math.max(environmentImage.width, environmentImage.height)));
  } else {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([128, 128, 128, 255]),
    );
    mapMaxLod = 0;
  }
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
for (const [button, dialog] of [
  ['about', 'math-dialog'],
  ['shortcuts', 'keys-dialog'],
]) {
  $(button).onclick = () => $(dialog).showModal();
  $(dialog).querySelector('.dialog-close').onclick = () => $(dialog).close();
  $(dialog).addEventListener('click', (e) => {
    if (e.target === $(dialog)) {
      const r = $(dialog).getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        $(dialog).close();
    }
  });
}
function zoom(amount) {
  camera.distance = Math.max(0.45, Math.min(35, camera.distance * Math.exp(amount)));
  dirty = true;
}
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointerMap.set(e.pointerId, { x: e.clientX, y: e.clientY });
  drag = { x: e.clientX, y: e.clientY };
  canvas.focus({ preventScroll: true });
  if (pointerMap.size === 2) {
    const [a, b] = [...pointerMap.values()];
    pinch = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointerMap.has(e.pointerId)) return;
  pointerMap.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointerMap.size === 2) {
    const [a, b] = [...pointerMap.values()],
      dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch) zoom(Math.log(pinch / dist));
    pinch = dist;
  } else if (drag) {
    camera.yaw -= (e.clientX - drag.x) * 0.006;
    camera.pitch = Math.max(-1.5, Math.min(1.5, camera.pitch + (e.clientY - drag.y) * 0.006));
    dirty = true;
  }
  drag = { x: e.clientX, y: e.clientY };
});
function endPointer(e) {
  pointerMap.delete(e.pointerId);
  pinch = null;
  drag = pointerMap.size ? [...pointerMap.values()][0] : null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    zoom(e.deltaY * 0.001);
  },
  { passive: false },
);
document.addEventListener('keydown', (e) => {
  if (
    document.querySelector('dialog[open]') ||
    ['INPUT', 'SELECT', 'BUTTON', 'SUMMARY'].includes(e.target.tagName)
  )
    return;
  if (e.code === 'Space') {
    e.preventDefault();
    state.playing = !state.playing;
    sync();
  }
  if (e.key.toLowerCase() === 'r') resetCamera();
  if (e.target === canvas) {
    if (e.key.startsWith('Arrow')) e.preventDefault();
    if (e.key === 'ArrowLeft') camera.yaw += 0.08;
    if (e.key === 'ArrowRight') camera.yaw -= 0.08;
    if (e.key === 'ArrowUp') camera.pitch = Math.min(1.5, camera.pitch + 0.08);
    if (e.key === 'ArrowDown') camera.pitch = Math.max(-1.5, camera.pitch - 0.08);
    if (e.key === '+' || e.key === '=') zoom(-0.1);
    if (e.key === '-') zoom(0.1);
    dirty = true;
  }
});
function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  setTimeout(() => ($('toast').hidden = true), 2700);
}
$('capture').onclick = () => {
  render();
  canvas.toBlob((blob) => {
    if (!blob) {
      toast('Image capture is unavailable.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hopf-observatory.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Saved the current projection.');
  }, 'image/png');
};
function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}
function init() {
  gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  if (!gl)
    throw new Error(
      'This experience needs WebGL 2. Enable hardware acceleration or try a current browser.',
    );
  program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  for (const name of [
    'uResolution',
    'uP',
    'uC',
    'uOpacity',
    'uIOR',
    'uEye',
    'uRight',
    'uUp',
    'uForward',
    'uEnvironment',
    'uMode',
    'uBounces',
    'uShell',
    'uShellLow',
    'uShellHigh',
    'uCount',
    'uEnabled',
    'uShells',
    'uLevels',
    'uLows',
    'uHighs',
    'uOptics[0]',
    'uColors[0]',
    'uEnvRotation',
    'uExposure',
    'uMapMaxLod',
    'uEnvironmentMap',
    'uRayBias',
  ])
    uniforms[name] = gl.getUniformLocation(program, name);
  environmentTexture = gl.createTexture();
  uploadEnvironment();
  $('render-state').textContent = 'LIVE RAYTRACE';
}
// Upload geometry/material data once per frame; all surface work stays in GLSL.
function render() {
  if (!gl || gl.isContextLost()) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5),
    w = Math.max(1, Math.floor(canvas.clientWidth * dpr * scale)),
    h = Math.max(1, Math.floor(canvas.clientHeight * dpr * scale));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  const cy = Math.cos(camera.yaw),
    sy = Math.sin(camera.yaw),
    cp = Math.cos(camera.pitch),
    sp = Math.sin(camera.pitch);
  const eye = [camera.distance * sy * cp, camera.distance * sp, camera.distance * cy * cp],
    forward = eye.map((x) => -x / camera.distance),
    right = [cy, 0, -sy],
    up = [-sy * sp, cp, -cy * sp];
  const P = projector(state.angles.map((a) => a * rad));
  const colors = ['#dcad73', '#86bbb6', '#a0b9d4'];
  document.querySelector('.axis-gizmo svg').innerHTML =
    [0, 1, 2]
      .map((i) => {
        const x = 40 + 29 * right[i],
          y = 42 - 29 * up[i];
        return `<path d="M40 42L${x} ${y}" stroke="${colors[i]}"/><text x="${40 + 37 * right[i] - 3}" y="${46 - 37 * up[i]}" fill="${colors[i]}">${['x', 'y', 'z'][i]}</text>`;
      })
      .join('') + '<circle cx="40" cy="42" r="2.5" fill="#d9e3e4"/>';
  gl.useProgram(program);
  gl.uniform2f(uniforms.uResolution, w, h);
  gl.uniformMatrix4fv(uniforms.uP, false, new Float32Array(P.flat()));
  const levels = state.objects.map(objectLevels);
  gl.uniform1f(uniforms.uRayBias, rayBiasScale(state.objects));
  gl.uniform1i(uniforms.uCount, 3);
  gl.uniform3iv(
    uniforms.uEnabled,
    state.objects.map((o) => +o.enabled),
  );
  gl.uniform3iv(
    uniforms.uShells,
    state.objects.map((o) => +o.shell),
  );
  gl.uniform3fv(
    uniforms.uLevels,
    levels.map((o) => o.c),
  );
  gl.uniform3fv(
    uniforms.uLows,
    levels.map((o) => o.low),
  );
  gl.uniform3fv(
    uniforms.uHighs,
    levels.map((o) => o.high),
  );
  gl.uniform4fv(
    uniforms['uOptics[0]'],
    state.objects.flatMap((o) => [o.opacity, o.ior, o.roughness, o.metallic]),
  );
  gl.uniform3fv(
    uniforms['uColors[0]'],
    state.objects.flatMap((o) => linearColor(o.color)),
  );
  gl.uniform1f(uniforms.uEnvRotation, state.envRotation * rad);
  gl.uniform1f(uniforms.uExposure, state.exposure);
  gl.uniform1f(uniforms.uMapMaxLod, mapMaxLod);
  gl.uniform1i(uniforms.uEnvironmentMap, 0);
  gl.uniform3fv(uniforms.uEye, eye);
  gl.uniform3fv(uniforms.uRight, right);
  gl.uniform3fv(uniforms.uUp, up);
  gl.uniform3fv(uniforms.uForward, forward);
  gl.uniform1i(uniforms.uEnvironment, state.environment);
  gl.uniform1i(uniforms.uMode, state.mode);
  gl.uniform1i(
    uniforms.uBounces,
    state.quality === 'high' ? 24 : state.quality === 'fast' ? 8 : 16,
  );
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  dirty = false;
  frames++;
}
// Draw on changes, or while animating. Adaptive quality changes pixel count only.
function loop(time) {
  const dt = Math.min((time - last) / 1000, 0.05);
  last = time;
  if (state.playing && !document.hidden) {
    state.angles[state.plane] = ((state.angles[state.plane] + state.speed * dt + 180) % 360) - 180;
    sync();
  }
  if (dirty && !document.hidden) render();
  if (time - fpsStart > 1200) {
    const fps = (frames * 1000) / (time - fpsStart);
    $('fps').textContent = state.playing
      ? `${Math.round(fps)} fps`
      : `${canvas.width} × ${canvas.height}`;
    if (state.playing && state.quality === 'adaptive') {
      if (fps < 24) {
        slowFrames++;
        if (slowFrames >= 2) {
          scale = Math.max(0.35, scale * 0.82);
          slowFrames = 0;
          dirty = true;
        }
      } else if (fps > 52 && scale < 1) {
        scale = Math.min(1, scale * 1.08);
        dirty = true;
      }
    }
    frames = 0;
    fpsStart = time;
  }
  animationId = requestAnimationFrame(loop);
}
new ResizeObserver(() => {
  dirty = true;
}).observe(canvas);
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  cancelAnimationFrame(animationId);
  $('render-state').textContent = 'CONTEXT LOST';
  $('error').textContent =
    'The GPU context was interrupted. Waiting for the browser to restore it…';
  $('error').hidden = false;
});
canvas.addEventListener('webglcontextrestored', () => {
  try {
    init();
    $('error').hidden = true;
    dirty = true;
    last = performance.now();
    animationId = requestAnimationFrame(loop);
  } catch (e) {
    showError(e);
  }
});
function showError(error) {
  $('render-state').textContent = 'RENDER ERROR';
  $('error').hidden = false;
  $('error').textContent = error.message;
  console.error(error);
}
try {
  updateSceneLabel();
  sync();
  init();
  render();
  animationId = requestAnimationFrame(loop);
} catch (e) {
  showError(e);
}
// Read-only diagnostics for reproducible numerical and rendering checks.
window.hopfDiagnostics = {
  getState: () => structuredClone({ ...state, camera, renderSize: [canvas.width, canvas.height] }),
  getGL: () => gl,
};
