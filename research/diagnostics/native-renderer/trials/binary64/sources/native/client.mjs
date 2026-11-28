import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

export async function openNative({ threads, logPath } = {}) {
  const binary = process.env.HOPF_NATIVE_BINARY || fileURLToPath(new URL('build/hopf-render', import.meta.url));
  const processHandle = spawn(binary, threads ? ['--threads', String(threads)] : [], { stdio: ['pipe', 'pipe', 'inherit'] });
  const pending = [], records = [];
  const ready = new Promise((resolve, reject) => pending.push({ resolve, reject }));
  const exited = new Promise(resolve => processHandle.once('exit', resolve));
  createInterface({ input: processHandle.stdout }).on('line', line => {
    const next = pending.shift();
    if (!next) return;
    try {
      const result = JSON.parse(line);
      if (next.request && logPath) records.push({ request: next.request, result });
      if (result.error) next.reject(Error(result.error)); else next.resolve(result);
    } catch (error) { next.reject(error); }
  });
  processHandle.on('error', error => { for (const p of pending.splice(0)) p.reject(error); });
  processHandle.on('exit', code => { for (const p of pending.splice(0)) p.reject(Error(`C++ renderer exited: ${code}`)); });
  const metadata = await ready;
  return {
    hardware: { ...metadata, renderer: 'C++ CPU direct quartics', version: metadata.compiler },
    command(request) {
      if (request.op === 'quit') return Promise.resolve({});
      return new Promise((resolve, reject) => {
        pending.push({ resolve, reject, request });
        processHandle.stdin.write(JSON.stringify(request) + '\n');
      });
    },
    async close() {
      processHandle.stdin.end(); await exited;
      if (logPath) await writeFile(logPath, gzipSync(JSON.stringify({ metadata, records })));
    },
  };
}
