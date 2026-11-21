import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Optional web fonts must not make local integration checks depend on a CDN.
  await page.route(/^https:\/\//, (route) => route.abort());
});

test('the Pages artifact renders at a subpath with the configured defaults', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/_site/');
  await expect(page.locator('#view-title')).toHaveText('Clifford torus');
  await expect(page.locator('#error')).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.hopfDiagnostics?.getGL())), {
      message: 'WebGL initialization completes',
    })
    .toBe(true);
  // Readback waits for the real shader's draw, unlike the timer-driven FPS label.
  const frame = await page.evaluate(() => {
    const gl = window.hopfDiagnostics.getGL();
    const pixel = new Uint8Array(4);
    gl.readPixels(
      Math.floor(gl.drawingBufferWidth / 2),
      Math.floor(gl.drawingBufferHeight / 2),
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixel,
    );
    return { error: gl.getError(), pixel: [...pixel] };
  });
  expect(frame.error).toBe(0);
  expect(frame.pixel[3]).toBe(255);
  expect(frame.pixel.slice(0, 3).some((channel) => channel > 0)).toBe(true);
  await expect(page.locator('#visible-0')).not.toBeChecked();
  await expect(page.locator('#visible-1')).toBeChecked();
  await expect(page.locator('#visible-2')).not.toBeChecked();
  await expect(page.locator('#shell-width-number')).toHaveValue('0.01');
  await expect(page.locator('#material-color')).toHaveValue('#dea1d6');
  expect(errors).toEqual([]);
});

test('shell width reaches hidden tori and Reset restores the scene', async ({ page }) => {
  await page.goto('/_site/');
  await page.locator('#shell-width-number').fill('0.05');
  await page.locator('#apply-shell-width-all').click();
  for (const id of [0, 2]) {
    await page.locator(`#select-torus-${id}`).click();
    await expect(page.locator('#shell-width-number')).toHaveValue('0.05');
  }
  await page.locator('#visible-0').check();
  await expect(page.locator('#view-title')).toHaveText('2 Hopf tori');
  await page.locator('#reset').click();
  await expect(page.locator('#shell-width-number')).toHaveValue('0.01');
  await expect(page.locator('#visible-0')).not.toBeChecked();
  await expect(page.locator('#visible-1')).toBeChecked();
});

test('the illustrated note has six loaded figures and local demo links', async ({ page }) => {
  await page.goto('/_site/technical-note.html');
  await expect(page.locator('figure')).toHaveCount(6);
  await expect
    .poll(() =>
      page
        .locator('figure img')
        .evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)),
    )
    .toBe(true);
  expect(await page.locator('math').count()).toBeGreaterThan(100);
  const links = await page
    .locator('a')
    .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')));
  expect(links.some((url) => /^https?:\/\/(localhost|127\.0\.0\.1)/.test(url))).toBe(false);
});

test('production WebGL intersections match the independent reference', async ({ page }) => {
  await page.goto('/research/verify.html');
  await expect(page.locator('#status')).toHaveText(/^PASS: 867 \/ 867 rays;/, { timeout: 45_000 });
  const report = JSON.parse(await page.locator('#result').innerText());
  expect(report.failures).toEqual([]);
  expect(report.rootCount).toBe(1470);
  expect(report.maxRelativeError).toBeLessThanOrEqual(1e-4);
});
