import { vertex, fragment } from '../web/shader.js';
import { compileProgram, sourceHashes } from './webgl.mjs';

const status = document.querySelector('#status'),
  output = document.querySelector('#result'),
  save = document.querySelector('#save');
let report;
try {
  const gl = document.querySelector('canvas').getContext('webgl2', { antialias: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float'))
    throw Error('WebGL 2 with float render targets is required.');
  const head = fragment.slice(0, fragment.lastIndexOf('void main()'));
  const { set } = compileProgram(
    gl,
    vertex,
    head + 'void main(){outColor=vec4(intersection(uEye,uForward,uC),0,0,1);}',
  );
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, 1, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const target = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, target);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
    throw Error('Incomplete float framebuffer');
  gl.viewport(0, 0, 1, 1);
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const reference = await (await fetch('results/reference.json')).json();
  report = {
    date: new Date().toISOString(),
    userAgent: navigator.userAgent,
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    sourceHashes: await sourceHashes([
      '../web/shader.js',
      'verify.mjs',
      'webgl.mjs',
      'results/reference.json',
    ]),
    tolerance: 1e-4,
    total: reference.cases.length,
    passed: 0,
    rootCount: 0,
    maxRelativeError: 0,
    failures: [],
  };
  const pixel = new Float32Array(4);
  for (const test of reference.cases) {
    let origin = test.o.slice(),
      distance = 0;
    const actual = [];
    for (let i = 0; i < 6; i++) {
      set({ uP: test.P.flat(), uC: test.c, uEye: origin, uForward: test.d, uRayBias: 4e-4 });
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixel);
      if (gl.getError() !== gl.NO_ERROR) throw Error('WebGL numerical query failed');
      const hit = pixel[0];
      if (hit < 0) break;
      if (!Number.isFinite(hit)) {
        actual.push(null);
        break;
      }
      actual.push(distance + hit);
      const point = origin.map((v, j) => v + hit * test.d[j]),
        offset = 4e-4 * Math.max(1, Math.hypot(...point));
      origin = point.map((v, j) => Math.fround(v + offset * test.d[j]));
      distance += hit + offset;
    }
    const cutoff = 2e-4 * Math.max(1, Math.hypot(...test.o));
    const expected = test.reference.roots.map((r) => Number(r.s)).filter((s) => s > cutoff),
      remaining = expected.slice();
    let unmatched = 0;
    for (const hit of actual) {
      const errors = remaining.map((s) =>
        hit === null ? Infinity : Math.abs(hit - s) / Math.max(1, s),
      );
      const error = Math.min(...errors),
        index = errors.indexOf(error);
      if (error <= report.tolerance) {
        remaining.splice(index, 1);
        report.maxRelativeError = Math.max(report.maxRelativeError, error);
        report.rootCount++;
      } else unmatched++;
    }
    if (!remaining.length && !unmatched) report.passed++;
    else
      report.failures.push({
        id: test.id,
        name: test.name,
        expected,
        actual,
        missing: remaining,
        unmatched,
      });
    if (test.id % 100 === 0) {
      status.textContent = `Checking ${test.id + 1} / ${report.total}`;
      await new Promise(requestAnimationFrame);
    }
  }
  report.completed = true;
  status.textContent = `${report.passed === report.total ? 'PASS' : 'FAIL'}: ${report.passed} / ${report.total} rays; ${report.rootCount} matched roots`;
  output.textContent = JSON.stringify(report, null, 2);
  save.disabled = false;
} catch (error) {
  status.textContent = 'ERROR';
  output.textContent = error.stack;
}
save.onclick = () => {
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
    ),
    a = document.createElement('a');
  a.href = url;
  a.download = 'hopf-webgl-validation.json';
  a.click();
  URL.revokeObjectURL(url);
};
