import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const prefix = 'docs/amelioration/audit/sites-read-independent-20260907';
const tests = [
  'src/pages/artisanal-sites/ArtisanalSitesOverview.test.tsx',
  'src/pages/artisanal-sites/ArtisanalSiteReadState.test.tsx',
  'src/pages/artisanal-sites/ArtisanalSiteProduction.test.tsx',
  'src/pages/artisanal-sites/ArtisanalSiteDetails.test.tsx',
  'src/hooks/useArtisanalSiteData.test.tsx',
  'src/services/artisanalSiteInsights.test.ts',
  'docs/amelioration/audit/site-photos-reprise-independent.test.tsx',
];
const sources = [
  'src/pages/artisanal-sites/ArtisanalSitesOverview.tsx',
  'src/pages/artisanal-sites/ArtisanalSiteProduction.tsx',
  'src/pages/artisanal-sites/ArtisanalSiteDetails.tsx',
  'src/hooks/useArtisanalSiteData.ts',
  'src/services/artisanalSiteInsights.ts',
  'src/services/artisanalSiteService.ts',
  'src/services/siteAeaDocumentService.ts',
  'src/services/sitePhotoService.ts',
  'src/components/artisanal-sites/SitePhotoPreview.tsx',
  'src/lib/siteFormalization.ts',
  'src/lib/miningRegistryAccess.ts',
  'vitest.config.ts', 'src/test/setup.ts', 'package-lock.json',
  'docs/amelioration/audit/run-end-errors-reporter.mjs',
  'docs/amelioration/audit/run-sites-read-audit.mjs',
];
const sha = file => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const hashes = () => Object.fromEntries([...sources, ...tests].map(file => [file, sha(file)]));
for (const suffix of ['.json', '.stdout.txt', '.stderr.txt', '.run-end.json', '.evidence.json']) {
  if (fs.existsSync(path.join(root, prefix + suffix))) throw new Error('Une preuve précédente existe ; ne pas écraser');
}
const before = hashes();
const args = ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=2', '--reporter=default', '--reporter=json', '--reporter=./docs/amelioration/audit/run-end-errors-reporter.mjs', `--outputFile.json=${prefix}.json`, ...tests];
const startedAt = new Date().toISOString();
const result = spawnSync(process.execPath, args, {
  cwd: root, encoding: 'utf8', windowsHide: true, timeout: 600000,
  env: { ...process.env, NO_COLOR: '1', AUDIT_RUN_END_FILE: path.join(root, prefix + '.run-end.json') },
});
fs.writeFileSync(path.join(root, prefix + '.stdout.txt'), result.stdout || '');
fs.writeFileSync(path.join(root, prefix + '.stderr.txt'), result.stderr || '');
const read = suffix => fs.existsSync(path.join(root, prefix + suffix)) ? JSON.parse(fs.readFileSync(path.join(root, prefix + suffix), 'utf8')) : null;
const json = read('.json');
const end = read('.run-end.json');
const after = hashes();
const evidence = {
  id: 'AUD-SITES-READ-20260907', startedAt, finishedAt: new Date().toISOString(),
  command: ['node', ...args].join(' '), exitCode: result.status, signal: result.signal,
  processError: result.error?.message || null,
  total: json?.numTotalTests, passed: json?.numPassedTests, failed: json?.numFailedTests,
  pending: json?.numPendingTests, files: json?.testResults?.length, jsonSuccess: json?.success,
  expectedFiles: tests.length,
  reason: end?.reason, unhandledErrors: end?.unhandledErrors,
  stableInputs: JSON.stringify(before) === JSON.stringify(after), before, after,
  actualHookUsedByNewReadStateTests: true,
  mockedLayers: ['Auth', 'service reads', 'Storage resolution', 'layout', 'charts'],
  browserVerified: false, apiVerified: false, persistenceVerified: false,
  replacesGlobalRun: false,
};
evidence.technicalRunAccepted = result.status === 0 && !result.error && evidence.stableInputs
  && json?.numFailedTests === 0 && json?.testResults?.length === tests.length
  && end?.reason === 'passed' && end?.unhandledErrors?.length === 0;
fs.writeFileSync(path.join(root, prefix + '.evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
if (!evidence.technicalRunAccepted) process.exitCode = 1;
