// Keep the server and browser checks within the same process lifetime.
const { spawn } = require('node:child_process');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5190', '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'] });
const run = script => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [script], { stdio: 'inherit', env: { ...process.env, SMOKE_BASE_URL: 'http://127.0.0.1:5190' } });
  child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${script}: exit ${code}`)));
});
const ready = new Promise((resolve, reject) => { server.stdout.on('data', data => { if (data.toString().includes('Local:')) resolve(); }); server.once('error', reject); server.once('exit', code => reject(new Error(`Server exited: ${code}`))); });
(async () => { try { await ready; await run('scripts/smoke-feedback.cjs'); await run('scripts/smoke-manager-flow.cjs'); await run('scripts/smoke-routes.cjs'); } finally { server.kill(); } })().catch(e => { console.error(e); process.exitCode = 1; });
