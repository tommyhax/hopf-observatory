// Exercise the actual application with the experimental shader after timing.
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {variantFiles} from './renderer.mjs';
import { createPreviewServer } from './serve.mjs';

const server = await createPreviewServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch({
  executablePath: existsSync(chromium.executablePath()) ? chromium.executablePath() : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal'],
});
const results = [];
try {
  for (const path of ['/', '/baseline/']) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${port}${path}`);
    await page.waitForFunction(() => document.getElementById('render-state').textContent === 'LIVE RAYTRACE' &&
      /\d+\s*(fps|×)/.test(document.getElementById('fps').textContent), null, { timeout: 60000 });
    const state = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      const gl = canvas.getContext('webgl2');
      return { title: document.title, errorHidden: document.getElementById('error').hidden,
        errorText: document.getElementById('error').textContent,
        renderState: document.getElementById('render-state').textContent,
        fps: document.getElementById('fps').textContent, width: canvas.width, height: canvas.height,
        glError: gl.getError(), comparisonLink: document.querySelector('.mast-right a').getAttribute('href') };
    });
    // UI controls continue to run through the original application's event handlers.
    await page.locator('#reset-camera').click();
    await page.screenshot({ path: `research/diagnostics/guarded-direct/figures/preview-${path === '/' ? 'direct' : 'production'}.png` });
    const pass = errors.length === 0 && state.errorHidden && state.glError === 0 && state.width > 0 && state.height > 0;
    results.push({ path, ...state, errors, pass });
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
const sources = ['web/app.js', 'web/index.html', 'web/shader.js',
  ...variantFiles, ...['serve.mjs', 'smoke-preview.mjs'].map(p => 'research/diagnostics/guarded-direct/' + p)];
const hashes = Object.fromEntries(await Promise.all(sources.map(async p => [p, createHash('sha256').update(await readFile(p)).digest('hex')])));
await writeFile('research/diagnostics/guarded-direct/results/preview.json', JSON.stringify({ results, hashes }, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
if (!results.every(r => r.pass)) process.exitCode = 1;
