// Runs every test. Started by `npm test`, which boots the Firebase emulators
// first (firebase emulators:exec) and shuts them down afterwards.
//   1. worker unit tests (mocked APIs)
//   2. Firestore security rules
//   3. end-to-end: builds the site pointed at the emulators, serves it on
//      :5173, runs the worker on :8787, and drives it with headless Chrome
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startWorker } from './worker-server.mjs';
import { runE2E } from './e2e.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TESTS = fileURLToPath(new URL('.', import.meta.url));
const VITE = `${ROOT}node_modules/.bin/vite`;
const DIST = `${TESTS}.dist`;

const results = {};
const node = (file) => spawnSync('node', [file], { cwd: TESTS, stdio: 'inherit' }).status === 0;

console.log('\n=== Worker unit tests ===');
results.worker = node('worker-unit.mjs');

console.log('\n=== Firestore security rules ===');
results.rules = node('rules.mjs');

console.log('\n=== End-to-end (phone-sized Chrome) ===');
const build = spawnSync(VITE, ['build', '--outDir', DIST, '--emptyOutDir', '--logLevel', 'warn'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, VITE_USE_EMULATORS: '1', VITE_WORKER_URL: 'http://127.0.0.1:8787' },
});
if (build.status !== 0) {
  results.e2e = false;
} else {
  const worker = await startWorker(8787);
  const preview = spawn(VITE, ['preview', '--port', '5173', '--strictPort', '--outDir', DIST], { cwd: ROOT, stdio: 'ignore' });
  try {
    for (let i = 0; i < 60; i++) {
      if (await fetch('http://localhost:5173/chat.html').then((r) => r.ok, () => false)) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    results.e2e = await runE2E();
  } catch (err) {
    console.error(err);
    results.e2e = false;
  } finally {
    preview.kill();
    worker.close();
  }
}

console.log('\n=== Summary ===');
for (const [name, ok] of Object.entries(results)) console.log(`  ${ok ? '✓' : '✗'} ${name}`);
process.exit(Object.values(results).every(Boolean) ? 0 : 1);
