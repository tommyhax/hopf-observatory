// Assemble the reviewed browser assets and PDF for GitHub Pages.
import { cp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, '_site');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(join(root, 'web'), output, { recursive: true });
await cp(join(root, 'technical-note/technical-note.pdf'), join(output, 'technical-note.pdf'));
await cp(join(root, 'paper/manuscript.pdf'), join(output, 'paper.pdf'));
await writeFile(join(output, '.nojekyll'), '');
// Relative links keep the site usable below /hopf-observatory/ as well as /.
for (const page of ['index.html', 'technical-note.html']) {
  const html = await readFile(join(output, page), 'utf8');
  for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^https?:\/\/(?:localhost|127\.0\.0\.1)/.test(url))
      throw Error(`Local-only link in ${page}: ${url}`);
    if (/^(?:https?:|data:|mailto:|#)/.test(url)) continue;
    if (url.startsWith('/')) throw Error(`Root-relative link in ${page}: ${url}`);
    const path = url.split(/[?#]/)[0];
    if (path) await access(resolve(output, path));
  }
}
console.log(`GitHub Pages artifact: ${output}`);
