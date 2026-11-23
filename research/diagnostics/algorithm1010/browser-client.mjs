// WebGL 2 backend for the unchanged all-roots protocol. Uses a fresh browser
// profile, never attaches to the user's browser session.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
export async function openGPU() {
  const installed = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({
    executablePath: existsSync(chromium.executablePath()) ? chromium.executablePath() : installed,
    headless: true,
    args: ['--use-angle=metal'],
  });
  const page = await browser.newPage();
  await page.setContent('<canvas id="gpu" width="1" height="1"></canvas>');
  const helper = await readFile(new URL('../../webgl.mjs', import.meta.url), 'utf8');
  await page.addScriptTag({ content: helper.replaceAll('export ', '') });
  const hardware = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2', { antialias: false });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw Error('Float WebGL2 unavailable');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    const attachments = [];
    for (let i = 0; i < 4; i++) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 1, 1);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, texture, 0);
      attachments.push(gl.COLOR_ATTACHMENT0 + i);
    }
    gl.drawBuffers(attachments);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw Error('Incomplete framebuffer');
    gl.bindVertexArray(gl.createVertexArray());
    gl.viewport(0, 0, 1, 1);
    window.probe = { gl, programs: new Map() };
    return {
      renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      vendor: gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
      userAgent: navigator.userAgent,
    };
  });
  if (/SwiftShader|llvmpipe/i.test(hardware.renderer)) {
    await browser.close();
    throw Error('Hardware GPU required, received ' + hardware.renderer);
  }
  const command = (request) =>
    page.evaluate((request) => {
      const { gl, programs } = window.probe;
      if (request.op === 'compile') {
        programs.set(request.name, compileProgram(gl, request.vertex, request.fragment));
        return { glError: gl.getError() };
      }
      if (request.op !== 'draw') throw Error('Unsupported browser operation');
      const shader = programs.get(request.name);
      gl.useProgram(shader.program);
      gl.drawBuffers(
        gl.getFragDataLocation(shader.program, 'roots1') >= 0
          ? [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3]
          : [gl.COLOR_ATTACHMENT0],
      );
      shader.set(request.uniforms);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const pixels = [];
      for (let i = 0; i < 4; i++) {
        gl.readBuffer(gl.COLOR_ATTACHMENT0 + i);
        const buffer = new Float32Array(4);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, buffer);
        pixels.push(...buffer);
      }
      return { glError: gl.getError(), pixels: pixels.map((x) => (Number.isFinite(x) ? x : null)) };
    }, request);
  return {
    hardware,
    command,
    compile: (name, vertex, fragment) => command({ op: 'compile', name, vertex, fragment }),
    close: () => browser.close(),
  };
}
