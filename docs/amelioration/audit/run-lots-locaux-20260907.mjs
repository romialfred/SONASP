import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const groups = {
  volume: {
    tests: ['src/lib/readAllPages.test.ts', 'src/services/artisanReadVolume.test.ts', 'src/services/artisanalSiteService.test.ts', 'src/services/artisanalSiteSave.test.ts', 'src/services/artisanalSiteInsights.test.ts', 'src/services/artisanTerritoryInsights.test.ts', 'src/services/factureVenteService.test.ts', 'src/services/carteProfessionnelleService.test.ts'],
    inputs: ['src/lib/readAllPages.ts', 'src/services/artisanMinierService.ts', 'src/services/artisanGoldSalesService.ts', 'src/services/artisanalSiteService.ts', 'src/services/artisanalSiteInsights.ts', 'src/services/artisanTerritoryInsights.ts', 'src/services/factureVenteService.ts', 'src/services/carteProfessionnelleService.ts'],
  },
  affiliation: {
    tests: ['src/components/artisan/AffiliationDossier.test.tsx', 'src/components/artisan/AffiliationPaymentPanel.test.tsx', 'docs/amelioration/audit/affiliation-reprise-independent.test.tsx'],
    inputs: ['src/components/artisan/AffiliationDossier.tsx', 'src/components/artisan/AffiliationPaymentPanel.tsx', 'src/services/affiliationService.ts', 'src/services/carteProfessionnelleService.ts', 'src/lib/capabilities.ts', 'src/lib/affiliationCard.ts'],
  },
  photos: {
    tests: ['src/services/sitePhotoService.test.ts', 'src/components/artisanal-sites/SitePhotoPreview.test.tsx', 'src/pages/artisanal-sites/ArtisanalSiteForm.test.tsx', 'src/pages/artisanal-sites/ArtisanalSiteDetails.test.tsx', 'docs/amelioration/audit/site-photos-reprise-independent.test.tsx'],
    inputs: ['src/services/sitePhotoService.ts', 'src/components/artisanal-sites/SitePhotoPreview.tsx', 'src/pages/artisanal-sites/ArtisanalSiteForm.tsx', 'src/pages/artisanal-sites/ArtisanalSiteDetails.tsx', 'src/services/artisanalSiteService.ts', 'src/services/siteAeaDocumentService.ts', 'src/hooks/useArtisanalSiteData.ts'],
  },
};
const name = process.argv[2];
const group = groups[name];
if (!group) throw new Error('Lot local inconnu');
const inputPaths = [...group.tests, ...group.inputs, 'vitest.config.ts', 'src/test/setup.ts', 'package-lock.json'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashes = async () => Object.fromEntries(await Promise.all(inputPaths.map(async path => [path, sha(await readFile(new URL('../../../' + path, import.meta.url)))])));
const before = await hashes();
const started = new Date().toISOString();
const args = ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', '--reporter=verbose', ...group.tests];
const run = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 300000, windowsHide: true, env: { ...process.env, NO_COLOR: '1' } });
const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
const after = await hashes();
const evidence = {
  id: `AUD-LOCAL-${name}-20260907`, startedAtUtc: started, finishedAtUtc: new Date().toISOString(),
  commit: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim(),
  command: ['node', ...args].join(' '), exitCode: run.status, processError: run.error?.message ?? null,
  passed: Number(output.match(/\bTests\s+(\d+) passed/)?.[1] ?? 0),
  stableInputs: JSON.stringify(before) === JSON.stringify(after), before, after,
  logSha256: sha(output), scope: 'Tests locaux ; Auth/services/transport simulés ; aucun navigateur ou accès DB réel',
  uiValidated: false, databaseValidated: false, releaseAuthorised: false,
};
await writeFile(new URL(`./${name}-local-20260907.txt`, import.meta.url), output);
await writeFile(new URL(`./${name}-local-20260907.evidence.json`, import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
process.stdout.write(JSON.stringify({ lot: name, exitCode: evidence.exitCode, passed: evidence.passed, stableInputs: evidence.stableInputs }) + '\n');
if (run.status !== 0 || !evidence.stableInputs) process.exitCode = 1;
