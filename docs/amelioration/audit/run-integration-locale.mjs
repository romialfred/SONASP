import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const directory = new URL('./', import.meta.url);
const prefix = process.argv[2] || 'integration-locale-r03';
if (!/^integration-locale-[a-z0-9-]+$/.test(prefix)) throw new Error('Identifiant de preuve locale invalide');
if ((await readdir(directory)).some(name => name.startsWith(prefix + '-'))) {
  throw new Error('Ce reçu existe déjà. Choisir un nouvel identifiant pour préserver les preuves précédentes.');
}
const buildDirectory = `node_modules/.cache/${prefix.replace('integration-locale-', 'reprise-integree-')}`;
const execute = (binary, args, env = process.env) => new Promise((resolve, reject) => {
  const child = spawn(binary, args, { cwd: root, env, windowsHide: true });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', value => { stdout += value; });
  child.stderr.on('data', value => { stderr += value; });
  child.on('error', reject);
  child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inventory = await execute('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'src', 'supabase', 'tests', 'scripts', 'docs', 'package.json', 'package-lock.json', '*config*']);
if (inventory.code !== 0) throw new Error('Inventaire des sources indisponible');
const inputs = [...new Set(inventory.stdout.split('\0').filter(path => path &&
  (!path.startsWith('docs/') || /(?:\.test\.[cm]?[jt]sx?|\/run-end-errors-reporter\.mjs)$/.test(path))))].sort();
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async path => [path, sha(await readFile(new URL('../../../' + path, import.meta.url)))])));
const before = await hashes();
const head = (await execute('git', ['rev-parse', 'HEAD'])).stdout.trim();
const startedAt = new Date().toISOString();
const steps = [
  ['tests', ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=4', '--reporter=json', '--reporter=./docs/amelioration/audit/run-end-errors-reporter.mjs', `--outputFile=docs/amelioration/audit/${prefix}-tests.json`]],
  ['database-types', ['scripts/check-database-type-coverage.mjs']],
  ['typescript', ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tsconfig.app.json']],
  ['lint', ['node_modules/eslint/bin/eslint.js', '.']],
  ['french-ui', ['scripts/check-french-ui.mjs']],
  ['build-source', ['scripts/release/verify-build-source.mjs']],
  ['build', ['node_modules/vite/bin/vite.js', 'build', '--outDir', buildDirectory]],
];
const results = [];
for (const [name, args] of steps) {
  const start = new Date().toISOString();
  const result = await execute(process.execPath, args, {
    ...process.env, NO_COLOR: '1',
    AUDIT_RUN_END_FILE: fileURLToPath(new URL(`${prefix}-test-end.json`, directory)),
  });
  await writeFile(new URL(`${prefix}-${name}.stdout.txt`, directory), result.stdout);
  await writeFile(new URL(`${prefix}-${name}.stderr.txt`, directory), result.stderr);
  const record = { name, command: ['node', ...args], startedAt: start, endedAt: new Date().toISOString(), code: result.code, signal: result.signal, stdoutSha256: sha(result.stdout), stderrSha256: sha(result.stderr) };
  results.push(record);
  process.stdout.write(JSON.stringify(record) + '\n');
}
const after = await hashes();
const evidence = { startedAt, endedAt: new Date().toISOString(), head, stableInputs: JSON.stringify(before) === JSON.stringify(after), before, after, results, scope: 'Vérifications locales uniquement ; aucune commande distante ni migration exécutée' };
await writeFile(new URL(`${prefix}-evidence.json`, directory), JSON.stringify(evidence, null, 2) + '\n');
if (!evidence.stableInputs || results.some(result => result.code !== 0)) process.exitCode = 1;
