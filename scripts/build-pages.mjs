import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const result = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE_PATH: process.env.PAGES_BASE_PATH || '/Sentinel_Demo/', VITE_ROUTER_MODE: 'hash' },
});
if (result.status !== 0) process.exit(result.status || 1);
const commit = process.env.GITHUB_SHA || spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() || null;
writeFileSync('dist/build-info.json', JSON.stringify({ commit, builtAt: new Date().toISOString(), hosting: 'github-pages' }, null, 2) + '\n');
writeFileSync('dist/.nojekyll', '');
