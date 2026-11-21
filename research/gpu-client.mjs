import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export async function openGPU() {
  if (process.platform !== 'darwin')
    throw Error('Native experiments require macOS; use the browser benchmark on other systems.');
  const dir = dirname(fileURLToPath(import.meta.url)),
    temp = await mkdtemp(join(tmpdir(), 'hopf-paper-')),
    binary = join(temp, 'gpu');
  const build = spawnSync(
    'clang',
    [
      '-w',
      '-O2',
      '-fobjc-arc',
      join(dir, 'native-render.m'),
      '-framework',
      'Foundation',
      '-framework',
      'OpenGL',
      '-o',
      binary,
    ],
    { encoding: 'utf8' },
  );
  if (build.status !== 0) throw Error(build.stderr);
  const child = spawn(binary, [], { stdio: ['pipe', 'pipe', 'inherit'] }),
    pending = [];
  const ready = new Promise((resolve, reject) => pending.push({ resolve, reject }));
  createInterface({ input: child.stdout }).on('line', (line) => {
    const p = pending.shift();
    if (!p) return;
    try {
      const r = JSON.parse(line);
      if (r.error) p.reject(Error(r.error));
      else p.resolve(r);
    } catch (e) {
      p.reject(e);
    }
  });
  child.on('error', (e) => pending.splice(0).forEach((p) => p.reject(e)));
  child.on('exit', (code) =>
    pending.splice(0).forEach((p) => p.reject(Error(`GPU helper exited ${code}`))),
  );
  const command = (data) =>
    new Promise((resolve, reject) => {
      if (child.exitCode !== null) return reject(Error('GPU process ended'));
      pending.push({ resolve, reject });
      child.stdin.write(JSON.stringify(data) + '\n');
    });
  const hardware = await ready;
  const desktop = (s) => s.replace('#version 300 es', '#version 410 core');
  return {
    hardware,
    command,
    compile: (name, vertex, fragment) =>
      command({ op: 'compile', name, vertex: desktop(vertex), fragment: desktop(fragment) }),
    close: async () => {
      await command({ op: 'quit' }).catch(() => {});
      child.stdin.end();
      await rm(temp, { recursive: true, force: true });
    },
  };
}
