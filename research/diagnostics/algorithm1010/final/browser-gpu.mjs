// Fresh hardware WebGL2 context for the bounded adoption evaluation.
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

export async function openGPU() {
  const browser = await chromium.launch({
    executablePath: existsSync(chromium.executablePath())
      ? chromium.executablePath()
      : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--use-angle=metal'],
  });
  const page = await browser.newPage();
  await page.setContent('<canvas width="1280" height="720"></canvas>');
  const helper = await readFile(new URL('../../../webgl.mjs', import.meta.url), 'utf8');
  await page.addScriptTag({ content: helper.replaceAll('export ', '') });
  const hardware = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2', { antialias: false });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw Error('Float WebGL2 required');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    gl.bindVertexArray(gl.createVertexArray());
    // Match the native suite's complete neutral environment texture.
    const env = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, env);
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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    window.probe = { gl, timer, env, programs: new Map(), targets: new Map() };
    window.target = (width, height, float, count) => {
      const key = [width, height, float, count].join('/');
      let target = window.probe.targets.get(key);
      if (!target) {
        const fb = gl.createFramebuffer(),
          attachments = [];
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        for (let i = 0; i < count; i++) {
          const texture = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texStorage2D(gl.TEXTURE_2D, 1, float ? gl.RGBA32F : gl.RGBA8, width, height);
          gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0 + i,
            gl.TEXTURE_2D,
            texture,
            0,
          );
          attachments.push(gl.COLOR_ATTACHMENT0 + i);
        }
        target = { fb, attachments };
        window.probe.targets.set(key, target);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
      gl.drawBuffers(target.attachments);
      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      gl.bindTexture(gl.TEXTURE_2D, env);
      gl.viewport(0, 0, width, height);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
        throw Error('Incomplete framebuffer');
    };
    return {
      renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      vendor: gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
      userAgent: navigator.userAgent,
      timerQueryAvailable: !!timer,
    };
  });
  if (/SwiftShader|llvmpipe/i.test(hardware.renderer)) {
    await browser.close();
    throw Error('Hardware GPU required: ' + hardware.renderer);
  }
  const command = async (request) => {
    if (request.op === 'quit') return {};
    return page.evaluate(async (request) => {
      const { gl, timer, programs } = window.probe;
      if (request.op === 'compile') {
        let source = request.fragment;
        if (!/layout\s*\(\s*location\s*=\s*0\s*\)\s*out vec4 outColor/.test(source))
          source = source.replace('out vec4 outColor;', 'layout(location=0) out vec4 outColor;');
        const shader = compileProgram(gl, request.vertex, source);
        shader.outputs = /layout\s*\(\s*location\s*=\s*3\s*\)/.test(source) ? 4 : 1;
        programs.set(request.name, shader);
        return { glError: gl.getError() };
      }
      const shader = programs.get(request.name);
      if (!shader) throw Error('Unknown program ' + request.name);
      gl.useProgram(shader.program);
      shader.set(request.uniforms);
      if (request.op === 'draw') {
        window.target(1, 1, true, shader.outputs);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const pixels = [];
        for (let i = 0; i < shader.outputs; i++) {
          gl.readBuffer(gl.COLOR_ATTACHMENT0 + i);
          const buffer = new Float32Array(4);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, buffer);
          pixels.push(...buffer);
        }
        while (pixels.length < 16) pixels.push(0);
        return {
          glError: gl.getError(),
          pixels: pixels.map((x) => (Number.isFinite(x) ? x : null)),
        };
      }
      if (request.op !== 'render') throw Error('Unsupported operation ' + request.op);
      const { width, height, frames = 10, warmup = 5 } = request;
      window.target(width, height, false, 1);
      const finish = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      for (let i = 0; i < warmup; i++) {
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        finish();
      }
      // Complete EACH frame to prevent tile/overdraw elimination of earlier
      // identical fullscreen draws. Query polling is outside both measurements.
      const milliseconds = [],
        completionMilliseconds = [];
      let disjoint = false;
      for (let i = 0; i < frames; i++) {
        const query = timer ? gl.createQuery() : null,
          begin = performance.now();
        if (query) gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (query) gl.endQuery(timer.TIME_ELAPSED_EXT);
        finish();
        completionMilliseconds.push(performance.now() - begin);
        if (query) {
          const deadline = performance.now() + 30000;
          while (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
            if (performance.now() > deadline) throw Error('GPU timer timeout');
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
          milliseconds.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
          gl.deleteQuery(query);
          disjoint ||= gl.getParameter(timer.GPU_DISJOINT_EXT);
        }
      }
      const blockMilliseconds = completionMilliseconds.reduce((a, b) => a + b, 0);
      let pixels;
      if (request.capture) {
        const buffer = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
        pixels = Array.from(buffer);
      }
      return {
        glError: gl.getError(),
        disjoint,
        milliseconds,
        completionMilliseconds,
        blockMilliseconds,
        pixels,
      };
    }, request);
  };
  return {
    hardware,
    command,
    compile: (name, vertex, fragment) => command({ op: 'compile', name, vertex, fragment }),
    close: () => browser.close(),
  };
}
