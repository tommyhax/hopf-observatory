// Local preview: use the unchanged application with the experimental shader.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rendererVariant } from './renderer.mjs';
import { vertex, fragment } from '../../../web/shader.js';

export async function createPreviewServer() {
  const web = fileURLToPath(new URL('../../../web/', import.meta.url));
  const direct = await rendererVariant(fragment, 'direct');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
  return createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405); response.end(); return;
      }
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname.endsWith('/favicon.ico')) {
        response.writeHead(204); response.end(); return;
      }
      if (url.pathname === '/baseline') {
        response.writeHead(302, { Location: '/baseline/' }); response.end(); return;
      }
      const baseline = url.pathname.startsWith('/baseline/');
      const relative = decodeURIComponent(url.pathname.slice(baseline ? 10 : 1)) || 'index.html';
      const path = resolve(web, relative);
      if (!path.startsWith(resolve(web) + sep)) {
        response.writeHead(403); response.end(); return;
      }
      let body;
      if (relative === 'shader.js' && !baseline) {
        body = `export const vertex=${JSON.stringify(vertex)};\nexport const fragment=${JSON.stringify(direct)};\n`;
      } else {
        body = await readFile(path);
      }
      if (relative === 'index.html') {
        const label = baseline ? 'Production baseline' : 'Experimental guarded direct';
        const href = baseline ? '/' : '/baseline/';
        const link = baseline ? 'Try guarded direct' : 'Compare baseline';
        body = body.toString().replace('<title>Hopf Observatory</title>', `<title>${label} · Hopf Observatory</title>`)
          .replace('<div class="mast-right">', `<div class="mast-right"><a class="text-button" href="${href}" style="margin-right:16px">${label} · ${link}</a>`);
      }
      response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end('Preview request failed');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.HOPF_DIRECT_PORT || 8767);
  const server = await createPreviewServer();
  server.listen(port, '127.0.0.1', () => console.log(`Guarded direct: http://127.0.0.1:${port}/\nBaseline: http://127.0.0.1:${port}/baseline/`));
}
