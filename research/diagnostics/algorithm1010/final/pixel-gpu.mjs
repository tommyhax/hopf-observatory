// Keep the original raster coordinates when sampling the two known outliers.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
export async function openGPU(browser) {
  if (browser) {
    const original = new URL('browser-gpu.mjs', import.meta.url);
    let source = await readFile(original, 'utf8');
    source = source
      .replace(
        "import { chromium } from '@playwright/test';",
        `import { chromium } from ${JSON.stringify(import.meta.resolve('@playwright/test'))};`,
      )
      .replaceAll('import.meta.url', JSON.stringify(original.href))
      .replace(
        'window.target(1, 1, true, shader.outputs);',
        'window.target(request.width, request.height, true, shader.outputs);',
      )
      .replace(
        'gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, buffer);',
        'gl.readPixels(request.x, request.y, 1, 1, gl.RGBA, gl.FLOAT, buffer);',
      );
    return (
      await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
    ).openGPU();
  }
  const temp = await mkdtemp(join(tmpdir(), 'hopf-pixel-probe-'));
  const original = new URL('../../../native-render.m', import.meta.url);
  let source = await readFile(original, 'utf8');
  source = source
    .replace(
      '          } else if ([op isEqualToString:@"draw"]) {',
      `          } else if ([op isEqualToString:@"draw"]) {
            int width=[request[@"width"] intValue],height=[request[@"height"] intValue];
            for(int i=0;i<4;i++) {
              glBindTexture(GL_TEXTURE_2D,targets[i]);
              glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA32F,width,height,0,GL_RGBA,GL_FLOAT,NULL);
            }
            glBindTexture(GL_TEXTURE_2D,env);
            glViewport(0,0,width,height);`,
    )
    .replace(
      'glReadPixels(0, 0, 1, 1, GL_RGBA, GL_FLOAT, out);',
      'glReadPixels([request[@"x"] intValue], [request[@"y"] intValue], 1, 1, GL_RGBA, GL_FLOAT, out);',
    );
  await writeFile(join(temp, 'native-render.m'), source);
  const client = new URL('../../../gpu-client.mjs', import.meta.url);
  let driver = await readFile(client, 'utf8');
  driver = driver
    .replaceAll('import.meta.url', JSON.stringify(client.href))
    .replace("join(dir, 'native-render.m')", JSON.stringify(join(temp, 'native-render.m')));
  const gpu = await (
    await import('data:text/javascript;base64,' + Buffer.from(driver).toString('base64'))
  ).openGPU();
  const close = gpu.close;
  gpu.close = async () => {
    await close();
    await rm(temp, { recursive: true, force: true });
  };
  return gpu;
}
