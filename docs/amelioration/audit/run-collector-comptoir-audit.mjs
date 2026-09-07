import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const here = fileURLToPath(new URL('./', import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');
const tests = [
  'src/lib/readAllPages.test.ts',
  'src/services/collectorService.test.ts',
  'src/services/rpcClientBinding.test.ts',
  'src/pages/collector/CollectorDetails.test.tsx',
  'src/pages/collector/CollectorForm.test.tsx',
  'src/pages/collector/CollectorsPage.test.tsx',
  'src/pages/collector/ComptoirForm.test.tsx',
  'src/pages/collector/ComptoirsPage.test.tsx',
  'docs/amelioration/audit/collector-comptoir-scope-independent.test.tsx',
];
const inputs = [...tests,
  'src/pages/collector/CollectorsPage.tsx', 'src/pages/collector/ComptoirsPage.tsx',
  'src/services/collectorService.ts', 'src/services/comptoirService.ts',
  'src/lib/readAllPages.ts', 'src/lib/presentError.ts',
  'src/lib/collectorDossier.ts', 'src/lib/comptoirDossier.ts',
  'src/pages/collector/CollectorDetails.tsx', 'src/pages/collector/CollectorForm.tsx',
  'src/pages/collector/ComptoirForm.tsx', 'src/lib/routeAccessRegistry.ts',
  'supabase/migrations/20260906145430_collecteurs_comptoirs_ventes.sql',
  'supabase/migrations/20260906174800_dossiers_comptoirs_entreprises.sql',
  'vitest.config.ts', 'src/test/setup.ts', 'package-lock.json',
];
const fingerprint = () => Object.fromEntries(inputs.map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
const commit = () => spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim();
const stem = process.argv[2] || 'collecteurs-comptoirs-independent-20260907';
if (!/^collecteurs-comptoirs-independent-20260907(?:-r\d+)?$/.test(stem)) throw new Error('Identifiant de preuve invalide');
for (const suffix of ['.json', '.txt', '.evidence.json']) {
  if (fs.existsSync(path.join(here, stem + suffix))) throw new Error('Ce rejeu existe déjà ; conserver la preuve.');
}
const before = fingerprint();
const startedAt = new Date().toISOString();
const startCommit = commit();
const args = ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', '--reporter=verbose', '--reporter=json', `--outputFile.json=docs/amelioration/audit/${stem}.json`, ...tests];
const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 600000, windowsHide: true, env: { ...process.env, NO_COLOR: '1' } });
const after = fingerprint();
const log = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
fs.writeFileSync(path.join(here, stem + '.txt'), log);
const jsonPath = path.join(here, stem + '.json');
const report = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : null;
const evidence = {
  id: 'AUD-COLLECTEURS-COMPTOIRS-LOCAL-20260907', startedAt, finishedAt: new Date().toISOString(), startCommit, endCommit: commit(),
  command: ['node', ...args].join(' '), exitCode: result.status, processError: result.error?.message ?? null,
  passed: report?.numPassedTests ?? 0, failed: report?.numFailedTests ?? null, total: report?.numTotalTests ?? null,
  testFiles: tests.length, stableInputs: JSON.stringify(before) === JSON.stringify(after), before, after, logSha256: sha(log),
  scope: 'Tests React jsdom avec Auth/services simulés et SDK Supabase réel avec fetch simulé sur hôte .invalid ; aucune requête distante.',
  uiBrowserValidated: false, databaseValidated: false, liveRpcOrderVerified: false,
};
fs.writeFileSync(path.join(here, stem + '.evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ exitCode: evidence.exitCode, passed: evidence.passed, failed: evidence.failed, total: evidence.total, stableInputs: evidence.stableInputs }));
if (result.status !== 0 || !evidence.stableInputs) process.exitCode = 1;
