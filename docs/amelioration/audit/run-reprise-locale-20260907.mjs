// Contrôle local indépendant. Aucune connexion au navigateur ou à la base.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const tests = [
  'src/components/layout/portalThemes.test.tsx',
  'src/components/layout/sidebarNavigation.test.ts',
  'src/components/layout/NationalDashboardLayout.test.tsx',
  'src/components/layout/NationalDashboardMine.test.tsx',
  'src/components/layout/NationalDashboardChrome.test.tsx',
  'src/components/layout/national-dashboard-layout.styles.test.ts',
  'src/pages/dashboards/GlobalDashboardEnhanced.test.tsx',
  'src/pages/artisan-minier/ArtisanMinierDashboard.test.tsx',
  'src/services/artisanTerritoryInsights.test.ts',
  'docs/amelioration/audit/artisan-dashboard-independent.test.tsx',
];
const inputs = [...tests,
  'src/components/layout/NationalDashboardLayout.tsx',
  'src/components/layout/PortalBrandPair.tsx',
  'src/components/layout/PortalIdentity.tsx',
  'src/components/layout/portalThemes.ts',
  'src/components/layout/usePortalBrand.ts',
  'src/components/layout/national-dashboard-layout.css',
  'src/pages/dashboards/global-dashboard-enhanced.css',
  'src/pages/dashboards/GlobalDashboardEnhanced.tsx',
  'src/pages/artisan-minier/ArtisanMinierDashboard.tsx',
  'src/services/artisanTerritoryInsights.ts',
  'src/services/artisanMinierService.ts',
  'src/services/carteProfessionnelleService.ts',
  'src/services/artisanalSiteService.ts',
  'src/lib/routeAccessRegistry.ts', 'src/types/auth.ts',
  'src/test/setup.ts', 'vitest.config.ts', 'package-lock.json',
];
const hash = value => createHash('sha256').update(value).digest('hex');
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async path => [path, hash(await readFile(new URL('../../../' + path, import.meta.url)))])));
const before = await hashes();
const args = ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', '--reporter=verbose', ...tests];
const start = new Date().toISOString();
const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 300000, windowsHide: true, env: { ...process.env, NO_COLOR: '1' } });
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const after = await hashes();
const stable = JSON.stringify(before) === JSON.stringify(after);
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
const evidence = {
  id: 'AUD-REPRISE-LOCALE-20260907', startedAtUtc: start, finishedAtUtc: new Date().toISOString(),
  baseCommit: git.stdout.trim(), environment: 'Vitest local jsdom ; Auth/services simulés',
  command: ['node', ...args].join(' '), exitCode: result.status,
  passedTests: Number(output.match(/\bTests\s+(\d+) passed/)?.[1] ?? 0), testFiles: tests.length,
  inputsBefore: before, inputsAfter: after, stableInputs: stable,
  output: { path: 'docs/amelioration/audit/reprise-locale-20260907-tests.txt', sha256: hash(output) },
  browserExecuted: false, databaseExecuted: false, deploymentExecuted: false,
  limitations: ['Les 13 cas indépendants sont ceux du tableau de bord Artisan ; le header réexécute les tests existants.', 'Les captures historiques du banc ne prouvent ni Auth réel, ni écriture, ni correspondance exacte avec ce nouveau run.', 'Un succès technique ne valide pas tous les modules ou tous les portails.'],
};
await writeFile(new URL('./reprise-locale-20260907-tests.txt', import.meta.url), output);
await writeFile(new URL('./reprise-locale-20260907.evidence.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
process.stdout.write(JSON.stringify({ exitCode: result.status, stableInputs: stable, tests: evidence.passedTests, files: tests.length }) + '\n');
if (result.status !== 0 || !stable) process.exitCode = 1;
