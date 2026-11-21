import { projector } from '../web/math.js';
import { scenePreset, makeTorus, objectLevels, linearColor, rayBiasScale } from '../web/scene.js';
const norm = (v) => {
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function sceneUniforms(
  objects,
  angles = [0, 0, 0, 0, 0, 0],
  eye = [5, 3.5, 8],
  budget = 24,
) {
  const forward = norm(eye.map((x) => -x)),
    right = norm(cross(forward, [0, 1, 0])),
    up = cross(right, forward),
    b = objects.map(objectLevels),
    pad = (a) => [...a, ...Array(3 - a.length).fill(0)];
  return {
    uP: projector(angles.map((x) => (x * Math.PI) / 180)).flat(),
    uCount: objects.length,
    uEnabled: pad(objects.map((o) => +o.enabled)),
    uShells: pad(objects.map((o) => +o.shell)),
    uLevels: pad(b.map((x) => x.c)),
    uLows: pad(b.map((x) => x.low)),
    uHighs: pad(b.map((x) => x.high)),
    'uOptics[0]': objects.flatMap((o) => [o.opacity, o.ior, o.roughness, o.metallic]),
    'uColors[0]': objects.flatMap((o) => linearColor(o.color)),
    uEye: eye,
    uForward: forward,
    uRight: right,
    uUp: up,
    uRayBias: rayBiasScale(objects),
    uBounces: budget,
    uEnvironment: 3,
    uExposure: 0,
    uEnvRotation: 0.3,
    uMode: 0,
  };
}
export function figureScenes() {
  const three = scenePreset('glass');
  three.forEach((o) => Object.assign(o, { shellWidth: 0.5, ior: 1.3, opacity: 0.025 }));
  const solid = { ...makeTorus(45, '#8ed3cb'), shell: false, opacity: 0.04, ior: 1.45 },
    shell = { ...solid, shell: true, shellWidth: 3 };
  const opaque = { ...solid, opacity: 1, roughness: 0.24 };
  return [
    {
      name: 'three-tori',
      objects: three,
      angles: [15, -12, 31, 0, 8, 10],
      eye: [5, 3.5, 9],
      width: 1400,
      height: 1000,
    },
    {
      name: 'three-unrotated',
      objects: three,
      angles: [0, 0, 0, 0, 0, 0],
      eye: [5, 4, 10],
      width: 1000,
      height: 1000,
    },
    {
      name: 'solid',
      objects: [solid],
      angles: [0, 0, 0, 0, 0, 0],
      eye: [4, 3, 6],
      width: 900,
      height: 800,
    },
    {
      name: 'shell',
      objects: [shell],
      angles: [0, 0, 0, 0, 0, 0],
      eye: [4, 3, 6],
      width: 900,
      height: 800,
    },
    ...[30, 42, 45, 48, 60].map((a) => ({
      name: `pole-${a}`,
      objects: [opaque],
      angles: [0, 0, a, 0, 0, 0],
      eye: [0, 3, 11],
      mode: 1,
      width: 650,
      height: 650,
    })),
  ];
}
export function benchmarkScenes() {
  const single = [{ ...makeTorus(45, '#91ddd7'), shell: false, opacity: 0.03, ior: 1.45 }];
  const three = scenePreset('glass');
  three.forEach((o) => Object.assign(o, { shellWidth: 0.01, opacity: 0, ior: 1.35 }));
  return [
    { name: 'single solid', objects: single, angles: [0, 0, 0, 0, 0, 0], eye: [4, 3, 7] },
    { name: 'three thin shells', objects: three, angles: [0, 0, 0, 0, 0, 0], eye: [5, 3.5, 10] },
    {
      name: 'three thin shells near pole',
      objects: three,
      angles: [0, 0, 45, 0, 0, 0],
      eye: [5, 3.5, 10],
    },
  ];
}
