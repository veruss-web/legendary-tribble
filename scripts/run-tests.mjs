// Dependency-free test runner.
// 1. Compiles the pure modules in lib/ with the TypeScript compiler that is already a dependency of the project.
// 2. Runs tests/*.test.mjs with Node's built-in test runner (Node 20+).
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.test-build');

// Only modules without React / Supabase / browser dependencies belong here.
const PURE_MODULES = ['lib/auth.ts', 'lib/customers.ts', 'lib/format.ts', 'lib/theme.ts', 'lib/products.ts', 'lib/inventory.ts', 'lib/payments.ts', 'lib/overview.ts', 'lib/pos.ts', 'lib/analytics.ts', 'lib/chart-path.ts'];

rmSync(out, { recursive: true, force: true });
for (const file of PURE_MODULES) {
  const source = readFileSync(join(root, file), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  });
  const dest = join(out, file.replace(/\.ts$/, '.js'));
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, outputText);
}
writeFileSync(join(out, 'package.json'), '{"type":"commonjs"}\n');

const files = readdirSync(join(root, 'tests'))
  .filter((name) => name.endsWith('.test.mjs'))
  .map((name) => join(root, 'tests', name));
const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  env: { ...process.env, MIEFLOW_BUILD: out },
});
rmSync(out, { recursive: true, force: true });
process.exit(result.status ?? 1);
