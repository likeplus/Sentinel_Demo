// Check new lint regressions while keeping the standard failing lint result explicit.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-lint-'));
try {
  const output = path.join(directory, 'lint.json');
  const result = spawnSync('npm', ['run', 'lint', '--', '--format', 'json', '--output-file', output], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (![0, 1].includes(result.status) || !fs.existsSync(output)) throw Error('ESLint did not finish normally');
  const diagnostics = JSON.parse(fs.readFileSync(output, 'utf8'));
  const normalized = diagnostics.filter(file => file.messages.length).map(file => ({
    file: path.relative(process.cwd(), file.filePath).split(path.sep).join('/'),
    messages: file.messages.map(({ ruleId, severity, line, column, message }) => ({ ruleId, severity, line, column, message })),
  }));
  const baseline = JSON.parse(fs.readFileSync('docs/validation/phase01-lint-baseline.json', 'utf8'));
  if (JSON.stringify(normalized) !== JSON.stringify(baseline)) throw Error('Lint diagnostics differ from the recorded baseline; review the standard lint output');
  console.log(`PASS: no lint regressions; standard lint exit ${result.status}, ${diagnostics.reduce((n,f)=>n+f.errorCount,0)} existing errors and ${diagnostics.reduce((n,f)=>n+f.warningCount,0)} existing warnings`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
