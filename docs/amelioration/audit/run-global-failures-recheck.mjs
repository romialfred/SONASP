import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const here = fileURLToPath(new URL('./', import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');
const relative = file => path.relative(root, file).replaceAll('\\', '/');
function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? sources(file) : /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [file] : [];
  }).sort();
}
const tests = ['src/services/sensitiveUploadInventory.test.ts', 'docs/amelioration/audit/site-photos-reprise-independent.test.tsx'];
const selected = [...tests, 'docs/audits/sensitive-upload-surfaces-2i.json', 'src/pages/artisanal-sites/ArtisanalSiteDetails.tsx', 'src/services/sitePhotoService.ts', 'src/components/artisanal-sites/SitePhotoPreview.tsx', 'src/hooks/useArtisanalSiteData.ts', 'vitest.config.ts', 'src/test/setup.ts', 'package-lock.json'];
function fingerprint() {
  const files = sources(path.join(root, 'src'));
  return {
    scannedSourceCount: files.length,
    scannedSourceSha256: sha(files.map(file => `${relative(file)}:${sha(fs.readFileSync(file))}`).join('\n')),
    selected: Object.fromEntries(selected.map(file => [file, sha(fs.readFileSync(path.join(root, file)))])),
  };
}
const stem = 'global-failures-recheck-20260907';
for (const suffix of ['.json', '.txt', '.evidence.json']) if (fs.existsSync(path.join(here, stem + suffix))) throw new Error('Conserver le rejeu existant ; ne pas écraser');
const before = fingerprint();
const startCommit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim();
const startedAt = new Date().toISOString();
const args = ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', '--reporter=verbose', '--reporter=json', `--outputFile.json=docs/amelioration/audit/${stem}.json`, ...tests];
const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 120000, windowsHide: true, env: { ...process.env, NO_COLOR: '1' } });
const after = fingerprint();
const log = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
fs.writeFileSync(path.join(here, stem + '.txt'), log);
const jsonPath = path.join(here, stem + '.json');
const report = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : null;
const evidence = { id: 'AUD-GLOBAL-FAILURES-RECHECK-20260907', startedAt, finishedAt: new Date().toISOString(), startCommit,
  endCommit: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim(),
  command: ['node', ...args].join(' '), exitCode: result.status, processError: result.error?.message ?? null,
  passed: report?.numPassedTests ?? 0, failed: report?.numFailedTests ?? null, total: report?.numTotalTests ?? null,
  stableInputs: JSON.stringify(before) === JSON.stringify(after), before, after, logSha256: sha(log),
  scope: 'Deux fichiers ciblés uniquement ; inventaire statique et rendu React sous jsdom avec Auth/services simulés.',
  replacesFailedGlobalRun: false, uiValidated: false, databaseValidated: false };
fs.writeFileSync(path.join(here, stem + '.evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ exitCode: evidence.exitCode, passed: evidence.passed, failed: evidence.failed, total: evidence.total, stableInputs: evidence.stableInputs }));
if (result.status !== 0 || !evidence.stableInputs) process.exitCode = 1;
